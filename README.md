# DatePilot / DateOptimizer

DatePilot builds a real, constraint-checked Tamil Nadu date for two people. Partner A chooses a supported city and starting locality; each partner then submits preferences privately, and the application reveals only their overlap. An open-weight model extracts taste and writes explanations, while deterministic Python enforces city boundaries, budget, opening hours, dietary rules, travel limits, and the requested time window.

The launch dataset supports Chennai, Coimbatore, and Madurai. Every venue is tagged by city so plans, backups, swaps, and rain alternatives cannot cross city boundaries. More Tamil Nadu cities can be added by extending the locality map and curated venue data.

## Keyless live data

DatePilot optionally enriches a generated plan with free public services:

- OSRM provides live driving distance/time per itinerary leg (`/plan/{token}/routes/{plan_index}`), with the deterministic Haversine estimate as fallback.
- Open-Meteo provides the selected city’s forecast and rain signal (`/live/weather`).
- OpenStreetMap Overpass provides nearby discovery suggestions (`/live/nearby`). Discovery results are marked unverified and never enter a plan automatically; only the curated venue file is used for hard constraints.

These integrations require no API keys and use short timeouts so a provider outage never blocks planning.

## Run locally

Backend (Python 3.11):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Set-Location backend
uvicorn app.main:app --reload
```

Frontend, in another terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

The frontend defaults to `http://localhost:8000`. To use another API, set `VITE_API_URL` before building. Copy `backend/.env.example` to `backend/.env` to configure Ollama or a hosted OpenAI-compatible open-weight endpoint.

## Verify

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
Set-Location frontend
npm run build
```

## Deploy on Render

The root `render.yaml` creates a FastAPI web service and a Vite static site in Render's Singapore region. Set `OPENAI_BASE_URL` and `OPENAI_API_KEY` during Blueprint creation to use a hosted Gemma-compatible endpoint. Without an available model endpoint, deterministic fallbacks keep the demo functional.

The free Render filesystem is ephemeral, so SQLite data can reset after a restart or redeploy. This is acceptable for the hackathon demo; attach a persistent disk and change `DB_PATH` for longer-lived use.

[Deploy the Blueprint on Render](https://dashboard.render.com/blueprint/new?repo=https://github.com/sudarsan2507-hue/DatePilot)

## Privacy

- No Instagram login or scraping.
- Only user-uploaded exports and screenshots are accepted.
- Raw upload bytes are not written to disk and are discarded after extraction.
- Taste Cards are stored only after review and confirmation.
- Dietary signals become constraints only when present in the confirmed card.
- The delete action removes that partner's confirmed Taste Card and feedback.
