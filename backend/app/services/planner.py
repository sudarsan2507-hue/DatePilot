"""
Deterministic date planner — pure Python, no LLM.
Beam-searches venue combos that satisfy all hard constraints,
scores soft criteria (taste overlap, rating, travel efficiency, variety),
and returns top-3 plans with ranked backup venues and constraint checks.
"""
from __future__ import annotations
import json
import math
import itertools
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from app.models.schema import (
    Venue, DatePlan, PlannedStop, TasteCard, SlotType, SessionDB
)

VENUES_PATH = Path(__file__).parent.parent.parent / "data" / "venues.json"
ROAD_FACTOR = 1.4      # haversine × 1.4 ≈ Chennai road distance
AVG_SPEED_KMH = 24.0   # Chennai city traffic average speed

CHENNAI_AREAS: dict[str, tuple[float, float]] = {
    "alwarpet": (13.0336, 80.2520),
    "adyar": (13.0033, 80.2552),
    "besant nagar": (12.9998, 80.2700),
    "mylapore": (13.0331, 80.2687),
    "nungambakkam": (13.0617, 80.2415),
    "t. nagar": (13.0418, 80.2341),
    "anna nagar": (13.0850, 80.2101),
    "gopalapuram": (13.0519, 80.2520),
    "royapettah": (13.0559, 80.2492),
    "egmore": (13.0732, 80.2609),
    "guindy": (13.0075, 80.2206),
    "kotturpuram": (13.0181, 80.2407),
    "thiruvanmiyur": (12.9868, 80.2612),
    "ecr": (12.9463, 80.2561),
    "neelankarai": (12.9463, 80.2561),
    "injambakkam": (12.9169, 80.2536),
    "muttukadu": (12.8228, 80.2444),
    "kovalam": (12.7915, 80.2520),
    "marina": (13.0500, 80.2824),
    "velachery": (12.9759, 80.2212),
}

DEFAULT_DURATIONS: dict[SlotType, int] = {
    SlotType.lunch: 70,
    SlotType.activity: 75,
    SlotType.cafe: 45,
    SlotType.sunset: 40,
    SlotType.dinner: 75,
}


def load_venues() -> list[Venue]:
    with open(VENUES_PATH, encoding="utf-8") as f:
        return [Venue.model_validate(v) for v in json.load(f)]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p = math.pi / 180.0
    a = (
        math.sin((lat2 - lat1) * p / 2) ** 2
        + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lng2 - lng1) * p / 2) ** 2
    )
    return 2.0 * r * math.asin(math.sqrt(max(0.0, min(1.0, a))))


