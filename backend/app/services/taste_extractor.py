"""
taste_extractor.py — Extract a TasteCard from uploaded Instagram data exports, screenshots, or quiz.
NO scraping, NO login. Only user-supplied files.
Defensive parsing: handles different Instagram schema versions, harvests text/hashtags/locations,
and falls back to deterministic heuristic extraction if open-model LLM is offline.
"""
import io
import json
import re
import zipfile
from typing import Any, Dict, List, Optional
from app.llm import chat_json, chat_vision
from app.models.schema import TasteCard, PriceComfort

SYSTEM_TASTE = """You extract taste signals from social text/image data for date planning in Tamil Nadu, India.
Output ONLY a valid JSON object matching the TasteCard schema:
{
  "cuisines": ["italian", "cafe", "south-indian"],
  "dietary_signals": [],
  "vibes": ["quiet", "artsy", "romantic", "garden", "pastel"],
  "activities": ["board-games", "pottery", "museum"],
  "dislikes": ["loud", "crowded"],
  "price_comfort": "mid",
  "confidence": {"cafe": 0.85, "artsy": 0.9}
}
STRICT PRIVACY RULES:
- Never infer religion, health status, political views, or sexuality.
- dietary_signals must ONLY be populated if explicitly stated in text (e.g. "vegetarian" or "vegan").
- Drop any sensitive categories from extraction.
"""

KNOWN_CUISINES = [
    "south-indian", "north-indian", "chettinad", "continental", "italian",
    "cafe", "desserts", "bakery", "mediterranean", "asian", "seafood",
    "persian", "mexican", "healthy", "street-food", "pizza", "coffee"
]

KNOWN_VIBES = [
    "quiet", "romantic", "artsy", "garden", "pastel", "vintage",
    "cozy", "peaceful", "aesthetic", "outdoors", "breezy", "coastal",
    "beach", "candlelight", "fine-dining", "quirky", "bohemian", "heritage"
]

KNOWN_ACTIVITIES = [
    "pottery", "board-games", "museum", "art-gallery", "library",
    "sunset-walk", "beach-stroll", "paddle-boarding", "boating", "craft-walk"
]

MAX_ARCHIVE_FILES = 2_000
MAX_ARCHIVE_JSON_BYTES = 25 * 1024 * 1024


def _harvest_strings(obj: Any, depth: int = 0) -> list[str]:
    """Recursively harvest string leaves from arbitrary JSON tree up to depth 8."""
    if depth > 8:
        return []
    if isinstance(obj, str):
        cleaned = obj.strip()
        if 2 < len(cleaned) < 500:
            return [cleaned]
        return []
    if isinstance(obj, list):
        out = []
        for item in obj[:200]:
            out.extend(_harvest_strings(item, depth + 1))
        return out
    if isinstance(obj, dict):
        out = []
        for k, v in obj.items():
            if isinstance(k, str) and any(w in k.lower() for w in ["caption", "title", "name", "hashtag", "value", "text"]):
                out.extend(_harvest_strings(v, depth + 1))
            else:
                out.extend(_harvest_strings(v, depth + 1))
        return out
    return []


def _extract_text_from_instagram_zip(data: bytes) -> str:
    """Walk an Instagram data export zip defensively across any folder structure."""
    texts: list[str] = []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            if len(infos) > MAX_ARCHIVE_FILES:
                return ""
            json_bytes = 0
            for info in infos:
                name = info.filename
                # Instagram export paths vary e.g. saved_posts.json, liked_posts.json, your_topics.json
                if name.lower().endswith(".json") and not name.startswith("__MACOSX"):
                    json_bytes += info.file_size
                    if json_bytes > MAX_ARCHIVE_JSON_BYTES or info.file_size > 5 * 1024 * 1024:
                        continue
                    try:
                        content = z.read(info)
                        parsed = json.loads(content)
                        texts.extend(_harvest_strings(parsed))
                    except Exception:
                        continue
    except zipfile.BadZipFile:
        pass
    return "\n".join(texts[:3000])


