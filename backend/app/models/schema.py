"""Pydantic / SQLModel schemas used across the DatePilot app."""
from __future__ import annotations
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field
from sqlmodel import SQLModel, Field as SField


# ── Enums ────────────────────────────────────────────────────────────────────

class PriceComfort(str, Enum):
    low = "low"
    mid = "mid"
    high = "high"


class SlotType(str, Enum):
    lunch = "lunch"
    activity = "activity"
    cafe = "cafe"
    sunset = "sunset"
    dinner = "dinner"


# ── Taste Card ───────────────────────────────────────────────────────────────

class TasteCard(BaseModel):
    cuisines: list[str] = Field(default_factory=list)
    dietary_signals: list[str] = Field(default_factory=list)  # e.g. "vegetarian" — only when confirmed
    vibes: list[str] = Field(default_factory=list)           # quiet, pastel, artsy, outdoors …
    activities: list[str] = Field(default_factory=list)
    dislikes: list[str] = Field(default_factory=list)
    price_comfort: PriceComfort = PriceComfort.mid
    confidence: dict[str, float] = Field(default_factory=dict)  # item -> 0.0..1.0


# ── Session / Partner ────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    date: str                                       # ISO date YYYY-MM-DD
    time_start: str                                 # "HH:MM"
    time_end: str                                   # "HH:MM"
    budget_inr: int = 4000
    start_area: str = "Alwarpet"
    max_travel_minutes: int = 35
    surprise_mode: bool = False
    slots_enabled: list[SlotType] = Field(
        default_factory=lambda: [
            SlotType.lunch,
            SlotType.activity,
            SlotType.cafe,
            SlotType.sunset,
            SlotType.dinner,
        ]
    )


class PartnerBLimits(BaseModel):
    budget_inr: Optional[int] = None
    max_travel_minutes: Optional[int] = None


class SessionDB(SQLModel, table=True):
    __tablename__ = "sessions"
    id: Optional[int] = SField(default=None, primary_key=True)
    token_a: str = SField(index=True)   # partner A token
    token_b: str = SField(index=True)   # partner B token
    date: str
    time_start: str
    time_end: str
    budget_inr: int
    budget_b_inr: Optional[int] = None
    start_area: str
    max_travel_min: int
    surprise_mode: bool
    slots_enabled: str                  # JSON-encoded list[SlotType]
    taste_a: Optional[str] = None       # JSON TasteCard
    taste_b: Optional[str] = None       # JSON TasteCard
    plan_json: Optional[str] = None     # JSON list[DatePlan]
    created_at: datetime = SField(default_factory=lambda: datetime.now(timezone.utc))


# ── Venue ────────────────────────────────────────────────────────────────────

class Venue(BaseModel):
    id: str
    name: str
    type: SlotType
    area: str
    lat: float
    lng: float
    avg_cost_for_two: int
    typical_duration_min: int
    open_hours: dict[str, str]          # e.g. {"monday": "10:00-22:00", ...}
    cuisine_tags: list[str] = Field(default_factory=list)
    vibe_tags: list[str] = Field(default_factory=list)
    veg_friendly: bool = True
    indoor: bool = True
    rating: float = 4.0
    source_url: str = ""
    last_verified: str = "2024-12-15"


# ── Plan ─────────────────────────────────────────────────────────────────────

class PlannedStop(BaseModel):
    slot: SlotType
    venue: Venue
    arrival_time: str                   # "HH:MM"
    departure_time: str                 # "HH:MM"
    cost: int
    travel_from_prev_min: int
    distance_from_prev_km: float
    why_picked: str = ""                # LLM-generated fact-checked text
    backup_venue: Optional[Venue] = None


class DatePlan(BaseModel):
    stops: list[PlannedStop]
    total_cost: int
    budget_remaining: int
    total_travel_min: int
    constraints_ok: dict[str, bool]     # budget, hours, travel, dietary
    itinerary_text: str = ""            # LLM-generated friendly narrative
    matched_vibes: list[str] = Field(default_factory=list)
    matched_cuisines: list[str] = Field(default_factory=list)
    rain_mode_active: bool = False
    rain_trigger_note: str = ""


# ── Memory & Feedback ────────────────────────────────────────────────────────

class StopFeedback(BaseModel):
    stop_id: str
    venue_name: str
    slot: SlotType
    rating: int = Field(ge=1, le=5)
    notes: Optional[str] = ""
    partner: str = "a"                  # "a" or "b"


class TasteMemoryDB(SQLModel, table=True):
    __tablename__ = "taste_memory"
    id: Optional[int] = SField(default=None, primary_key=True)
    session_token: str = SField(index=True)
    partner: str                        # "a" or "b"
    stop_id: str
    venue_name: str
    slot: str
    rating: int
    notes: Optional[str] = None
    created_at: datetime = SField(default_factory=lambda: datetime.now(timezone.utc))
