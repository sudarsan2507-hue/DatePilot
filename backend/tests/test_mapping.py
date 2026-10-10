"""Chip -> tag rules (no model), and the TEXT_MODEL switch."""
import asyncio
import json
import re
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app import llm
from app.main import app
from app.db import create_db_and_tables
from app.services.tag_mapping import card_from_answers, tag_map, vibe_tags

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
VENUE_TAGS = {
    tag
    for venue in json.loads((ROOT / "backend" / "data" / "venues.json").read_text(encoding="utf-8"))
    for tag in venue["vibe_tags"] + venue["cuisine_tags"]
}


@pytest.fixture(autouse=True)
def setup_db():
    create_db_and_tables()


def _js_list(name: str) -> list[str]:
    """Read one exported array of labels from frontend/src/lib/quiz.js."""
    source = (ROOT / "frontend" / "src" / "lib" / "quiz.js").read_text(encoding="utf-8")
    body = re.search(rf"export const {name} = \[(.*?)\];", source, re.S).group(1)
    return re.findall(r"'([^']+)'", body)


def _slug(label: str) -> str:  # same as toAnswers() in quiz.js
    return re.sub(r"\s+", "-", label.lower().replace(" & ", "-"))


@pytest.mark.parametrize("js_name, section", [
    ("QUIZ_CUISINES", "cuisines"), ("QUIZ_VIBES", "vibes"), ("QUIZ_ACTIVITIES", "activities"),
])
def test_every_quiz_chip_has_a_rule_that_matches_real_venues(js_name, section):
    rules = tag_map()["quiz"][section]
    for label in _js_list(js_name):
        slug = _slug(label) if section != "activities" else re.sub(r"\s+", "-", label.lower())
        assert slug in rules, f"no rule for quiz chip {label!r} ({slug})"
        tags = next(iter(rules[slug].values()))
        assert VENUE_TAGS & set(tags), f"{label!r} maps to no tag any venue has"


def test_every_quick_vibe_matches_real_venues():
    for vibe in tag_map()["vibes"]:
        tags, cuisines = vibe_tags([vibe])
        assert VENUE_TAGS & set(tags + cuisines), vibe


def test_card_from_answers_maps_and_passes_unknown_values_through():
    card = card_from_answers({
        "cuisines": ["south-indian", "sushi"],
        "vibes": ["quiet-intimate"],
        "activities": ["historic-museum"],
        "dislikes": ["loud"],
        "dietary_signals": [],
        "price_comfort": "low",
    })
    assert "dosa" in card.cuisines and "sushi" in card.cuisines
    assert {"quiet", "intimate"} <= set(card.vibes)
    assert "museum" in card.activities
    assert {"loud", "bustling"} <= set(card.dislikes)
    assert card.dietary_signals == []          # never guessed
    assert card.price_comfort.value == "low"
    assert card_from_answers(None).cuisines == []


def test_quiz_endpoint_needs_no_model(monkeypatch):
    async def no_model(*args, **kwargs):
        raise AssertionError("the quiz must not call the model")
    monkeypatch.setattr(llm, "chat", no_model)
    monkeypatch.setattr(llm, "chat_json", no_model)
    token = client.post("/sessions/", json={
        "date": "2026-10-20", "time_start": "12:00", "time_end": "22:00", "budget_inr": 4000,
        "start_area": "Alwarpet", "max_travel_minutes": 40, "slots_enabled": ["lunch", "dinner"],
    }).json()["token_a"]
    res = client.post(f"/taste/{token}/quiz", json={"cuisines": ["italian"], "vibes": ["candlelight"], "activities": []})
    assert res.status_code == 200
    assert "pizza" in res.json()["cuisines"] and "candlelight" in res.json()["vibes"]


def test_text_model_defaults_to_none_and_makes_no_call(monkeypatch):
    monkeypatch.delenv("TEXT_MODEL", raising=False)
    assert llm.text_model() == "none"
    class Boom:
        def __init__(self, *a, **k):
            raise AssertionError("no network call when TEXT_MODEL=none")
    monkeypatch.setattr(llm.httpx, "AsyncClient", Boom)
    assert asyncio.run(llm.chat("hello")) == ""
    monkeypatch.setenv("TEXT_MODEL", "something-else")
    assert llm.text_model() == "none"
    assert client.get("/config").json()["text_model"] == "none"


def test_write_text_is_optional_and_checked(monkeypatch):
    body = client.post("/quick-plan", json={"city": "Chennai", "budget_inr": 2000, "vibes": ["chill"]}).json()
    token = body["token"]
    monkeypatch.delenv("TEXT_MODEL", raising=False)
    assert client.post(f"/plan/{token}/write-text").status_code == 409

    from app.services import writer
    async def fake_chat(prompt, **kwargs):
        return "A calm, pretty spot for an easy afternoon together."
    monkeypatch.setenv("TEXT_MODEL", "ollama")
    monkeypatch.setattr(writer, "chat", fake_chat)
    res = client.post(f"/plan/{token}/write-text")
    assert res.status_code == 200
    first_stop = res.json()[0]["stops"][0]
    assert first_stop["why_picked"] == "A calm, pretty spot for an easy afternoon together."