def _extract_heuristic_taste(text: str) -> TasteCard:
    """
    Deterministic fallback extractor when LLM is unreachable.
    Scans for cuisine, vibe, and activity signals with frequency confidence scoring.
    """
    lower = text.lower()

    detected_cuisines: list[str] = []
    confidence: dict[str, float] = {}

    for c in KNOWN_CUISINES:
        if c in lower or c.replace("-", " ") in lower:
            detected_cuisines.append(c)
            confidence[c] = 0.85

    detected_vibes: list[str] = []
    for v in KNOWN_VIBES:
        if v in lower or v.replace("-", " ") in lower:
            detected_vibes.append(v)
            confidence[v] = 0.8

    detected_activities: list[str] = []
    for a in KNOWN_ACTIVITIES:
        if a in lower or a.replace("-", " ") in lower:
            detected_activities.append(a)
            confidence[a] = 0.75

    dietary: list[str] = []
    if "vegetarian" in lower or "pure veg" in lower:
        dietary.append("vegetarian")
        confidence["vegetarian"] = 0.95
    if "vegan" in lower:
        dietary.append("vegan")
        confidence["vegan"] = 0.9

    # Default baseline if social data was sparse
    if not detected_cuisines:
        detected_cuisines = ["cafe", "continental", "south-indian"]
        confidence["cafe"] = 0.7
    if not detected_vibes:
        detected_vibes = ["romantic", "quiet", "aesthetic"]
        confidence["romantic"] = 0.75
    if not detected_activities:
        detected_activities = ["sunset-walk", "board-games"]
        confidence["sunset-walk"] = 0.7

    return TasteCard(
        cuisines=detected_cuisines[:6],
        dietary_signals=dietary,
        vibes=detected_vibes[:6],
        activities=detected_activities[:4],
        dislikes=["loud", "rush"],
        price_comfort=PriceComfort.mid,
        confidence=confidence,
    )


async def taste_from_export(file_bytes: bytes, filename: str) -> TasteCard:
    """Extract TasteCard from Instagram data export zip or JSON."""
    if filename.lower().endswith(".zip"):
        text = _extract_text_from_instagram_zip(file_bytes)
    else:
        try:
            raw = json.loads(file_bytes)
            text = "\n".join(_harvest_strings(raw)[:3000])
        except Exception:
            text = file_bytes.decode(errors="ignore")[:6000]

    if not text.strip():
        return _extract_heuristic_taste("aesthetic quiet cafe sunset romantic")

    prompt = f"""Extract date preferences for a Tamil Nadu date from this Instagram export data:
---
{text[:4500]}
---
Return valid JSON only matching TasteCard."""

    data = await chat_json(prompt, system=SYSTEM_TASTE)
    if data and isinstance(data, dict):
        try:
            return TasteCard.model_validate(data)
        except Exception:
            pass

    return _extract_heuristic_taste(text)


async def taste_from_image(image_bytes: bytes) -> TasteCard:
    """Extract TasteCard from screenshot via vision model or fallback."""
    prompt = """Analyze this saved post / aesthetic screenshot. Extract date vibe, cuisine signals, and activities for Tamil Nadu.
Return JSON with keys: cuisines, dietary_signals, vibes, activities, dislikes, price_comfort, confidence."""

    raw_text = await chat_vision(image_bytes, prompt)
    if raw_text:
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                return TasteCard.model_validate(data)
            except Exception:
                pass

    # Vision fallback: clean default card with aesthetic focus
    return TasteCard(
        cuisines=["cafe", "desserts", "continental"],
        dietary_signals=[],
        vibes=["aesthetic", "pastel", "romantic", "quiet"],
        activities=["art-gallery", "sunset-walk"],
        dislikes=["crowded"],
        price_comfort=PriceComfort.mid,
        confidence={"aesthetic": 0.85, "cafe": 0.8, "romantic": 0.75},
    )


async def taste_from_quiz(answers: dict) -> TasteCard:
    """Convert structured romantic preference quiz answers to confirmed TasteCard."""
    prompt = f"""Convert these date quiz answers to a TasteCard JSON:
{json.dumps(answers, indent=2)}"""

    data = await chat_json(prompt, system=SYSTEM_TASTE)
    if data and isinstance(data, dict):
        try:
            return TasteCard.model_validate(data)
        except Exception:
            pass

    # Direct mapping fallback from quiz fields
    cuisines = answers.get("cuisines", ["cafe", "continental"])
    vibes = answers.get("vibes", ["romantic", "quiet", "cozy"])
    activities = answers.get("activities", ["sunset-walk", "board-games"])
    dislikes = answers.get("dislikes", ["crowded"])
    dietary = [d for d in answers.get("dietary_signals", []) if d]
    price = answers.get("price_comfort", "mid")

    return TasteCard(
        cuisines=cuisines if isinstance(cuisines, list) else [cuisines],
        dietary_signals=dietary if isinstance(dietary, list) else [dietary],
        vibes=vibes if isinstance(vibes, list) else [vibes],
        activities=activities if isinstance(activities, list) else [activities],
        dislikes=dislikes if isinstance(dislikes, list) else [dislikes],
        price_comfort=PriceComfort(price) if price in ["low", "mid", "high"] else PriceComfort.mid,
        confidence={k: 0.9 for k in cuisines + vibes + activities},
    )
