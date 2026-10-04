"""
Tests for deterministic date planner, beam search, and constraint enforcement.
"""
import json
import pytest
from app.models.schema import SessionDB, TasteCard, SlotType, Venue
from app.services.planner import (
    plan_date,
    build_rain_mode_plan,
    load_venues,
    haversine_km,
    travel_minutes,
    is_open,
    apply_venue_replacement,
)


def test_venues_dataset_integrity():
    venues = load_venues()
    assert len(venues) >= 50, "Multi-city venue dataset should contain at least 50 venues"
    assert {v.city for v in venues} == {"Chennai", "Coimbatore", "Madurai"}
    for v in venues:
        assert 8.0 < v.lat < 14.0, f"Lat out of Tamil Nadu bounds for {v.name}"
        assert 76.0 < v.lng < 81.0, f"Lng out of Tamil Nadu bounds for {v.name}"
        assert v.avg_cost_for_two >= 0
        assert v.type in list(SlotType)
        assert len(v.open_hours) == 7


@pytest.mark.parametrize(("city", "area"), [
    ("Chennai", "Alwarpet"),
    ("Coimbatore", "R.S. Puram"),
    ("Madurai", "Anna Nagar"),
])
def test_plans_stay_inside_selected_city(city, area):
    session = SessionDB(
        token_a=f"{city}-a", token_b=f"{city}-b", city=city,
        date="2026-10-05", time_start="12:00", time_end="22:30",
        budget_inr=6500, start_area=area, max_travel_min=45,
        surprise_mode=False,
        slots_enabled=json.dumps(["lunch", "activity", "cafe", "sunset", "dinner"]),
    )
    plans = plan_date(session, TasteCard(vibes=["romantic"]), TasteCard(vibes=["romantic"]))

    assert plans, f"Expected a complete or adapted plan for {city}"
    assert all(stop.venue.city == city for plan in plans for stop in plan.stops)
    assert all(
        not stop.backup_venue or stop.backup_venue.city == city
        for plan in plans for stop in plan.stops
    )


def test_haversine_and_travel():
    # Alwarpet to Besant Nagar (~6 km)
    dist = haversine_km(13.0336, 80.2520, 12.9998, 80.2700)
    assert 4.0 <= dist <= 8.0
    time_min = travel_minutes(13.0336, 80.2520, 12.9998, 80.2700)
    assert 10.0 <= time_min <= 40.0


def test_open_hours_require_entire_visit_to_fit():
    venue = Venue(
        id="hours-test",
        name="Hours Test",
        type="cafe",
        area="Adyar",
        lat=13.0,
        lng=80.25,
        avg_cost_for_two=500,
        typical_duration_min=60,
        open_hours={day: "10:00-12:00,17:00-22:00" for day in [
            "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
        ]},
    )
    assert is_open(venue, "monday", "10:30", "11:30") is True
    assert is_open(venue, "monday", "11:30", "12:30") is False
    assert is_open(venue, "monday", "12:30", "13:00") is False


def test_plan_date_hard_constraints():
    session = SessionDB(
        token_a="test_a",
        token_b="test_b",
        date="2026-10-04",
        time_start="12:00",
        time_end="22:30",
        budget_inr=5000,
        start_area="Alwarpet",
        max_travel_min=45,
        surprise_mode=False,
        slots_enabled=json.dumps(["lunch", "activity", "cafe", "sunset", "dinner"]),
    )
    taste_a = TasteCard(
        cuisines=["south-indian", "continental"],
        vibes=["romantic", "artsy"],
        dietary_signals=["vegetarian"],
        dislikes=["loud"],
    )
    taste_b = TasteCard(
        cuisines=["continental", "cafe"],
        vibes=["romantic", "quiet"],
        dislikes=["crowded"],
    )

    plans = plan_date(session, taste_a, taste_b)
    assert len(plans) > 0, "Should generate at least one valid plan"

    top = plans[0]
    # 1. Total cost <= budget
    assert top.total_cost <= 5000
    assert top.budget_remaining == 5000 - top.total_cost

    # 2. Vegetarian constraint: all food stops must be veg_friendly
    for index, stop in enumerate(top.stops):
        assert stop.venue.veg_friendly is True
        # 3. Dislikes excluded
        tags = [t.lower() for t in stop.venue.vibe_tags + stop.venue.cuisine_tags]
        assert "loud" not in tags
        assert "crowded" not in tags
        # 4. Backup venue assigned
        if stop.backup_venue:
            assert stop.backup_venue.id != stop.venue.id
            assert apply_venue_replacement(session, top, index, stop.backup_venue) is not None


def test_rain_mode_plan():
    session = SessionDB(
        token_a="test_a",
        token_b="test_b",
        date="2026-10-04",
        time_start="12:00",
        time_end="22:30",
        budget_inr=6000,
        start_area="Alwarpet",
        max_travel_min=45,
        surprise_mode=False,
        slots_enabled=json.dumps(["lunch", "activity", "cafe", "sunset", "dinner"]),
    )
    taste_a = TasteCard(vibes=["romantic"])
    taste_b = TasteCard(vibes=["romantic"])
    plans = plan_date(session, taste_a, taste_b)
    assert len(plans) > 0

    rain_plan, note = build_rain_mode_plan(plans[0], "sunday")
    assert rain_plan.rain_mode_active is True
    assert len(note) > 0
    # Every stop in rain plan should be indoor
    for stop in rain_plan.stops:
        assert stop.venue.indoor is True, f"Rain stop {stop.venue.name} should be indoor"


def test_low_budget_adapts_to_a_valid_two_stop_date():
    session = SessionDB(
        token_a="budget_a",
        token_b="budget_b",
        date="2026-10-04",
        time_start="12:00",
        time_end="22:30",
        budget_inr=5000,
        budget_b_inr=3000,
        start_area="Alwarpet",
        max_travel_min=35,
        surprise_mode=False,
        slots_enabled=json.dumps(["lunch", "activity", "cafe", "sunset", "dinner"]),
    )
    plans = plan_date(
        session,
        TasteCard(cuisines=["cafe-bakery"], dislikes=["loud", "rush"]),
        TasteCard(cuisines=["cafe-bakery"], dislikes=["loud", "rush"]),
    )

    assert plans, "Planner should reduce the itinerary instead of returning no plan"
    assert all(2 <= len(plan.stops) < 5 for plan in plans)
    assert all(plan.total_cost <= 3000 for plan in plans)
    assert all(all(plan.constraints_ok.values()) for plan in plans)
