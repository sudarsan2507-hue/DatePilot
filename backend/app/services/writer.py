"""
writer.py — LLM-powered text generation for reasons and itineraries.
Strict validation: every time and number the model writes must match the
planner data. If the model invents one (or fails), we fall back to a
verified template.
"""
import re
from app.llm import chat
from app.models.schema import DatePlan, PlannedStop

_TIME_RE = re.compile(r"\b(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?", re.IGNORECASE)
_NUMBER_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _facts_ok(text: str, numbers: set[float], times: set[str]) -> bool:
    """True when every time and number in `text` comes from the planner.

    Understands "₹4,700", "4.7", "12:34" and "7:00 pm" instead of splitting
    them into unrelated digits. Small counts (0–5) and years are always fine.
    """
    def time_ok(match: re.Match) -> bool:
        hour, minute, meridiem = int(match.group(1)), match.group(2), (match.group(3) or "").lower()
        candidates = {hour}
        if meridiem.startswith("p") and hour < 12:
            candidates = {hour + 12}
        elif meridiem.startswith("a") and hour == 12:
            candidates = {0}
        elif not meridiem and hour < 12:
            candidates = {hour, hour + 12}
        return any(f"{h:02d}:{minute}" in times for h in candidates)

    for match in _TIME_RE.finditer(text):
        if not time_ok(match):
            return False
    rest = _TIME_RE.sub(" ", text)

    for raw in _NUMBER_RE.findall(rest):
        value = float(raw.replace(",", ""))
        if value <= 5 or 2024 <= value <= 2030:
            continue
        if not any(abs(value - allowed) < 0.051 for allowed in numbers):
            return False
    return True


def _stop_numbers(stop: PlannedStop) -> set[float]:
    return {
        float(stop.cost),
        float(stop.venue.rating),
        float(stop.travel_from_prev_min),
        float(stop.distance_from_prev_km),
        float(stop.venue.typical_duration_min or 0),
    }


def _stop_times(stop: PlannedStop) -> set[str]:
    return {stop.arrival_time, stop.departure_time}


async def write_why_picked(stop: PlannedStop, shared_vibes: list[str], shared_cuisines: list[str]) -> str:
    """Generate a short, factual 'why we picked this' line without inventing facts."""
    vibe_overlap = [v for v in shared_vibes if v.lower() in [vt.lower() for vt in stop.venue.vibe_tags]]
    cuisine_overlap = [c for c in shared_cuisines if c.lower() in [ct.lower() for ct in stop.venue.cuisine_tags]]

    prompt = f"""Write ONE warm, plain sentence (max 22 words) on why {stop.venue.name} in {stop.venue.area} suits this couple's {stop.slot.value}.
Facts you may use:
- Feel of the place: {', '.join(stop.venue.vibe_tags) or 'not listed'}
- Food: {', '.join(stop.venue.cuisine_tags) or 'not listed'}
- What they both like here: {', '.join(vibe_overlap + cuisine_overlap) or 'a calm setting'}
- Rating: {stop.venue.rating} out of 5
Rules: no prices, no times, no exclamation marks, no quotes. Do not invent facts."""

    text = await chat(prompt, max_tokens=70)
    cleaned = (text or "").strip().strip('"').replace('"', "")
    if len(cleaned) > 10 and _facts_ok(cleaned, _stop_numbers(stop), _stop_times(stop)):
        return cleaned[:200]

    # Template fallback
    reasons = []
    if vibe_overlap:
        reasons.append(f"it has the {', '.join(v.replace('-', ' ') for v in vibe_overlap)} feel you both like")
    if cuisine_overlap:
        reasons.append(f"it serves the {', '.join(c.replace('-', ' ') for c in cuisine_overlap)} food you both enjoy")
    if not reasons:
        reasons.append(f"it is one of the best-rated places in {stop.venue.area} ({stop.venue.rating} out of 5)")
    return f"Picked because {' and '.join(reasons)}."


async def write_itinerary(plan: DatePlan) -> str:
    """Generate a short narrative of the day; every number is checked against the plan."""
    stops_summary = "\n".join(
        f"- {s.arrival_time} {s.slot.value} at {s.venue.name} ({s.venue.area})"
        for s in plan.stops
    )
    city = plan.stops[0].venue.city if plan.stops else "Tamil Nadu"
    prompt = f"""Describe this planned date in {city} to the couple in 2 or 3 short, warm sentences.
It has not happened yet: write in the future tense ("You will start at...").
The day, in order:
{stops_summary}
Total cost: ₹{plan.total_cost:,}.
Rules: mention each place once, in order. Only use the times and the total above. No exclamation marks."""

    numbers = {float(plan.total_cost), float(plan.budget_remaining), float(plan.total_travel_min)}
    times: set[str] = set()
    for s in plan.stops:
        numbers |= _stop_numbers(s)
        times |= _stop_times(s)

    for _ in range(2):
        text = await chat(prompt, max_tokens=160)
        cleaned = (text or "").strip()
        if len(cleaned) > 30 and _facts_ok(cleaned, numbers, times):
            return cleaned

    # Verified template fallback
    first, last = plan.stops[0], plan.stops[-1]
    lines = [f"Your day in {first.venue.city} starts at {first.arrival_time} with {first.slot.value} at {first.venue.name}."]
    middle = plan.stops[1:-1]
    if middle:
        lines.append("Then " + ", then ".join(f"{s.slot.value} at {s.venue.name}" for s in middle) + ".")
    if len(plan.stops) > 1:
        lines.append(f"You finish with {last.slot.value} at {last.venue.name} at {last.arrival_time}.")
    lines.append(f"It all comes to ₹{plan.total_cost:,}, leaving ₹{plan.budget_remaining:,} spare.")
    return " ".join(lines)
