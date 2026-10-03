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


def is_open(venue: Venue, day_name: str, hhmm: str, departure_hhmm: str | None = None) -> bool:
    """Check that a visit falls fully inside one opening-hours shift."""
    hours = venue.open_hours.get(day_name.lower())
    if not hours or hours.lower() == "closed":
        return False
    try:
        arrival = datetime.strptime(hhmm, "%H:%M")
        departure = datetime.strptime(departure_hhmm or hhmm, "%H:%M")
        if departure < arrival:
            departure += timedelta(days=1)
        shifts = hours.split(",")
        for shift in shifts:
            shift = shift.strip()
            if not shift or "-" not in shift:
                continue
            open_s, close_s = shift.split("-")
            open_dt = datetime.strptime(open_s.strip(), "%H:%M")
            close_dt = datetime.strptime(close_s.strip(), "%H:%M")
            if close_dt < open_dt:
                close_dt += timedelta(days=1)
                if arrival < open_dt:
                    arrival += timedelta(days=1)
                    departure += timedelta(days=1)
            if open_dt <= arrival and departure <= close_dt:
                return True
        return False
    except Exception:
        return False


def next_open_visit(
    venue: Venue,
    day_name: str,
    earliest_arrival: datetime,
    duration_minutes: int,
) -> tuple[datetime, datetime] | None:
    """Return the earliest same-day visit that fits fully within an opening shift."""
    hours = venue.open_hours.get(day_name.lower())
    if not hours or hours.lower() == "closed":
        return None
    for shift in hours.split(","):
        try:
            open_s, close_s = shift.strip().split("-", 1)
            open_time = datetime.strptime(open_s.strip(), "%H:%M").time()
            close_time = datetime.strptime(close_s.strip(), "%H:%M").time()
        except ValueError:
            continue
        open_dt = datetime.combine(earliest_arrival.date(), open_time)
        close_dt = datetime.combine(earliest_arrival.date(), close_time)
        if close_dt < open_dt:
            close_dt += timedelta(days=1)
        arrival = max(earliest_arrival, open_dt)
        departure = arrival + timedelta(minutes=duration_minutes)
        if departure <= close_dt:
            return arrival, departure
    return None


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


def apply_venue_replacement(
    session: SessionDB,
    plan: DatePlan,
    stop_index: int,
    replacement: Venue,
) -> DatePlan | None:
    """Return a fully revalidated copy with one venue replaced, or None if infeasible."""
    if stop_index < 0 or stop_index >= len(plan.stops):
        return None
    result = plan.model_copy(deep=True)
    target = result.stops[stop_index]
    if replacement.type != target.slot or replacement.id == target.venue.id:
        return None

    budget = min(session.budget_inr, session.budget_b_inr) if session.budget_b_inr else session.budget_inr
    new_total = result.total_cost - target.cost + replacement.avg_cost_for_two
    if new_total > budget:
        return None

    base_date = datetime.strptime(session.date, "%Y-%m-%d")
    day_name = base_date.strftime("%A").lower()
    session_end = datetime.combine(base_date.date(), datetime.strptime(session.time_end, "%H:%M").time())
    if stop_index > 0:
        previous = result.stops[stop_index - 1]
        current_time = datetime.combine(base_date.date(), datetime.strptime(previous.departure_time, "%H:%M").time())
        previous_coords = (previous.venue.lat, previous.venue.lng)
    else:
        current_time = datetime.combine(base_date.date(), datetime.strptime(session.time_start, "%H:%M").time())
        previous_coords = CHENNAI_AREAS.get(session.start_area.strip().lower(), (13.0336, 80.2520))

    for index in range(stop_index, len(result.stops)):
        stop = result.stops[index]
        venue = replacement if index == stop_index else stop.venue
        leg = int(round(travel_minutes(previous_coords[0], previous_coords[1], venue.lat, venue.lng)))
        if leg > session.max_travel_min:
            return None
        earliest_arrival = current_time + timedelta(minutes=leg)
        duration = venue.typical_duration_min or DEFAULT_DURATIONS.get(stop.slot, 60)
        visit = next_open_visit(venue, day_name, earliest_arrival, duration)
        if not visit:
            return None
        arrival, departure = visit
        if departure > session_end:
            return None

        stop.venue = venue
        stop.cost = venue.avg_cost_for_two
        stop.arrival_time = arrival.strftime("%H:%M")
        stop.departure_time = departure.strftime("%H:%M")
        stop.travel_from_prev_min = leg
        stop.distance_from_prev_km = round(
            haversine_km(previous_coords[0], previous_coords[1], venue.lat, venue.lng) * ROAD_FACTOR,
            1,
        )
        if index == stop_index:
            stop.why_picked = ""
            stop.backup_venue = None
        current_time = departure
        previous_coords = (venue.lat, venue.lng)

    result.total_cost = sum(stop.cost for stop in result.stops)
    result.budget_remaining = budget - result.total_cost
    result.total_travel_min = sum(stop.travel_from_prev_min for stop in result.stops)
    result.constraints_ok = {"budget": True, "hours": True, "travel": True, "dietary": True}
    return result


