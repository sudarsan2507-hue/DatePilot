"""
llm.py — Swappable Open-Model LLM wrapper.
Supports:
- Ollama endpoints (/api/chat) e.g. Gemma 4 (E4B / E2B), Gemma 3, LLaVA
- OpenAI-compatible hosted endpoints (/v1/chat/completions) for cloud deployment
- Resilient fallback to deterministic generation when endpoints are offline
"""
import os
import json
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger("datepilot.llm")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").rstrip("/")
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL       = os.getenv("LLM_MODEL", "gemma3:4b")
VISION_MODEL    = os.getenv("VISION_MODEL", "llava:7b")


async def chat(prompt: str, system: str = "", model: Optional[str] = None) -> str:
    """
    Send prompt to configured open-weight model endpoint.
    Falls back gracefully if endpoint is unreachable.
    """
    m = model or LLM_MODEL

    # 1. Try OpenAI-compatible endpoint if configured
    if OPENAI_BASE_URL:
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"} if OPENAI_API_KEY else {}
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                r = await client.post(
                    f"{OPENAI_BASE_URL}/chat/completions",
                    headers=headers,
                    json={"model": m, "messages": messages, "temperature": 0.4},
                )
                if r.status_code == 200:
                    data = r.json()
                    return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"Hosted LLM endpoint error: {e}. Falling back to Ollama or local template.")

    # 2. Try Ollama endpoint
    payload = {
        "model": m,
        "messages": [
            *([{"role": "system", "content": system}] if system else []),
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.3},
    }

    try:
        timeout = httpx.Timeout(20.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if r.status_code == 200:
                return r.json()["message"]["content"]
    except Exception as e:
        logger.info(f"Ollama endpoint at {OLLAMA_BASE_URL} not reachable: {e}. Utilizing built-in heuristic fallback.")

    # 3. Graceful fallback
    return ""


async def chat_json(prompt: str, system: str = "", model: Optional[str] = None, retries: int = 1) -> Any:
    """Call LLM and return parsed JSON with retry and markdown fence stripping."""
    for attempt in range(retries + 1):
        raw = await chat(prompt, system=system, model=model)
        if not raw:
            continue
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip().startswith("```") else lines[1:])
            text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            if attempt == retries:
                logger.warning("LLM response could not be parsed as JSON; activating schema fallback.")
                break
    return None


async def chat_vision(image_bytes: bytes, prompt: str) -> str:
    """Send image to vision-capable open model (e.g. LLaVA or Gemma Vision)."""
    import base64
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "model": VISION_MODEL,
        "messages": [{"role": "user", "content": prompt, "images": [b64]}],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            r = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if r.status_code == 200:
                return r.json()["message"]["content"]
    except Exception as e:
        logger.info(f"Vision endpoint error: {e}. Fallback to image tag heuristic.")
    return ""
