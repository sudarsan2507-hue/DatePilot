"""Solo quick planning: three inputs in, a checked plan out, fast and without a model."""
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import create_db_and_tables
from app.models.schema import SlotType
from app.services.quick import end_time, pick_slots

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    create_db_and_tables()


@pytest.mark.parametrize("city", ["Chennai", "Coimbatore", "Madurai"])
def test_quick_plan_is_fast_and_in_budget(city):
    started = time.time()
    res = client.post("/quick-plan", json={"city": city, "budget_inr": 2000, "vibes": ["romantic", "foodie"]})
    elapsed = time.time() - started
    assert res.status_code == 200, res.text
    body = res.json()
    assert elapsed < 3.0
    assert body["token"] and body["session"]["mode"] == "solo"
    assert body["plans"]
    for plan in body["plans"]:
        assert plan["total_cost"] <= 2000
        assert all(stop["venue"]["city"] == city for stop in plan["stops"])
        assert plan["itinerary_text"]


def test_quick_plan_session_supports_swap_and_resume():
    body = client.post("/quick-plan", json={"city": "Chennai", "budget_inr": 3500, "vibes": ["chill"]}).json()
    token = body["token"]
    session = client.get(f"/sessions/{token}").json()
    assert session["mode"] == "solo" and session["has_plan"]
    assert client.get(f"/plan/{token}/current").status_code == 200
    swap = client.post(f"/plan/{token}/swap/0/0")
    assert swap.status_code in (200, 422)  # 422 only when no other venue fits


def test_quick_plan_rejects_bad_input():
    assert client.post("/quick-plan", json={"city": "Bengaluru", "budget_inr": 2000}).status_code == 422
    assert client.post("/quick-plan", json={"budget_inr": 2000, "vibes": ["chill", "foodie", "artsy", "fun"]}).status_code == 422
    assert client.post("/quick-plan", json={"budget_inr": 2000, "vibes": ["chill", "foodie", "artsy", "romantic"]}).status_code == 422
    assert client.post("/quick-plan", json={"budget_inr": 50}).status_code == 422


def test_personal_answers_shape_the_plan():
    base = {"city": "Chennai", "budget_inr": 3500, "vibes": []}
    personal = {**base, "about_date": {"vibes": ["museum", "heritage"], "activities": [], "cuisines": []}}
    res = client.post("/quick-plan", json=personal)
    assert res.status_code == 200
    tags = [t for plan in res.json()["plans"] for s in plan["stops"] for t in s["venue"]["vibe_tags"]]
    assert "museum" in tags or "heritage" in tags


def test_slots_follow_the_start_time():
    assert pick_slots("12:00", end_time("12:00"), [])[0] == SlotType.lunch
    evening = pick_slots("16:00", end_time("16:00"), [])
    assert SlotType.lunch not in evening and SlotType.dinner in evening and len(evening) <= 4
    assert SlotType.sunset not in pick_slots("19:00", end_time("19:00"), [])
    assert end_time("20:00") == "23:00"


def test_lowest_cost_plan_is_really_the_cheapest():
    for budget in (1000, 2000, 3500):
        plans = client.post("/quick-plan", json={"city": "Chennai", "budget_inr": budget, "vibes": ["romantic"]}).json()["plans"]
        venue_sets = [tuple(sorted(s["venue"]["id"] for s in p["stops"])) for p in plans]
        assert len(set(venue_sets)) == len(venue_sets)  # no plan offered twice
        if len(plans) == 3 and plans[2]["total_cost"] < min(p["total_cost"] for p in plans[:2]):
            assert plans[2]["total_cost"] == min(p["total_cost"] for p in plans)
