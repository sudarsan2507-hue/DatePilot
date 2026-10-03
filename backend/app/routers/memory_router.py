"""
memory_router.py — Post-date feedback ratings and learned taste insights.
Updates taste weights in SQLite via memory.py interface so HippocampAI can be plugged in later.
Returns 'What I learned about you two' summary card.
"""
from fastapi import APIRouter, HTTPException
from sqlmodel import Session as DBSession, select
from app.db import engine
from app.models.schema import SessionDB, StopFeedback
from app.memory import record_feedback, get_memory_insights

router = APIRouter(prefix="/memory", tags=["memory"])


@router.post("/{token}/rate")
def rate_stop(token: str, feedback: StopFeedback):
    """Partner submits a 1-5 star rating and optional note for a date stop."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    partner = "a" if row.token_a == token else "b"
    feedback.partner = partner
    recorded = record_feedback(row.token_a, feedback)
    return {"status": "recorded", "id": recorded.id, "rating": recorded.rating}


@router.get("/{token}/insights")
def get_insights(token: str):
    """Retrieve learned taste preferences and 'What I learned about you two' insights."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    return get_memory_insights(row.token_a)
