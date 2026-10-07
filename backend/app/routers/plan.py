"""
plan.py — Itinerary generation, Stop Swapping diff engine, and Rain Mode protocol.
Rules:
- Math is 100% deterministic (no LLM math errors).
- LLM enriches 'why_picked' and friendly itinerary text with strict factual bounds.
- Stop Swap re-solves that specific slot while locking all others, returning an exact diff.
"""
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from sqlmodel import Session as DBSession, select
from app.db import engine
from app.models.schema import SessionDB, TasteCard, DatePlan, PlannedStop, SlotType
from app.services.planner import (
    plan_date,
    build_rain_mode_plan,
    load_venues,
    score_venue,
    travel_minutes,
    haversine_km,
    is_open,
    ROAD_FACTOR,
    DEFAULT_DURATIONS,
    merge_constraints,
    apply_venue_replacement,
    start_coordinates,
)
from app.services.writer import write_why_picked, write_itinerary
from app.services.live_data import get_osrm_route

router = APIRouter(prefix="/plan", tags=["plan"])
IST = timezone(timedelta(hours=5, minutes=30))


@router.get("/{token}/routes/{plan_index}")
async def live_route_estimates(token: str, plan_index: int):
    """Return advisory OSRM driving legs for a saved plan.

    The deterministic planner remains authoritative; this endpoint only gives
    users a live road estimate when the public OSRM service responds.
    """
    with DBSession(engine) as db:
        row = db.exec(select(SessionDB).where(
            (SessionDB.token_a == token) | (SessionDB.token_b == token)
        )).first()
    if not row or not row.plan_json:
        raise HTTPException(status_code=404, detail="Plan not found")
    if _surprise_is_hidden(row, token):
        raise HTTPException(status_code=403, detail="The route stays hidden until the surprise date begins")
    plans = json.loads(row.plan_json)
    if plan_index < 0 or plan_index >= len(plans):
        raise HTTPException(status_code=400, detail="Invalid plan index")
    plan = DatePlan.model_validate(plans[plan_index])
    start = start_coordinates(row.city, row.start_area)
    previous = start
    legs = []
    for stop in plan.stops:
        current = (stop.venue.lat, stop.venue.lng)
        route = await get_osrm_route([previous, current], geometry=True)
        legs.append({
            "venue_name": stop.venue.name,
            "distance_km": route["distance_km"] if route else stop.distance_from_prev_km,
            "duration_min": route["duration_min"] if route else stop.travel_from_prev_min,
            "source": route["source"] if route else "Haversine estimate (OSRM unavailable)",
            # Road path for the map; a straight line when OSRM is unavailable.
            "path": route["path"] if route and route.get("path") else [list(previous), list(current)],
            "is_road": bool(route and route.get("path")),
        })
        previous = current
    return {
        "plan_index": plan_index,
        "start": {"lat": start[0], "lng": start[1], "label": f"{row.start_area}, {row.city}"},
        "legs": legs,
        "source": "OSRM with deterministic fallback",
    }


def _surprise_is_hidden(row: SessionDB, token: str) -> bool:
    if not row.surprise_mode or token != row.token_b:
        return False
    reveal_at = datetime.strptime(f"{row.date} {row.time_start}", "%Y-%m-%d %H:%M").replace(tzinfo=IST)
    return datetime.now(IST) < reveal_at


def _redact_surprise_plans(plans: list[dict], city: str) -> list[dict]:
    redacted = json.loads(json.dumps(plans))
    for plan in redacted:
        plan["itinerary_text"] = "Your partner has kept the venues as a surprise. Times, cost, and constraints are ready."
        for stop in plan.get("stops", []):
            venue = stop["venue"]
            venue.update({
                "name": f"Surprise {stop['slot'].title()}",
                "city": city,
                "area": city,
                "lat": 0.0,
                "lng": 0.0,
                "cuisine_tags": [],
                "vibe_tags": [],
                "source_url": "",
                "image_url": None,
                "image_page": None,
                "image_kind": None,
            })
            stop["why_picked"] = "A constraint-checked surprise chosen from your shared preferences."
            stop["backup_venue"] = None
    return redacted


