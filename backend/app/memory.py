"""
memory.py — taste-profile persistence layer and memory interface.
Interface is stable so HippocampAI or any vector store can be plugged in later.
Provides:
- Taste profile storage / loading / GDPR deletion
- Post-date feedback ratings (1-5 + notes)
- Learned taste insights ("What I learned about you two")
"""
from __future__ import annotations
import json
from typing import Optional, List, Dict, Any
from sqlmodel import Session as DBSession, select
from app.db import engine
from app.models.schema import SessionDB, TasteCard, TasteMemoryDB, StopFeedback


def save_taste(session_token: str, partner: str, card: TasteCard) -> None:
    """Persist a confirmed TasteCard for partner 'a' or 'b'."""
    with DBSession(engine) as db:
        stmt = select(SessionDB).where(
            (SessionDB.token_a == session_token) | (SessionDB.token_b == session_token)
        )
        row = db.exec(stmt).first()
        if not row:
            raise ValueError("Session not found")
        if partner == "a":
            row.taste_a = card.model_dump_json()
        else:
            row.taste_b = card.model_dump_json()
        db.add(row)
        db.commit()


def load_taste(session_token: str, partner: str) -> Optional[TasteCard]:
    """Retrieve TasteCard for partner 'a' or 'b'."""
    with DBSession(engine) as db:
        stmt = select(SessionDB).where(
            (SessionDB.token_a == session_token) | (SessionDB.token_b == session_token)
        )
        row = db.exec(stmt).first()
        if not row:
            return None
        raw = row.taste_a if partner == "a" else row.taste_b
        return TasteCard.model_validate_json(raw) if raw else None


def delete_taste(session_token: str, partner: str) -> None:
    """GDPR-compliant wipe: permanently erase all uploaded & inferred taste data for this partner."""
    with DBSession(engine) as db:
        stmt = select(SessionDB).where(
            (SessionDB.token_a == session_token) | (SessionDB.token_b == session_token)
        )
        row = db.exec(stmt).first()
        if row:
            if partner == "a":
                row.taste_a = None
            else:
                row.taste_b = None
            # Existing plans are derived from both cards and must not survive a privacy wipe.
            row.plan_json = None
            db.add(row)

        # Also purge any feedback by this partner for this session
        memory_stmt = select(TasteMemoryDB).where(
            (TasteMemoryDB.session_token == row.token_a) & (TasteMemoryDB.partner == partner)
        )
        for mem in db.exec(memory_stmt).all():
            db.delete(mem)

        db.commit()


def record_feedback(session_token: str, feedback: StopFeedback) -> TasteMemoryDB:
    """Record post-date rating and review notes for a planned stop."""
    record = TasteMemoryDB(
        session_token=session_token,
        partner=feedback.partner,
        stop_id=feedback.stop_id,
        venue_name=feedback.venue_name,
        slot=feedback.slot.value,
        rating=feedback.rating,
        notes=feedback.notes,
    )
    with DBSession(engine) as db:
        db.add(record)
        db.commit()
        db.refresh(record)
    return record


def get_memory_insights(session_token: str) -> dict[str, Any]:
    """
    Summarize learned weights from post-date ratings.
    Generates a 'What I learned about you two' card.
    """
    with DBSession(engine) as db:
        stmt = select(TasteMemoryDB).where(TasteMemoryDB.session_token == session_token)
        feedbacks = db.exec(stmt).all()

    if not feedbacks:
        return {
            "total_reviews": 0,
            "average_rating": 0.0,
            "favorite_slots": [],
            "insights": ["Complete your date and rate stops to unlock personalized taste memory."],
        }

    total = len(feedbacks)
    avg_rating = round(sum(f.rating for f in feedbacks) / total, 2)

    # Slot performance
    slot_ratings: dict[str, list[int]] = {}
    for f in feedbacks:
        slot_ratings.setdefault(f.slot, []).append(f.rating)

    favorite_slots = [
        slot for slot, scores in slot_ratings.items()
        if sum(scores) / len(scores) >= 4.0
    ]

    insights = []
    if avg_rating >= 4.5:
        insights.append("Outstanding synergy! Both partners loved the ambient tempo and selection.")
    elif avg_rating >= 3.5:
        insights.append("Great date flow with high engagement on shared cultural and scenic spots.")

    if favorite_slots:
        insights.append(f"Top-rated slot categories for future dates: {', '.join(favorite_slots)}.")

    high_rated_venues = [f.venue_name for f in feedbacks if f.rating >= 4]
    if high_rated_venues:
        insights.append(f"Favorite India venues to remember: {', '.join(set(high_rated_venues))}.")

    return {
        "total_reviews": total,
        "average_rating": avg_rating,
        "favorite_slots": favorite_slots,
        "insights": insights,
    }
