"""
sessions.py — Session creation, partner invitation, and private constraint merging.
Neither partner sees the other's raw answers.
Planner UI only displays the merged 'What we matched on' summary.
"""
import json
import secrets
from fastapi import APIRouter, HTTPException
from sqlmodel import Session as DBSession, select
from app.db import engine
from app.models.schema import SessionCreate, SessionDB, PartnerBLimits, TasteCard
from app.services.planner import merge_constraints

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/")
def create_session(data: SessionCreate):
    """Partner A initializes a date planning session."""
    token_a = secrets.token_urlsafe(16)
    token_b = secrets.token_urlsafe(16)
    row = SessionDB(
        token_a=token_a,
        token_b=token_b,
        date=data.date,
        time_start=data.time_start,
        time_end=data.time_end,
        budget_inr=data.budget_inr,
        city=data.city,
        start_area=data.start_area,
        max_travel_min=data.max_travel_minutes,
        surprise_mode=data.surprise_mode,
        slots_enabled=json.dumps([s.value for s in data.slots_enabled]),
    )
    with DBSession(engine) as db:
        db.add(row)
        db.commit()
        db.refresh(row)
    return {
        "token_a": token_a,
        "token_b": token_b,
        "session_id": row.id,
        "city": row.city,
        "invite_link": f"/invite/{token_b}",
    }


@router.get("/{token}")
def get_session(token: str):
    """Retrieve session info for Partner A or Partner B without exposing other's raw data."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    partner = "a" if row.token_a == token else "b"
    other_submitted = row.taste_b is not None if partner == "a" else row.taste_a is not None
    my_submitted = row.taste_a is not None if partner == "a" else row.taste_b is not None

    return {
        "partner": partner,
        "date": row.date,
        "time_start": row.time_start,
        "time_end": row.time_end,
        "budget_inr": min(row.budget_inr, row.budget_b_inr) if row.budget_b_inr else row.budget_inr,
        "city": row.city,
        "start_area": row.start_area,
        "max_travel_min": row.max_travel_min,
        "surprise_mode": row.surprise_mode,
        "slots_enabled": json.loads(row.slots_enabled),
        "my_taste_submitted": my_submitted,
        "partner_taste_submitted": other_submitted,
        "both_submitted": row.taste_a is not None and row.taste_b is not None,
        "has_plan": row.plan_json is not None,
        # Only Partner A gets the invite token, so they can resume after a reload.
        **({"token_b": row.token_b} if partner == "a" else {}),
    }


@router.post("/{token_b}/limits")
def set_partner_b_limits(token_b: str, limits: PartnerBLimits):
    """Partner B can privately set her own budget cap or travel limit."""
    with DBSession(engine) as db:
        row = db.exec(select(SessionDB).where(SessionDB.token_b == token_b)).first()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if limits.budget_inr is not None:
            row.budget_b_inr = limits.budget_inr
        if limits.max_travel_minutes is not None:
            row.max_travel_min = min(row.max_travel_min, limits.max_travel_minutes)
        db.add(row)
        db.commit()
    return {"status": "limits_updated"}


@router.get("/{token}/match-summary")
def get_match_summary(token: str):
    """
    Returns the anonymous overlap summary:
    - Shared vibes, shared cuisines, shared activities
    - Merged budget & dietary constraints
    Never reveals who contributed which preference!
    """
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    if not row.taste_a or not row.taste_b:
        return {
            "ready": False,
            "message": "Waiting for both partners to submit their taste preferences.",
        }

    taste_a = TasteCard.model_validate_json(row.taste_a)
    taste_b = TasteCard.model_validate_json(row.taste_b)
    merged = merge_constraints(taste_a, taste_b)

    effective_budget = min(row.budget_inr, row.budget_b_inr) if row.budget_b_inr else row.budget_inr

    return {
        "ready": True,
        "effective_budget": effective_budget,
        "shared_vibes": merged["shared_vibes"],
        "shared_cuisines": merged["shared_cuisines"],
        "shared_activities": merged["shared_activities"],
        "dietary_rules": merged["dietary"],
        "excluded_dislikes_count": len(merged["dislikes"]),
    }
