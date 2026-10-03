"""
taste.py — Consent-based Taste Card extraction, review, confirmation, and GDPR deletion.
Rules:
- UI shows card BEFORE use.
- Nothing is persisted until explicitly confirmed by the user.
- Raw file uploads are discarded immediately from memory after parsing.
- "Delete all my data" permanently wipes everything for that user.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from sqlmodel import Session as DBSession, select
from app.db import engine
from app.models.schema import SessionDB, TasteCard
from app.memory import save_taste, load_taste, delete_taste
from app.services.taste_extractor import taste_from_export, taste_from_image, taste_from_quiz

router = APIRouter(prefix="/taste", tags=["taste"])
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("/{token}/upload")
async def upload_taste(token: str, file: UploadFile = File(...)):
    """
    Accept Instagram export (.zip / .json) or screenshot image (.png / .jpg).
    Extracts candidate TasteCard and returns it for user review.
    Does NOT persist to DB yet. Discards raw file data immediately.
    """
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    filename = file.filename or ""

    if len(content) > MAX_UPLOAD_BYTES:
        del content
        raise HTTPException(status_code=413, detail="Upload must be 15 MB or smaller")
    if not filename.lower().endswith((".zip", ".json", ".png", ".jpg", ".jpeg", ".webp")):
        del content
        raise HTTPException(status_code=415, detail="Upload a ZIP, JSON, PNG, JPG, or WEBP file")

    try:
        if filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            card = await taste_from_image(content)
        else:
            card = await taste_from_export(content, filename)
    finally:
        del content  # Immediately clean raw bytes from memory

    return card.model_dump()


@router.post("/{token}/quiz")
async def quiz_taste(token: str, answers: dict):
    """Fallback manual questionnaire: generates candidate TasteCard for user review."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    card = await taste_from_quiz(answers)
    return card.model_dump()


@router.post("/{token}/confirm")
async def confirm_taste(token: str, card: TasteCard):
    """User has reviewed, edited chips, and confirmed their Taste Card. Save to DB."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    partner = "a" if row.token_a == token else "b"
    save_taste(token, partner, card)
    return {"status": "confirmed", "partner": partner}


@router.get("/{token}")
async def get_taste(token: str):
    """Fetch current confirmed TasteCard for the calling partner."""
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    partner = "a" if row.token_a == token else "b"
    card = load_taste(token, partner)
    return card.model_dump() if card else {}


@router.delete("/{token}")
async def delete_my_data(token: str):
    """
    GDPR-style privacy wipe: permanently erases all taste profiles and
    feedback entries submitted by this partner.
    """
    with DBSession(engine) as db:
        row = db.exec(
            select(SessionDB).where(
                (SessionDB.token_a == token) | (SessionDB.token_b == token)
            )
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    partner = "a" if row.token_a == token else "b"
    delete_taste(token, partner)
    return {"status": "all_partner_data_deleted"}