def travel_minutes(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    km = haversine_km(lat1, lng1, lat2, lng2) * ROAD_FACTOR
    return max(6.0, (km / AVG_SPEED_KMH) * 60.0)


def is_open(venue: Venue, day_name: str, hhmm: str) -> bool:
    """Check if venue is open at given day and HH:MM time, supporting split shift hours."""
    hours = venue.open_hours.get(day_name.lower())
    if not hours or hours.lower() == "closed":
        return False
    try:
        t = datetime.strptime(hhmm, "%H:%M").time()
        shifts = hours.split(",")
        for shift in shifts:
            shift = shift.strip()
            if not shift or "-" not in shift:
                continue
            open_s, close_s = shift.split("-")
            open_t = datetime.strptime(open_s.strip(), "%H:%M").time()
            close_t = datetime.strptime(close_s.strip(), "%H:%M").time()
            if open_t <= close_t:
                if open_t <= t <= close_t:
                    return True
            else:
                if t >= open_t or t <= close_t:
                    return True
        return False
    except Exception:
        return True


def merge_constraints(a: TasteCard, b: TasteCard) -> dict:
    """Deterministic constraint merge."""
    dietary = sorted(list(set(a.dietary_signals + b.dietary_signals)))
    dislikes = sorted(list(set(a.dislikes + b.dislikes)))
    shared_vibes = [v for v in a.vibes if v in b.vibes]
    shared_cuisines = [c for c in a.cuisines if c in b.cuisines]
    shared_activities = [act for act in a.activities if act in b.activities]

    return {
        "dietary": dietary,
        "dislikes": [d.lower() for d in dislikes],
        "shared_vibes": shared_vibes,
        "shared_cuisines": shared_cuisines,
        "shared_activities": shared_activities,
    }


def score_venue(venue: Venue, constraints: dict, slot: SlotType) -> float:
    """Score individual venue based on rating, preference overlap, and affordability."""
    score = venue.rating * 1.5

    vibe_matches = sum(1 for v in constraints.get("shared_vibes", []) if v.lower() in [vt.lower() for vt in venue.vibe_tags])
    score += vibe_matches * 1.2

    cuisine_matches = sum(1 for c in constraints.get("shared_cuisines", []) if c.lower() in [ct.lower() for ct in venue.cuisine_tags])
    score += cuisine_matches * 1.2

    act_matches = sum(1 for a in constraints.get("shared_activities", []) if a.lower() in [vt.lower() for vt in venue.vibe_tags])
    score += act_matches * 0.8

    return score


def plan_date(session: SessionDB, taste_a: TasteCard, taste_b: TasteCard) -> list[DatePlan]:
    """Generates top viable date plans fitting budget, time, and travel constraints."""
    venues = load_venues()
    slots_raw = json.loads(session.slots_enabled)
    requested_slots = [SlotType(s) for s in slots_raw]

    # Budget is min of both limits
    budget = session.budget_inr
    if session.budget_b_inr and session.budget_b_inr > 0:
        budget = min(budget, session.budget_b_inr)

    constraints = merge_constraints(taste_a, taste_b)
    dietary = constraints["dietary"]
    dislikes = constraints["dislikes"]

    try:
        dt_start = datetime.strptime(f"{session.date} {session.time_start}", "%Y-%m-%d %H:%M")
        dt_end = datetime.strptime(f"{session.date} {session.time_end}", "%Y-%m-%d %H:%M")
    except Exception:
        dt_start = datetime.strptime("2026-10-04 12:00", "%Y-%m-%d %H:%M")
        dt_end = datetime.strptime("2026-10-04 22:30", "%Y-%m-%d %H:%M")

    day_name = dt_start.strftime("%A").lower()

    def is_candidate(v: Venue, s_type: SlotType) -> bool:
        if v.type != s_type:
            return False
        tags = [t.lower() for t in v.vibe_tags + v.cuisine_tags]
        if any(d in tags for d in dislikes):
            return False
        if any("veg" in d.lower() for d in dietary) and not v.veg_friendly:
            return False
        return True

    # Build candidates per slot, sorted by score with budget tier diversity
    slot_cands: dict[SlotType, list[Venue]] = {}
    for s in requested_slots:
        cands = [v for v in venues if is_candidate(v, s)]
        # Sort candidates: combine raw score with value
        cands.sort(key=lambda v: (score_venue(v, constraints, s), -v.avg_cost_for_two), reverse=True)
        # Keep top 6 candidates per slot to allow broad budget exploration
        slot_cands[s] = cands[:6] if cands else []

    start_coords = CHENNAI_AREAS.get(session.start_area.strip().lower(), (13.0336, 80.2520))

    def solve_for_slots(slots_to_try: list[SlotType]) -> list[DatePlan]:
        candidate_lists = [slot_cands.get(s, []) for s in slots_to_try]
        if any(len(c) == 0 for c in candidate_lists):
            return []

        found_plans: list[DatePlan] = []
        for combo in itertools.product(*candidate_lists):
            stops: list[PlannedStop] = []
            cur_t = dt_start
            total_cost = 0
            total_travel = 0
            prev_coords = start_coords
            valid = True

            for slot, venue in zip(slots_to_try, combo):
                travel_min = travel_minutes(prev_coords[0], prev_coords[1], venue.lat, venue.lng)
                dist_km = haversine_km(prev_coords[0], prev_coords[1], venue.lat, venue.lng) * ROAD_FACTOR

                if travel_min > session.max_travel_min:
                    valid = False
                    break

                cur_t += timedelta(minutes=int(travel_min))
                total_travel += int(travel_min)
                arrive_s = cur_t.strftime("%H:%M")

                dur = venue.typical_duration_min or DEFAULT_DURATIONS.get(slot, 60)
                depart_t = cur_t + timedelta(minutes=dur)

                if depart_t > dt_end:
                    valid = False
                    break

                if not is_open(venue, day_name, arrive_s):
                    valid = False
                    break

                total_cost += venue.avg_cost_for_two
                if total_cost > budget:
                    valid = False
                    break

                # Backup venue selection (next best open candidate for this slot)
                backups = [
                    b for b in slot_cands.get(slot, [])
                    if b.id != venue.id and is_open(b, day_name, arrive_s)
                ]
                backup = backups[0] if backups else None

                stops.append(PlannedStop(
                    slot=slot,
                    venue=venue,
                    arrival_time=arrive_s,
                    departure_time=depart_t.strftime("%H:%M"),
                    cost=venue.avg_cost_for_two,
                    travel_from_prev_min=int(round(travel_min)),
                    distance_from_prev_km=round(dist_km, 1),
                    backup_venue=backup,
                ))
                cur_t = depart_t
                prev_coords = (venue.lat, venue.lng)

            if valid and len(stops) == len(slots_to_try):
                plan = DatePlan(
                    stops=stops,
                    total_cost=total_cost,
                    budget_remaining=budget - total_cost,
                    total_travel_min=total_travel,
                    constraints_ok={
                        "budget": total_cost <= budget,
                        "hours": True,
                        "travel": total_travel <= (session.max_travel_min * len(stops)),
                        "dietary": True,
                    },
                    matched_vibes=constraints["shared_vibes"],
                    matched_cuisines=constraints["shared_cuisines"],
                )
                found_plans.append(plan)
                if len(found_plans) >= 20:
                    break

        return found_plans

    # Try full requested slots first
    plans = solve_for_slots(requested_slots)

    # If full slots don't fit within time or budget, adapt to 4 or 3 slot subsets
    if not plans and len(requested_slots) > 3:
        # Try subsets without sunset or cafe
        subsets = [
            [s for s in requested_slots if s != SlotType.sunset],
            [s for s in requested_slots if s != SlotType.activity],
            [s for s in requested_slots if s in (SlotType.lunch, SlotType.cafe, SlotType.dinner)],
            [s for s in requested_slots if s in (SlotType.lunch, SlotType.activity, SlotType.dinner)],
        ]
        for sub in subsets:
            plans = solve_for_slots(sub)
            if plans:
                break

    # Score and rank plans: balance quality ratings + travel efficiency + budget reserve
    def plan_rank_score(p: DatePlan) -> float:
        rating_sum = sum(s.venue.rating for s in p.stops)
        travel_pen = p.total_travel_min * 0.04
        budget_bonus = min(2.5, p.budget_remaining / 800.0)
        return rating_sum + budget_bonus - travel_pen

    plans.sort(key=plan_rank_score, reverse=True)
    return plans[:3]


def build_rain_mode_plan(plan: DatePlan, day_name: str) -> Tuple[DatePlan, str]:
    """Produce Plan B (all-indoor swaps) for any outdoor stop in the plan."""
    venues = load_venues()
    new_stops: list[PlannedStop] = []
    swapped_names: list[str] = []

    for stop in plan.stops:
        if stop.venue.indoor:
            new_stops.append(stop)
        else:
            cands = [
                v for v in venues
                if v.type == stop.slot and v.indoor and v.id != stop.venue.id
                and is_open(v, day_name, stop.arrival_time)
            ]
            if cands:
                cands.sort(key=lambda x: x.rating, reverse=True)
                sub = cands[0]
                swapped = stop.model_copy(deep=True)
                swapped.venue = sub
                swapped.cost = sub.avg_cost_for_two
                swapped.backup_venue = stop.venue
                swapped.why_picked = f"Indoor sanctuary swap: {sub.name} in {sub.area}."
                new_stops.append(swapped)
                swapped_names.append(f"{stop.slot.value} ({sub.name})")
            else:
                new_stops.append(stop)

    new_cost = sum(s.cost for s in new_stops)
    note = (
        f"Rain Protocol: If rain starts in Chennai, seamlessly swap: {', '.join(swapped_names)}."
        if swapped_names else "All stops in this plan already have indoor protection."
    )

    rain_plan = plan.model_copy(deep=True)
    rain_plan.stops = new_stops
    rain_plan.total_cost = new_cost
    rain_plan.budget_remaining = max(0, plan.total_cost + plan.budget_remaining - new_cost)
    rain_plan.rain_mode_active = True
    rain_plan.rain_trigger_note = note
    return rain_plan, note