def plan_date(
    session: SessionDB,
    taste_a: TasteCard,
    taste_b: TasteCard,
    *,
    indoor_only: bool = False,
) -> list[DatePlan]:
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

    dt_start = datetime.strptime(f"{session.date} {session.time_start}", "%Y-%m-%d %H:%M")
    dt_end = datetime.strptime(f"{session.date} {session.time_end}", "%Y-%m-%d %H:%M")
    if dt_end <= dt_start:
        return []

    day_name = dt_start.strftime("%A").lower()

    def is_candidate(v: Venue, s_type: SlotType) -> bool:
        if v.type != s_type:
            return False
        if indoor_only and not v.indoor:
            return False
        tags = [t.lower() for t in v.vibe_tags + v.cuisine_tags]
        if any(d in tags for d in dislikes):
            return False
        if any("veg" in d.lower() for d in dietary) and not v.veg_friendly:
            return False
        return True

    # Build candidates per slot, sorted by score with budget tier diversity
    slot_cands: dict[SlotType, list[Venue]] = {}
    slot_all_cands: dict[SlotType, list[Venue]] = {}
    for s in requested_slots:
        cands = [v for v in venues if is_candidate(v, s)]
        # Sort candidates: combine raw score with value
        cands.sort(key=lambda v: (score_venue(v, constraints, s), -v.avg_cost_for_two), reverse=True)
        slot_all_cands[s] = cands
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

                earliest_arrival = cur_t + timedelta(minutes=int(round(travel_min)))
                total_travel += int(travel_min)

                dur = venue.typical_duration_min or DEFAULT_DURATIONS.get(slot, 60)
                visit = next_open_visit(venue, day_name, earliest_arrival, dur)
                if not visit:
                    valid = False
                    break
                arrival_t, depart_t = visit
                arrive_s = arrival_t.strftime("%H:%M")

                if depart_t > dt_end:
                    valid = False
                    break

                total_cost += venue.avg_cost_for_two
                if total_cost > budget:
                    valid = False
                    break

                stops.append(PlannedStop(
                    slot=slot,
                    venue=venue,
                    arrival_time=arrive_s,
                    departure_time=depart_t.strftime("%H:%M"),
                    cost=venue.avg_cost_for_two,
                    travel_from_prev_min=int(round(travel_min)),
                    distance_from_prev_km=round(dist_km, 1),
                    backup_venue=None,
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
        quality_sum = sum(score_venue(s.venue, constraints, s.slot) for s in p.stops)
        travel_pen = p.total_travel_min * 0.04
        budget_bonus = min(2.5, p.budget_remaining / 800.0)
        food_stops = [s for s in p.stops if s.slot in (SlotType.lunch, SlotType.cafe, SlotType.dinner)]
        primary_cuisines = [s.venue.cuisine_tags[0].lower() for s in food_stops if s.venue.cuisine_tags]
        variety_bonus = len(set(primary_cuisines)) * 0.7
        repetition_penalty = (len(primary_cuisines) - len(set(primary_cuisines))) * 1.2
        flexible_stops = sum(
            1
            for index, stop in enumerate(p.stops)
            if any(
                apply_venue_replacement(session, p, index, candidate)
                for candidate in slot_all_cands.get(stop.slot, [])
                if candidate.id != stop.venue.id
            )
        )
        return quality_sum + budget_bonus + variety_bonus + flexible_stops * 2.0 - repetition_penalty - travel_pen

    plans.sort(key=plan_rank_score, reverse=True)
    top_plans = plans[:3]

    # Backups are real constraint-safe swaps, not merely similar venues.
    for plan in top_plans:
        for index, stop in enumerate(plan.stops):
            ranked_alternatives = [v for v in slot_all_cands.get(stop.slot, []) if v.id != stop.venue.id]
            for alternative in ranked_alternatives:
                if apply_venue_replacement(session, plan, index, alternative):
                    stop.backup_venue = alternative
                    break
    return top_plans


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
            if not cands:
                # Check indoor venues of the same slot open anytime during the evening
                cands = [
                    v for v in venues
                    if v.type == stop.slot and v.indoor and v.id != stop.venue.id
                ]
            if not cands and stop.slot == SlotType.sunset:
                # If no indoor sunset exists, substitute with cozy indoor cafe or evening activity
                cands = [
                    v for v in venues
                    if v.type in (SlotType.cafe, SlotType.activity) and v.indoor and v.id != stop.venue.id
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
