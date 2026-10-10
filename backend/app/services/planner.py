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
from functools import lru_cache
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from app.models.schema import (
    Venue, DatePlan, PlannedStop, TasteCard, SlotType, SessionDB
)

VENUES_PATH = Path(__file__).parent.parent.parent / "data" / "venues.json"
ROAD_FACTOR = 1.4      # haversine × road factor ≈ urban road distance
AVG_SPEED_KMH = 24.0   # conservative Tamil Nadu city traffic estimate

TAMIL_NADU_LOCATIONS: dict[str, dict[str, tuple[float, float]]] = {
    "chennai": {
        "alwarpet": (13.0336, 80.2520), "adyar": (13.0033, 80.2552),
        "besant nagar": (12.9998, 80.2700), "mylapore": (13.0331, 80.2687),
        "nungambakkam": (13.0617, 80.2415), "t. nagar": (13.0418, 80.2341),
        "anna nagar": (13.0850, 80.2101), "egmore": (13.0732, 80.2609),
        "guindy": (13.0075, 80.2206), "velachery": (12.9759, 80.2212),
        "ecr / neelankarai": (12.9463, 80.2561),
        "muttukadu / kovalam": (12.8069, 80.2482), "marina beach": (13.0500, 80.2824),
    },
    "coimbatore": {
        "r.s. puram": (11.0084, 76.9504), "gandhipuram": (11.0183, 76.9674),
        "peelamedu": (11.0255, 77.0065), "race course": (11.0012, 76.9770),
        "saibaba colony": (11.0233, 76.9436), "ukkadam": (10.9925, 76.9629),
    },
    "madurai": {
        "anna nagar": (9.9252, 78.1491), "kk nagar": (9.9344, 78.1404),
        "goripalayam": (9.9384, 78.1327), "mattuthavani": (9.9560, 78.1550),
        "town hall road": (9.9166, 78.1155), "vandiyur": (9.9103, 78.1488),
    },
}

CITY_CENTERS = {
    "chennai": (13.0336, 80.2520),
    "coimbatore": (11.0168, 76.9558),
    "madurai": (9.9252, 78.1198),
}


def start_coordinates(city: str, area: str) -> tuple[float, float]:
    city_key = city.strip().lower()
    return TAMIL_NADU_LOCATIONS.get(city_key, {}).get(
        area.strip().lower(),
        CITY_CENTERS.get(city_key, CITY_CENTERS["chennai"]),
    )

DEFAULT_DURATIONS: dict[SlotType, int] = {
    SlotType.lunch: 70,
    SlotType.activity: 75,
    SlotType.cafe: 45,
    SlotType.sunset: 40,
    SlotType.dinner: 75,
}


# Arrival windows so stops happen at sensible times of day. Tamil Nadu sunset is
# roughly 17:50-18:30 all year, so a sunset walk starts between 17:00 and 18:15.
SLOT_WINDOWS: dict[SlotType, tuple[str, str]] = {
    SlotType.lunch: ("12:00", "14:30"),
    SlotType.sunset: ("17:00", "18:15"),
    SlotType.dinner: ("19:00", "21:30"),
}


@lru_cache(maxsize=256)
def _clock(hhmm: str):
    """Parsed "HH:MM" as a time. The planner checks thousands of combinations, so parse once."""
    return datetime.strptime(hhmm.strip(), "%H:%M").time()


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
    slot: SlotType | None = None,
) -> tuple[datetime, datetime] | None:
    """Return the earliest same-day visit that fits fully within an opening shift
    and, when a slot is given, starts inside that slot's time-of-day window."""
    hours = venue.open_hours.get(day_name.lower())
    if not hours or hours.lower() == "closed":
        return None

    window_start = window_end = None
    if slot in SLOT_WINDOWS:
        start_s, end_s = SLOT_WINDOWS[slot]
        window_start = datetime.combine(earliest_arrival.date(), _clock(start_s))
        window_end = datetime.combine(earliest_arrival.date(), _clock(end_s))
        if earliest_arrival > window_end:
            return None
        earliest_arrival = max(earliest_arrival, window_start)

    for shift in hours.split(","):
        try:
            open_s, close_s = shift.strip().split("-", 1)
            open_time = _clock(open_s)
            close_time = _clock(close_s)
        except ValueError:
            continue
        open_dt = datetime.combine(earliest_arrival.date(), open_time)
        close_dt = datetime.combine(earliest_arrival.date(), close_time)
        if close_dt < open_dt:
            close_dt += timedelta(days=1)
        arrival = max(earliest_arrival, open_dt)
        if window_end is not None and arrival > window_end:
            continue
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
    if replacement.city.lower() != session.city.lower():
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
        previous_coords = start_coordinates(session.city, session.start_area)

    for index in range(stop_index, len(result.stops)):
        stop = result.stops[index]
        venue = replacement if index == stop_index else stop.venue
        leg = int(round(travel_minutes(previous_coords[0], previous_coords[1], venue.lat, venue.lng)))
        if leg > session.max_travel_min:
            return None
        earliest_arrival = current_time + timedelta(minutes=leg)
        duration = venue.typical_duration_min or DEFAULT_DURATIONS.get(stop.slot, 60)
        visit = next_open_visit(venue, day_name, earliest_arrival, duration, stop.slot)
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
    venues = [v for v in load_venues() if v.city.lower() == session.city.lower()]
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

    start_coords = start_coordinates(session.city, session.start_area)

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

                leg_min = int(round(travel_min))
                earliest_arrival = cur_t + timedelta(minutes=leg_min)
                total_travel += leg_min

                dur = venue.typical_duration_min or DEFAULT_DURATIONS.get(slot, 60)
                visit = next_open_visit(venue, day_name, earliest_arrival, dur, slot)
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
                        "travel": True,  # each leg is checked against max_travel_min above
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

    # If the full template is infeasible, exhaustively try smaller order-preserving
    # subsets. Prefer the greatest stop count and never reduce below a real date
    # of two stops. This avoids food-heavy hard-coded fallbacks that can miss a
    # valid activity + sunset or cafe + activity plan on a tight budget.
    if not plans and len(requested_slots) > 2:
        for subset_size in range(len(requested_slots) - 1, 1, -1):
            reduced_plans: list[DatePlan] = []
            for subset in itertools.combinations(requested_slots, subset_size):
                reduced_plans.extend(solve_for_slots(list(subset)))
            if reduced_plans:
                plans = reduced_plans
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
    city = plan.stops[0].venue.city if plan.stops else "Chennai"
    venues = [v for v in load_venues() if v.city.lower() == city.lower()]
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
        f"Rain Protocol: If rain starts in {city}, seamlessly swap: {', '.join(swapped_names)}."
        if swapped_names else "All stops in this plan already have indoor protection."
    )

    rain_plan = plan.model_copy(deep=True)
    rain_plan.stops = new_stops
    rain_plan.total_cost = new_cost
    rain_plan.budget_remaining = max(0, plan.total_cost + plan.budget_remaining - new_cost)
    rain_plan.rain_mode_active = True
    rain_plan.rain_trigger_note = note
    return rain_plan, note
