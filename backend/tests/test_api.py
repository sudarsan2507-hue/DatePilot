"""
Integration tests for FastAPI endpoints:
Session flow, taste confirmation, match summary, itinerary generation, and stop swap.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import create_db_and_tables

@pytest.fixture(autouse=True)
def setup_db():
    create_db_and_tables()

client = TestClient(app)


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_full_date_pilot_flow():
    # 1. Partner A creates session
    session_payload = {
        "date": "2026-10-04",
        "time_start": "12:00",
        "time_end": "22:30",
        "budget_inr": 5000,
        "start_area": "Alwarpet",
        "max_travel_minutes": 45,
        "surprise_mode": False,
        "slots_enabled": ["lunch", "activity", "cafe", "sunset", "dinner"],
    }
    res = client.post("/sessions/", json=session_payload)
    assert res.status_code == 200
    data = res.json()
    token_a = data["token_a"]
    token_b = data["token_b"]

    # 2. Partner B views session info
    res_b = client.get(f"/sessions/{token_b}")
    assert res_b.status_code == 200
    assert res_b.json()["partner"] == "b"
    assert res_b.json()["budget_inr"] == 5000

    # 3. Partner A submits and confirms Taste Card
    res_quiz_a = client.post(
        f"/taste/{token_a}/quiz",
        json={"cuisines": ["south-indian", "continental"], "vibes": ["artsy", "romantic"], "dietary_signals": ["vegetarian"]},
    )
    assert res_quiz_a.status_code == 200
    card_a = res_quiz_a.json()

    res_confirm_a = client.post(f"/taste/{token_a}/confirm", json=card_a)
    assert res_confirm_a.status_code == 200

    # 4. Partner B submits and confirms Taste Card
    res_quiz_b = client.post(
        f"/taste/{token_b}/quiz",
        json={"cuisines": ["continental", "cafe"], "vibes": ["romantic", "quiet"]},
    )
    card_b = res_quiz_b.json()
    res_confirm_b = client.post(f"/taste/{token_b}/confirm", json=card_b)
    assert res_confirm_b.status_code == 200

    # 5. Check match summary (private overlap, no attribution)
    res_match = client.get(f"/sessions/{token_a}/match-summary")
    assert res_match.status_code == 200
    match_data = res_match.json()
    assert match_data["ready"] is True
    assert "romantic" in match_data["shared_vibes"]
    assert "vegetarian" in match_data["dietary_rules"]

    # 6. Generate plan
    res_plan = client.post(f"/plan/{token_a}/generate")
    assert res_plan.status_code == 200
    plans = res_plan.json()
    assert len(plans) >= 1
    assert plans[0]["total_cost"] <= 5000

    # 7. Stop Swap test
    res_swap = client.post(f"/plan/{token_a}/swap/0/1")
    assert res_swap.status_code == 200
    swap_diff = res_swap.json()
    assert "old_venue_name" in swap_diff
    assert "new_stop" in swap_diff
    assert "budget_ok" in swap_diff

    # 8. Post-date rating feedback test
    feedback_payload = {
        "stop_id": "test-stop",
        "venue_name": "Writer's Cafe",
        "slot": "cafe",
        "rating": 5,
        "notes": "Cosy atmosphere and great desserts!",
    }
    res_rate = client.post(f"/memory/{token_a}/rate", json=feedback_payload)
    assert res_rate.status_code == 200
    assert res_rate.json()["status"] == "recorded"

    # 9. Memory insights
    res_insights = client.get(f"/memory/{token_a}/insights")
    assert res_insights.status_code == 200
    assert res_insights.json()["total_reviews"] >= 1

    # 10. GDPR delete my data
    res_del = client.delete(f"/taste/{token_a}")
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "all_partner_data_deleted"
