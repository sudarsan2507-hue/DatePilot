"""
quick.py — Solo planning: one person, three quick inputs, a plan straight away.
The session it creates works with the existing swap, rain and route endpoints.
"""
import json
import secrets
from fastapi import APIRouter, HTTPException
from sqlmodel import Session as DBSession
from app.db import engine
from app.models.schema import QuickPlanRequest, SessionDB
from app.services.planner import plan_date
from app.services.quick import end_time, pick_slots, quick_taste, today_ist
from app.services.writer import write_itinerary, write_why_picked

router = APIRouter(tags=["quick"])

SOLO_MAX_TRAVEL_MIN = 40


@router.post("/quick-plan")
async def quick_plan(req: QuickPlanRequest):
    taste = quick_taste(req)
    time_end = end_time(req.time_start)
    slots = pick_slots(req.time_start, time_end, req.vibes)
    row = SessionDB(
        token_a=secrets.token_urlsafe(16),
        token_b=secrets.token_urlsafe(16),
        mode="solo",
        date=req.date or today_ist(),
        time_start=req.time_start,
        time_end=time_end,
        budget_inr=req.budget_inr,
        city=req.city,
        start_area=req.start_area,
        max_travel_min=SOLO_MAX_TRAVEL_MIN,
        surprise_mode=False,
        slots_enabled=json.dumps([s.value for s in slots]),
        # Solo: one combined profile stands in for both cards, so swap and rain mode work unchanged.
        taste_a=taste.model_dump_json(),
        taste_b=taste.model_dump_json(),
    )

    plans = plan_date(row, taste, taste)
    if not plans:
        raise HTTPException(
            status_code=422,
            detail="We couldn't fit a date into that budget and time. Try a bigger budget or an earlier start.",
        )

    # Template text only: no model call, so the plan is back in well under a second.
    why_cache: dict = {}
    for plan in plans:
        for stop in plan.stops:
            key = (stop.venue.id, stop.slot)
            if key not in why_cache:
                why_cache[key] = await write_why_picked(stop, plan.matched_vibes, plan.matched_cuisines, use_llm=False)
            stop.why_picked = why_cache[key]
        plan.itinerary_text = await write_itinerary(plan, use_llm=False)

    row.plan_json = json.dumps([p.model_dump() for p in plans])
    with DBSession(engine) as db:
        db.add(row)
        db.commit()
        db.refresh(row)

    return {
        "token": row.token_a,
        "session": {
            "mode": row.mode,
            "date": row.date,
            "time_start": row.time_start,
            "time_end": row.time_end,
            "budget_inr": row.budget_inr,
            "city": row.city,
            "start_area": row.start_area,
            "vibes": req.vibes,
        },
        "plans": [p.model_dump() for p in plans],
    }
