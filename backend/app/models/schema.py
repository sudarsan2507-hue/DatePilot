"""Pydantic / SQLModel schemas used across the DatePilot app."""
from __future__ import annotations
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator
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

    @field_validator("cuisines", "dietary_signals", "vibes", "activities", "dislikes")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            tag = value.strip().lower()
            if tag and tag not in cleaned:
                cleaned.append(tag[:80])
        return cleaned[:30]

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, values: dict[str, float]) -> dict[str, float]:
        return {key[:80]: max(0.0, min(1.0, float(value))) for key, value in values.items()}


# ── Session / Partner ────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    date: str                                       # ISO date YYYY-MM-DD
    time_start: str                                 # "HH:MM"
    time_end: str                                   # "HH:MM"
    budget_inr: int = Field(default=4000, ge=0, le=100_000)
    city: str = "Chennai"
    start_area: str = "Alwarpet"
    max_travel_minutes: int = Field(default=35, ge=1, le=180)
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

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        datetime.strptime(value, "%Y-%m-%d")
        return value

    @field_validator("time_start", "time_end")
    @classmethod
    def valid_time(cls, value: str) -> str:
        datetime.strptime(value, "%H:%M")
        return value

    @field_validator("city", "start_area")
    @classmethod
    def valid_location(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("city and start_area cannot be empty")
        return value[:80]

    @field_validator("city")
    @classmethod
    def supported_city(cls, value: str) -> str:
        canonical = {name.lower(): name for name in ("Chennai", "Coimbatore", "Madurai")}
        if value.lower() not in canonical:
            raise ValueError("Choose a supported Indian city: Chennai, Coimbatore, or Madurai")
        return canonical[value.lower()]

    @field_validator("slots_enabled")
    @classmethod
    def valid_slots(cls, values: list[SlotType]) -> list[SlotType]:
        unique = list(dict.fromkeys(values))
        if not unique:
            raise ValueError("Select at least one date slot")
        return unique

    @model_validator(mode="after")
    def valid_window(self):
        start = datetime.strptime(self.time_start, "%H:%M")
        end = datetime.strptime(self.time_end, "%H:%M")
        if end <= start:
            raise ValueError("time_end must be later than time_start")
        return self


class PartnerBLimits(BaseModel):
    budget_inr: Optional[int] = Field(default=None, ge=0, le=100_000)
    max_travel_minutes: Optional[int] = Field(default=None, ge=1, le=180)


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
    city: str = "Chennai"
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
    city: str = "Chennai"
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
