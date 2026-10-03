"""
plan.py — Itinerary generation, Stop Swapping diff engine, and Rain Mode protocol.
Rules:
- Math is 100% deterministic (no LLM math errors).
- LLM enriches 'why_picked' and friendly itinerary text with strict factual bounds.
- Stop Swap re-solves that specific slot while locking all others, returning an exact diff.
"""
import json
from datetime import datetime, timedelta
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
)
from app.services.writer import write_why_picked, write_itinerary

router = APIRouter(prefix="/plan", tags=["plan"])


async def _enrich_plan(plan: DatePlan) -> DatePlan:
    """Enrich plan with AI explanations and friendly itinerary narrative."""
    for stop in plan.stops:
        stop.why_picked = await write_why_picked(stop, plan.matched_vibes, plan.matched_cuisines)
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
    for p in plans:
        enriched_plans.append(await _enrich_plan(p))

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
    return json.loads(row.plan_json)


@router.post("/{token}/swap/{plan_index}/{stop_index}")
async def swap_stop(token: str, plan_index: int, stop_index: int):
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

    plans_raw = json.loads(row.plan_json)
    if plan_index >= len(plans_raw):
        raise HTTPException(status_code=400, detail="Invalid plan index")

    plan = DatePlan.model_validate(plans_raw[plan_index])
    if stop_index >= len(plan.stops):
        raise HTTPException(status_code=400, detail="Invalid stop index")

    taste_a = TasteCard.model_validate_json(row.taste_a)
    taste_b = TasteCard.model_validate_json(row.taste_b)
    constraints = merge_constraints(taste_a, taste_b)

    target_stop = plan.stops[stop_index]
    slot_to_swap = target_stop.slot
    old_venue = target_stop.venue
    old_total_cost = plan.total_cost
    old_travel_min = target_stop.travel_from_prev_min

    # Find candidate substitutes for this slot (excluding current venue)
    venues = load_venues()
    day_name = datetime.strptime(row.date, "%Y-%m-%d").strftime("%A").lower()

    candidates = [
        v for v in venues
        if v.type == slot_to_swap and v.id != old_venue.id
        and not any(d in [t.lower() for t in v.vibe_tags + v.cuisine_tags] for d in constraints["dislikes"])
        and (not any("veg" in d.lower() for d in constraints["dietary"]) or v.veg_friendly)
        and is_open(v, day_name, target_stop.arrival_time)
    ]

    if not candidates:
        raise HTTPException(status_code=422, detail="No alternative venues available for this slot")

    # Score and select the top alternative
    candidates.sort(key=lambda v: score_venue(v, constraints, slot_to_swap), reverse=True)
    best_substitute = candidates[0]

    # Calculate travel from previous stop
    prev_coords = (
        (plan.stops[stop_index - 1].venue.lat, plan.stops[stop_index - 1].venue.lng)
        if stop_index > 0
        else (13.0336, 80.2520)
    )
    new_travel_min = int(round(travel_minutes(prev_coords[0], prev_coords[1], best_substitute.lat, best_substitute.lng)))
    new_dist_km = round(haversine_km(prev_coords[0], prev_coords[1], best_substitute.lat, best_substitute.lng) * ROAD_FACTOR, 1)

    dur = best_substitute.typical_duration_min or DEFAULT_DURATIONS.get(slot_to_swap, 60)
    arrival_dt = datetime.strptime(target_stop.arrival_time, "%H:%M")
    departure_time = (arrival_dt + timedelta(minutes=dur)).strftime("%H:%M")

    # Second backup
    backup_venue = candidates[1] if len(candidates) > 1 else None

    new_stop = PlannedStop(
        slot=slot_to_swap,
        venue=best_substitute,
        arrival_time=target_stop.arrival_time,
        departure_time=departure_time,
        cost=best_substitute.avg_cost_for_two,
        travel_from_prev_min=new_travel_min,
        distance_from_prev_km=new_dist_km,
        backup_venue=backup_venue,
    )
    new_stop.why_picked = await write_why_picked(new_stop, plan.matched_vibes, plan.matched_cuisines)

    # Update plan
    plan.stops[stop_index] = new_stop
    plan.total_cost = sum(s.cost for s in plan.stops)
    budget_limit = min(row.budget_inr, row.budget_b_inr) if row.budget_b_inr else row.budget_inr
    plan.budget_remaining = budget_limit - plan.total_cost
    plan.total_travel_min = sum(s.travel_from_prev_min for s in plan.stops)
    plan.constraints_ok["budget"] = plan.total_cost <= budget_limit

    # Save back to database
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
        "travel_diff_min": new_travel_min - old_travel_min,
        "budget_ok": plan.constraints_ok["budget"],
        "budget_remaining": plan.budget_remaining,
        "updated_plan": plan.model_dump(),
    }


@router.post("/{token}/rain-mode/{plan_index}")
def trigger_rain_mode(token: str, plan_index: int):
    """Produces weather-proof Plan B with indoor substitutions and rain trigger notes."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row or not row.plan_json:
        raise HTTPException(status_code=404, detail="No plan found")

    plans_raw = json.loads(row.plan_json)
    if plan_index >= len(plans_raw):
        raise HTTPException(status_code=400, detail="Invalid plan index")

    plan = DatePlan.model_validate(plans_raw[plan_index])
    day_name = datetime.strptime(row.date, "%Y-%m-%d").strftime("%A").lower()

    rain_plan, trigger_note = build_rain_mode_plan(plan, day_name)
    return {
        "rain_plan": rain_plan.model_dump(),
        "trigger_note": trigger_note,
    }
