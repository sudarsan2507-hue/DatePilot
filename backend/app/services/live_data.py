"""Small, keyless integrations for live routing, weather, and OSM discovery.

These services are deliberately advisory. The curated venue file remains the
only source used for hard budget, hours, dietary, and venue constraints.
"""
from __future__ import annotations

from datetime import date
from typing import Any

import httpx

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

CITY_CENTERS: dict[str, tuple[float, float]] = {
    "chennai": (13.0336, 80.2520),
    "coimbatore": (11.0168, 76.9558),
    "madurai": (9.9252, 78.1198),
}


async def get_osrm_route(points: list[tuple[float, float]], geometry: bool = False) -> dict[str, Any] | None:
    """Return a real road route, or None when the public OSRM service is unavailable.
    With geometry=True the result includes the road path as [[lat, lng], ...]."""
    if len(points) < 2:
        return None
    coordinates = ";".join(f"{lng},{lat}" for lat, lng in points)
    url = f"{OSRM_URL}/{coordinates}"
    try:
        params = {"overview": "full", "geometries": "geojson", "steps": "false"} if geometry else {"overview": "false", "steps": "false"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(6.0, connect=2.0)) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        route = payload.get("routes", [None])[0]
        if not route:
            return None
        result = {
            "distance_km": round(float(route["distance"]) / 1000, 1),
            "duration_min": int(round(float(route["duration"]) / 60)),
            "source": "OSRM driving route",
        }
        if geometry:
            result["path"] = [[lat, lng] for lng, lat in route["geometry"]["coordinates"]]
        return result
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return None


async def get_weather(city: str, forecast_date: str) -> dict[str, Any]:
    """Fetch a daily Open-Meteo forecast with a useful no-network fallback."""
    center = CITY_CENTERS.get(city.strip().lower(), CITY_CENTERS["chennai"])
    fallback = {
        "city": city,
        "date": forecast_date,
        "available": False,
        "rain_probability": None,
        "precipitation_mm": None,
        "weather_code": None,
        "summary": "Live weather is unavailable; keep the indoor backup ready.",
        "source": "Open-Meteo unavailable",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
            response = await client.get(
                OPEN_METEO_URL,
                params={
                    "latitude": center[0], "longitude": center[1],
                    "daily": "precipitation_probability_max,precipitation_sum,weather_code",
                    "timezone": "Asia/Kolkata", "start_date": forecast_date, "end_date": forecast_date,
                },
            )
            response.raise_for_status()
            daily = response.json().get("daily", {})
        probability = daily.get("precipitation_probability_max", [None])[0]
        precipitation = daily.get("precipitation_sum", [None])[0]
        code = daily.get("weather_code", [None])[0]
        rain = (probability or 0) >= 40 or (precipitation or 0) >= 1
        return {
            "city": city, "date": forecast_date, "available": True,
            "rain_probability": probability, "precipitation_mm": precipitation,
            "weather_code": code,
            "summary": "Rain is possible — keep Plan B ready." if rain else "Low rain signal — outdoor stops look promising.",
            "rain_expected": rain, "source": "Open-Meteo",
        }
    except (httpx.HTTPError, KeyError, TypeError, ValueError, IndexError):
        return fallback


async def discover_osm_places(city: str, query: str = "restaurant", limit: int = 10) -> dict[str, Any]:
    """Discover nearby OSM places for suggestions; never inserts them into plans."""
    center = CITY_CENTERS.get(city.strip().lower())
    if not center:
        return {"city": city, "query": query, "places": [], "source": "Overpass", "available": False}
    safe_query = "restaurant" if not query.strip() else query.strip()[:40]
    overpass = f"""
[out:json][timeout:8];
area[\"name\"=\"{city}\"]->.searchArea;
(nwr[amenity~\"restaurant|cafe|bar\"](area.searchArea)[name~\"{safe_query}\",i];);
out center tags {limit};
"""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=2.0), headers={"User-Agent": "DatePilot/0.1 (demo)"}) as client:
            response = await client.post(OVERPASS_URL, content=overpass)
            response.raise_for_status()
            elements = response.json().get("elements", [])
        places = []
        for element in elements[:limit]:
            tags = element.get("tags", {})
            center_data = element.get("center", {})
            lat = element.get("lat", center_data.get("lat"))
            lng = element.get("lon", center_data.get("lon"))
            if tags.get("name") and lat is not None and lng is not None:
                places.append({"name": tags["name"], "lat": lat, "lng": lng, "amenity": tags.get("amenity"), "verified": False})
        return {"city": city, "query": safe_query, "places": places, "source": "OpenStreetMap Overpass", "available": True}
    except (httpx.HTTPError, ValueError, TypeError):
        return {"city": city, "query": safe_query, "places": [], "source": "Overpass unavailable", "available": False}
