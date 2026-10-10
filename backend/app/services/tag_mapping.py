"""
tag_mapping.py — Chips to venue tags with plain rules from data/tag_map.json.
No model call: the same answers always give the same taste profile, instantly.
Values with no rule pass through unchanged, so venue tags typed directly still work.
"""
from __future__ import annotations
import json
from functools import lru_cache
from pathlib import Path
from app.models.schema import PriceComfort, TasteCard

TAG_MAP_PATH = Path(__file__).parent.parent.parent / "data" / "tag_map.json"


@lru_cache(maxsize=1)
def tag_map() -> dict:
    with open(TAG_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


def _as_list(value) -> list[str]:
    if not value:
        return []
    items = value if isinstance(value, list) else [value]
    return [str(item).strip().lower() for item in items if str(item).strip()]


def vibe_tags(vibes: list[str]) -> tuple[list[str], list[str]]:
    """Quick-start vibe chips -> (venue vibe tags, cuisine tags)."""
    tags: list[str] = []
    cuisines: list[str] = []
    for vibe in vibes:
        rule = tag_map()["vibes"].get(vibe.lower(), {})
        tags += rule.get("vibes", [])
        cuisines += rule.get("cuisines", [])
    return tags, cuisines


def _map_field(values: list[str], section: str, out_key: str) -> list[str]:
    rules = tag_map()["quiz"][section]
    mapped: list[str] = []
    for value in values:
        rule = rules.get(value)
        mapped += rule[out_key] if rule else [value]
    return list(dict.fromkeys(mapped))


def _map_dislikes(values: list[str]) -> list[str]:
    rules = tag_map()["quiz"]["dislikes"]
    mapped: list[str] = []
    for value in values:
        mapped.append(value)
        mapped += rules.get(value, [])
    return list(dict.fromkeys(mapped))


def card_from_answers(answers: dict | None) -> TasteCard:
    """Quiz answers (slugs from the frontend) -> TasteCard.
    Dietary needs only come from what the person picked, never guessed."""
    if not answers:
        return TasteCard()
    cuisines = _map_field(_as_list(answers.get("cuisines")), "cuisines", "cuisines")
    vibes = _map_field(_as_list(answers.get("vibes")), "vibes", "vibes")
    activities = _map_field(_as_list(answers.get("activities")), "activities", "activities")
    price = str(answers.get("price_comfort", "mid")).lower()
    return TasteCard(
        cuisines=cuisines,
        vibes=vibes,
        activities=activities,
        dislikes=_map_dislikes(_as_list(answers.get("dislikes"))),
        dietary_signals=_as_list(answers.get("dietary_signals")),
        price_comfort=PriceComfort(price) if price in ("low", "mid", "high") else PriceComfort.mid,
        confidence={tag: 1.0 for tag in cuisines + vibes + activities},
    )
