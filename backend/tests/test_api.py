"""
Integration tests for FastAPI endpoints:
Session flow, taste confirmation, match summary, itinerary generation, and stop swap.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import create_db_and_tables
from app.db import engine
from app.models.schema import SessionDB
from sqlmodel import Session as DBSession, select

@pytest.fixture(autouse=True)
def setup_db():
    create_db_and_tables()

client = TestClient(app)


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_rejects_invalid_session_window_and_upload_type():
    invalid = client.post("/sessions/", json={
        "date": "not-a-date",
        "time_start": "22:00",
        "time_end": "12:00",
        "budget_inr": -1,
        "start_area": "Alwarpet",
        "max_travel_minutes": 0,
        "slots_enabled": [],
    })
    assert invalid.status_code == 422

    unsupported_city = client.post("/sessions/", json={
        "date": "2026-10-04",
        "time_start": "12:00",
        "time_end": "22:00",
        "budget_inr": 5000,
        "city": "Bengaluru",
        "start_area": "Indiranagar",
        "max_travel_minutes": 45,
        "slots_enabled": ["lunch", "dinner"],
    })
    assert unsupported_city.status_code == 422

    created = client.post("/sessions/", json={
        "date": "2026-10-04",
        "time_start": "12:00",
        "time_end": "22:00",
        "budget_inr": 5000,
        "start_area": "Alwarpet",
        "max_travel_minutes": 45,
        "slots_enabled": ["lunch", "dinner"],
    }).json()
    unsupported = client.post(
        f"/taste/{created['token_a']}/upload",
        files={"file": ("profile.txt", b"quiet cafe", "text/plain")},
    )
    assert unsupported.status_code == 415


def test_full_date_pilot_flow():
    # 1. Partner A creates session
    session_payload = {
        "date": "2026-10-04",
        "time_start": "12:00",
        "time_end": "22:30",
        "budget_inr": 5000,
        "city": "Chennai",
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
    assert res_b.json()["city"] == "Chennai"
    assert res_b.json()["budget_inr"] == 5000

    private_limits = client.post(
        f"/sessions/{token_b}/limits",
        json={"budget_inr": 4800, "max_travel_minutes": 40},
    )
    assert private_limits.status_code == 200

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
    assert plans[0]["total_cost"] <= 4800

    # 7. Stop Swap test
    res_swap = None
    for stop_index in range(len(plans[0]["stops"])):
        candidate_response = client.post(f"/plan/{token_a}/swap/0/{stop_index}?apply=false")
        if candidate_response.status_code == 200:
            res_swap = candidate_response
            break
    assert res_swap is not None, "The demo dataset must provide at least one constraint-safe swap"
    assert res_swap.status_code == 200
    swap_diff = res_swap.json()
    assert "old_venue_name" in swap_diff
    assert "new_stop" in swap_diff
    assert "budget_ok" in swap_diff
    assert swap_diff["budget_ok"] is True
    assert "schedule_change" in swap_diff
    swapped_plan = swap_diff["updated_plan"]
    assert all(swapped_plan["constraints_ok"].values())
    persisted_before_apply = client.get(f"/plan/{token_a}/current").json()[0]
    assert persisted_before_apply != swapped_plan
    applied_swap = client.post(f"/plan/{token_a}/swap/0/{stop_index}?apply=true")
    assert applied_swap.status_code == 200
    assert applied_swap.json()["applied"] is True

    # Rain mode is a fresh indoor-only solve, not unchecked substitutions.
    rain = client.post(f"/plan/{token_a}/rain-mode/0")
    assert rain.status_code == 200
    rain_plan = rain.json()["rain_plan"]
    assert rain_plan["rain_mode_active"] is True
    assert all(stop["venue"]["indoor"] for stop in rain_plan["stops"])
    assert all(rain_plan["constraints_ok"].values())

    # Surprise mode hides venue identity from B but not the verified schedule/cost.
    with DBSession(engine) as db:
        row = db.exec(select(SessionDB).where(SessionDB.token_a == token_a)).first()
        row.surprise_mode = True
        row.date = "2099-10-04"
        db.add(row)
        db.commit()
    hidden = client.get(f"/plan/{token_b}/current")
    assert hidden.status_code == 200
    assert hidden.json()[0]["stops"][0]["venue"]["name"].startswith("Surprise ")
    locked_swap = client.post(f"/plan/{token_b}/swap/0/0")
    assert locked_swap.status_code == 403

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

    # Couple memory is visible through either private session token.
    res_insights_b = client.get(f"/memory/{token_b}/insights")
    assert res_insights_b.status_code == 200
    assert res_insights_b.json()["total_reviews"] >= 1

    # 10. GDPR delete my data
    res_del = client.delete(f"/taste/{token_a}")
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "all_partner_data_deleted"
    assert client.get(f"/taste/{token_a}").json() == {}
    assert client.get(f"/plan/{token_a}/current").status_code == 404
