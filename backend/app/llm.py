"""
llm.py — Swappable Open-Model LLM wrapper.
Supports:
- Ollama endpoints (/api/chat) e.g. Gemma 4 (E4B / E2B), Gemma 3, LLaVA
- OpenAI-compatible hosted endpoints (/v1/chat/completions) for cloud deployment
- Resilient fallback to deterministic generation when endpoints are offline
"""
import os
import json
import time
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger("datepilot.llm")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "").rstrip("/")
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL       = os.getenv("LLM_MODEL", "gemma3:4b")
VISION_MODEL    = os.getenv("VISION_MODEL", "llava:7b")
# A 4B model on a laptop CPU needs ~7s per reply once loaded (~20s cold), so allow plenty.
LLM_TIMEOUT_S   = float(os.getenv("LLM_TIMEOUT_S", "120"))
KEEP_ALIVE      = os.getenv("OLLAMA_KEEP_ALIVE", "30m")

_last_ollama_fail: float = 0.0
_last_openai_fail: float = 0.0


async def chat(prompt: str, system: str = "", model: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
    """
    Send prompt to configured open-weight model endpoint.
    Falls back gracefully if endpoint is unreachable.
    """
    global _last_ollama_fail, _last_openai_fail
    now = time.time()
    m = model or LLM_MODEL

    # 1. Try OpenAI-compatible endpoint if configured and not in cooldown
    if OPENAI_BASE_URL and (now - _last_openai_fail > 30.0):
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"} if OPENAI_API_KEY else {}
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    f"{OPENAI_BASE_URL}/chat/completions",
                    headers=headers,
                    json={"model": m, "messages": messages, "temperature": 0.4, **({"max_tokens": max_tokens} if max_tokens else {})},
                )
                if r.status_code == 200:
                    data = r.json()
                    return data["choices"][0]["message"]["content"]
        except Exception as e:
            _last_openai_fail = time.time()
            logger.warning(f"Hosted LLM endpoint error: {e}. Falling back.")

    # 2. Try Ollama endpoint if not in cooldown
    if now - _last_ollama_fail > 30.0:
        payload = {
            "model": m,
            "messages": [
                *([{"role": "system", "content": system}] if system else []),
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "keep_alive": KEEP_ALIVE,
            "options": {"temperature": 0.3, **({"num_predict": max_tokens} if max_tokens else {})},
        }

        try:
            timeout = httpx.Timeout(LLM_TIMEOUT_S, connect=2.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
                if r.status_code == 200:
                    return r.json()["message"]["content"]
                logger.warning(f"Ollama returned {r.status_code}: {r.text[:200]}")
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            # Only a server that cannot be reached is put on cooldown; a slow reply is not.
            _last_ollama_fail = time.time()
            logger.info(f"Ollama endpoint at {OLLAMA_BASE_URL} not reachable: {e}. Using template fallback.")
        except Exception as e:
            logger.warning(f"Ollama call failed: {e!r}. Using template fallback for this call.")

    # 3. Graceful fallback
    return ""


async def warm_up() -> None:
    """Load the chat model into memory at startup so the first plan is not slow."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(LLM_TIMEOUT_S, connect=2.0)) as client:
            await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": LLM_MODEL, "prompt": "", "keep_alive": KEEP_ALIVE},
            )
        logger.info(f"Warmed up {LLM_MODEL}")
    except Exception as e:
        logger.info(f"Model warm-up skipped: {e!r}")


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
        "keep_alive": KEEP_ALIVE,
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(max(LLM_TIMEOUT_S, 180.0), connect=2.0)) as client:
            r = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if r.status_code == 200:
                return r.json()["message"]["content"]
    except Exception as e:
        logger.info(f"Vision endpoint error: {e}. Fallback to image tag heuristic.")
    return ""
