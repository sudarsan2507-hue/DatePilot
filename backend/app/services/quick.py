"""
quick.py — Solo, budget-first planning from a few quick inputs.
Everything here is rule-based: vibe chips become venue tags through data/tag_map.json,
and the stops are chosen from the start time. No model call.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from app.models.schema import QuickPlanRequest, SlotType, TasteCard
from app.services.tag_mapping import card_from_answers, vibe_tags

IST = timezone(timedelta(hours=5, minutes=30))
LATEST_END = "23:00"
MAX_STOPS = 4


def today_ist() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def end_time(time_start: str, hours: float = 6.5) -> str:
    """A date runs about six and a half hours, and never past 23:00."""
    start = datetime.strptime(time_start, "%H:%M")
    end = min(start + timedelta(hours=hours), datetime.strptime(LATEST_END, "%H:%M"))
    return end.strftime("%H:%M")


def pick_slots(time_start: str, time_end: str, vibes: list[str]) -> list[SlotType]:
    """Stops that make sense for the time of day, at most MAX_STOPS, in day order."""
    start = datetime.strptime(time_start, "%H:%M").time()
    end = datetime.strptime(time_end, "%H:%M").time()
    slots: list[SlotType] = []
    if start <= datetime.strptime("13:30", "%H:%M").time():
        slots.append(SlotType.lunch)
    slots += [SlotType.activity, SlotType.cafe]
    if start <= datetime.strptime("17:30", "%H:%M").time():
        slots.append(SlotType.sunset)
    if end >= datetime.strptime("20:00", "%H:%M").time():
        slots.append(SlotType.dinner)

    # Trim to MAX_STOPS, dropping what the chosen vibes care least about.
    drop_order = [SlotType.cafe, SlotType.activity, SlotType.lunch, SlotType.sunset, SlotType.dinner]
    if "artsy" in vibes or "playful" in vibes:
        drop_order.remove(SlotType.activity); drop_order.append(SlotType.activity)
    if "outdoorsy" in vibes or "romantic" in vibes:
        drop_order.remove(SlotType.sunset); drop_order.append(SlotType.sunset)
    for slot in drop_order:
        if len(slots) <= MAX_STOPS:
            break
        if slot in slots:
            slots.remove(slot)
    return slots


def quick_taste(req: QuickPlanRequest) -> TasteCard:
    """One taste profile for the planner: the vibe chips, then their date's answers,
    then the planner's own. Dislikes and dietary needs from either side always apply."""
    vibes, cuisines = vibe_tags(req.vibes)
    date_card, you_card = card_from_answers(req.about_date), card_from_answers(req.about_you)
    return TasteCard(
        cuisines=date_card.cuisines + cuisines + you_card.cuisines,
        vibes=date_card.vibes + vibes + you_card.vibes,
        activities=date_card.activities + you_card.activities,
        dislikes=date_card.dislikes + you_card.dislikes,
        dietary_signals=date_card.dietary_signals + you_card.dietary_signals,
        price_comfort=date_card.price_comfort,
    )