async def _enrich_plan(plan: DatePlan, why_cache: dict | None = None) -> DatePlan:
    """Enrich plan with AI explanations and friendly itinerary narrative.
    `why_cache` lets plans that share a place reuse its reason (one model call per place)."""
    cache = why_cache if why_cache is not None else {}
    for stop in plan.stops:
        key = (stop.venue.id, stop.slot)
        if key not in cache:
            cache[key] = await write_why_picked(stop, plan.matched_vibes, plan.matched_cuisines)
        stop.why_picked = cache[key]
    plan.itinerary_text = await write_itinerary(plan)
    return plan


@router.post("/{token_a}/generate")
async def generate_plan(token_a: str):
    """Partner A triggers itinerary generation once both partners have submitted taste."""
    with DBSession(engine) as db:
        row = db.exec(select(SessionDB).where(SessionDB.token_a == token_a)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if not row.taste_a or not row.taste_b:
        raise HTTPException(status_code=400, detail="Both taste cards must be submitted first")

    taste_a = TasteCard.model_validate_json(row.taste_a)
    taste_b = TasteCard.model_validate_json(row.taste_b)

    plans = plan_date(row, taste_a, taste_b)
    if not plans:
        raise HTTPException(
            status_code=422,
            detail="No valid plans found for current budget and time window. Try expanding budget or travel limit.",
        )

    enriched_plans: list[DatePlan] = []
    why_cache: dict = {}
    for p in plans:
        enriched_plans.append(await _enrich_plan(p, why_cache))

    # Persist top plans in DB
    with DBSession(engine) as db:
        row2 = db.exec(select(SessionDB).where(SessionDB.token_a == token_a)).first()
        if row2:
            row2.plan_json = json.dumps([p.model_dump() for p in enriched_plans])
            db.add(row2)
            db.commit()

    return [p.model_dump() for p in enriched_plans]


@router.get("/{token}/current")
def get_plan(token: str):
    """Retrieve current plans for either Partner A or Partner B."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row or not row.plan_json:
        raise HTTPException(status_code=404, detail="No plan generated yet")
    plans = json.loads(row.plan_json)
    return _redact_surprise_plans(plans, row.city) if _surprise_is_hidden(row, token) else plans


@router.post("/{token}/swap/{plan_index}/{stop_index}")
async def swap_stop(token: str, plan_index: int, stop_index: int, apply: bool = False):
    """
    Swap Stop button: locks all other stops, re-solves that slot,
    and returns a precise diff (old total vs new total, travel change, budget ok).
    """
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row or not row.plan_json:
        raise HTTPException(status_code=404, detail="Plan not found")
    if _surprise_is_hidden(row, token):
        raise HTTPException(status_code=403, detail="Stops stay locked until the surprise date begins")

    plans_raw = json.loads(row.plan_json)
    if plan_index < 0 or plan_index >= len(plans_raw):
        raise HTTPException(status_code=400, detail="Invalid plan index")

    plan = DatePlan.model_validate(plans_raw[plan_index])
    if stop_index < 0 or stop_index >= len(plan.stops):
        raise HTTPException(status_code=400, detail="Invalid stop index")

    taste_a = TasteCard.model_validate_json(row.taste_a)
    taste_b = TasteCard.model_validate_json(row.taste_b)
    constraints = merge_constraints(taste_a, taste_b)

    target_stop = plan.stops[stop_index]
    slot_to_swap = target_stop.slot
    old_venue = target_stop.venue
    old_total_cost = plan.total_cost
    old_travel_total = plan.total_travel_min

    # Find candidate substitutes for this slot (excluding current venue)
    venues = [v for v in load_venues() if v.city.lower() == row.city.lower()]
    raw_candidates = [
        v for v in venues
        if v.type == slot_to_swap and v.id != old_venue.id
        and not any(d in [t.lower() for t in v.vibe_tags + v.cuisine_tags] for d in constraints["dislikes"])
        and (not any("veg" in d.lower() for d in constraints["dietary"]) or v.veg_friendly)
    ]

    feasible: list[tuple] = []
    for candidate in raw_candidates:
        replacement_plan = apply_venue_replacement(row, plan, stop_index, candidate)
        if replacement_plan:
            feasible.append((candidate, replacement_plan))

    if not feasible:
        raise HTTPException(status_code=422, detail="No alternative can preserve the schedule, budget, hours, and travel limits")

    feasible.sort(
        key=lambda item: (score_venue(item[0], constraints, slot_to_swap), -item[1].total_travel_min),
        reverse=True,
    )
    best_substitute, replacement_plan = feasible[0]
    backup_venue = feasible[1][0] if len(feasible) > 1 else None
    new_stop = replacement_plan.stops[stop_index]
    new_stop.backup_venue = backup_venue
    new_stop.why_picked = await write_why_picked(new_stop, plan.matched_vibes, plan.matched_cuisines)
    plan = replacement_plan
    plan.stops[stop_index] = new_stop

    if apply:
        plans_raw[plan_index] = plan.model_dump()
        with DBSession(engine) as db:
            row_update = db.exec(
                select(SessionDB).where(
                    (SessionDB.token_a == token) | (SessionDB.token_b == token)
                )
            ).first()
            if row_update:
                row_update.plan_json = json.dumps(plans_raw)
                db.add(row_update)
                db.commit()

    return {
        "new_stop": new_stop.model_dump(),
        "old_venue_name": old_venue.name,
        "old_cost": target_stop.cost,
        "new_cost": new_stop.cost,
        "old_total": old_total_cost,
        "new_total": plan.total_cost,
        "travel_diff_min": plan.total_travel_min - old_travel_total,
        "schedule_change": {
            "old_arrival": target_stop.arrival_time,
            "new_arrival": new_stop.arrival_time,
            "old_departure": target_stop.departure_time,
            "new_departure": new_stop.departure_time,
        },
        "budget_ok": plan.constraints_ok["budget"],
        "budget_remaining": plan.budget_remaining,
        "updated_plan": plan.model_dump(),
        "applied": apply,
    }


@router.post("/{token}/rain-mode/{plan_index}")
async def trigger_rain_mode(token: str, plan_index: int):
    """Produces weather-proof Plan B with indoor substitutions and rain trigger notes."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row or not row.plan_json:
        raise HTTPException(status_code=404, detail="No plan found")
    if _surprise_is_hidden(row, token):
        raise HTTPException(status_code=403, detail="Rain changes are controlled by Partner A until the surprise date begins")

    plans_raw = json.loads(row.plan_json)
    if plan_index < 0 or plan_index >= len(plans_raw):
        raise HTTPException(status_code=400, detail="Invalid plan index")

    if not row.taste_a or not row.taste_b:
        raise HTTPException(status_code=400, detail="Both taste cards must be submitted first")
    taste_a = TasteCard.model_validate_json(row.taste_a)
    taste_b = TasteCard.model_validate_json(row.taste_b)
    indoor_plans = plan_date(row, taste_a, taste_b, indoor_only=True)
    if not indoor_plans:
        raise HTTPException(status_code=422, detail="No indoor-only plan fits the current constraints")

    rain_plan = await _enrich_plan(indoor_plans[min(plan_index, len(indoor_plans) - 1)])
    rain_plan.rain_mode_active = True
    trigger_note = "If rain starts, switch to this fully indoor plan; its budget, hours, schedule, and travel limits are rechecked."
    rain_plan.rain_trigger_note = trigger_note
    return {
        "rain_plan": rain_plan.model_dump(),
        "trigger_note": trigger_note,
    }
