"""Optional live data endpoints used by the UI and integrations."""
from fastapi import APIRouter, Query

from app.services.live_data import discover_osm_places, get_weather

router = APIRouter(prefix="/live", tags=["live-data"])


@router.get("/weather")
async def weather(city: str, forecast_date: str):
    return await get_weather(city, forecast_date)


@router.get("/nearby")
async def nearby_places(
    city: str,
    query: str = Query(default="restaurant", max_length=40),
    limit: int = Query(default=10, ge=1, le=20),
):
    return await discover_osm_places(city, query, limit)
