"""
Adds freely licensed photos to data/venues.json from Wikipedia / Wikimedia Commons.

- Places with their own Wikipedia article get a photo of the place itself
  (image_kind = "place").
- Other venues (most restaurants and cafés have no free photo) get a photo of
  the food or activity they are known for (image_kind = "representative"), and
  the UI labels it "Representative photo".

Every image keeps a link to its Commons file page for attribution and licence.
Run from backend/:  python scripts/add_venue_images.py
"""
import json
import sys
import time
import urllib.parse
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parent.parent / "data" / "venues.json"
API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
HEADERS = {"User-Agent": "DatePilot/0.1 (https://github.com/sudarsan2507-hue/DatePilot; venue photo import)"}

# Venue id -> Wikipedia article about that exact place.
PLACE_ARTICLES = {
    "chn-18": "DakshinaChitra",
    "chn-19": "Cholamandal Artists' Village",
    "chn-22": "Madras Literary Society",
    "chn-23": "Kalakshetra Foundation",
    "chn-24": "Connemara Public Library",
    "chn-26": "Marina Beach",
    "chn-27": "Elliot's Beach",
    "chn-28": "Broken Bridge (Chennai)",
    "chn-29": "Muttukadu",
    "chn-30": "Kovalam, Chennai",
    "chn-31": "Semmozhi Poonga",
    "chn-32": "ITC Grand Chola",
    "chn-33": "Taj Fisherman's Cove",
    "cbe-03": "Gedee Car Museum",
    "cbe-07": "Valankulam Lake",
    "cbe-08": "Race Course, Coimbatore",
    "mdu-01": "Murugan Idli Shop",
    "mdu-03": "Gandhi Memorial Museum, Madurai",
    "mdu-04": "Thirumalai Nayak Palace",
    "mdu-07": "Vandiyur Mariamman Teppakulam",
}

# Hand-picked stand-in photo (food or activity the venue is known for) when the
# venue itself has no free photo.
REPRESENTATIVE_BY_ID = {
    "chn-01": "Dessert", "chn-02": "Indian filter coffee", "chn-03": "Indian filter coffee",
    "chn-04": "Pizza", "chn-05": "Pasta", "chn-06": "Chocolate cake", "chn-07": "Cupcake",
    "chn-08": "Gelato", "chn-09": "Pizza", "chn-10": "Thali", "chn-11": "Thali",
    "chn-12": "Idli", "chn-13": "Waffle", "chn-14": "Biryani", "chn-15": "Vegetarian cuisine",
    "chn-16": "Pasta", "chn-17": "Kebab", "chn-18": "Craft", "chn-19": "Art gallery",
    "chn-20": "Pottery", "chn-21": "Board game", "chn-25": "Standup paddleboarding",
    "chn-28": "Sunset", "chn-29": "Boathouse", "chn-33": "Seafood", "chn-34": "Kebab",
    "chn-35": "Chettinad cuisine", "chn-36": "Pasta",
    "cbe-01": "Idli", "cbe-02": "Thali", "cbe-04": "Museum", "cbe-05": "Dessert",
    "cbe-06": "Indian filter coffee", "cbe-08": "Sunset", "cbe-09": "Fine dining",
    "cbe-10": "Mughlai cuisine",
    "mdu-02": "Thali", "mdu-05": "Indian filter coffee", "mdu-06": "Falooda",
    "mdu-08": "Garden", "mdu-09": "Thali", "mdu-10": "Pizza",
}

# Fallback article by what the venue is known for (first match wins).
REPRESENTATIVE = [
    (("jigarthanda",), "Jigarthanda"),
    (("chocolate", "desserts", "dessert"), "Chocolate cake"),
    (("bakery",), "Bakery"),
    (("coffee", "cafe", "café"), "Indian filter coffee"),
    (("chettinad",), "Chettinad cuisine"),
    (("seafood", "coastal"), "Fish curry"),
    (("north-indian", "mughlai", "tandoor"), "Tandoori chicken"),
    (("thai", "asian"), "Thai cuisine"),
    (("italian", "pizza", "continental"), "Pizza"),
    (("south-indian", "tiffin", "idli", "meals", "vegetarian"), "Banana leaf meal"),
    (("board-games", "games"), "Board game"),
    (("pottery",), "Pottery"),
    (("museum", "heritage", "cultural"), "Museum"),
    (("paddle", "water-sports", "beach"), "Stand up paddle boarding"),
    (("garden", "park", "lake"), "Garden"),
]


def lookup(client: httpx.Client, title: str) -> dict | None:
    r = client.get(API + urllib.parse.quote(title.replace(" ", "_"), safe=""), follow_redirects=True)
    if r.status_code != 200:
        return None
    data = r.json()
    thumb = data.get("thumbnail") or data.get("originalimage")
    if not thumb:
        return None
    src = thumb["source"].split("?", 1)[0]
    # Ask for a 500px rendition (Wikimedia only serves standard widths: 250, 330, 500, 960...).
    if "/thumb/" in src:
        head, _, tail = src.rpartition("/")
        size, sep, name = tail.partition("px-")
        if sep and size.isdigit():
            src = f"{head}/500px-{name}"
    file_name = urllib.parse.unquote(src.split("/")[-1].split("px-", 1)[-1])
    return {
        "image_url": src,
        "image_page": f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(file_name)}",
        "image_title": data.get("title", title),
    }


def representative_title(venue: dict) -> str | None:
    if venue["id"] in REPRESENTATIVE_BY_ID:
        return REPRESENTATIVE_BY_ID[venue["id"]]
    tags = [t.lower() for t in venue.get("cuisine_tags", []) + venue.get("vibe_tags", [])]
    name = venue["name"].lower()
    for keys, title in REPRESENTATIVE:
        if any(k in tags or k in name for k in keys):
            return title
    return {"cafe": "Indian filter coffee", "lunch": "Banana leaf meal", "dinner": "Indian cuisine",
            "activity": "Museum", "sunset": "Sunset"}.get(venue["type"])


def main() -> None:
    venues = json.loads(DATA.read_text(encoding="utf-8"))
    cache: dict[str, dict | None] = {}
    with httpx.Client(headers=HEADERS, timeout=20) as client:
        def cached(title: str) -> dict | None:
            if title not in cache:
                cache[title] = lookup(client, title)
                time.sleep(0.2)
            return cache[title]

        for v in venues:
            found, kind = None, None
            if v["id"] in PLACE_ARTICLES:
                found, kind = cached(PLACE_ARTICLES[v["id"]]), "place"
            if not found:
                title = representative_title(v)
                found, kind = (cached(title), "representative") if title else (None, None)
            for key in ("image_url", "image_page", "image_title", "image_kind"):
                v.pop(key, None)
            if found:
                v.update(found)
                v["image_kind"] = kind
            print(f"{v['id']:7} {kind or 'none':15} {(found or {}).get('image_title', '-')}")

    DATA.write_text(json.dumps(venues, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_images = sum(1 for v in venues if v.get("image_url"))
    places = sum(1 for v in venues if v.get("image_kind") == "place")
    print(f"\n{with_images}/{len(venues)} venues have a photo ({places} of the place itself)")


if __name__ == "__main__":
    sys.exit(main())
