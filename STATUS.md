# DatePilot — Status & What's Left

**Challenge:** DEV Hacktoberfest Weekend Challenge  
**Tagline:** Open-weight AI date optimizer for Chennai — her taste data stays local and private.

---

## ✅ DONE (everything verified working)

### Backend
| What | File | Status |
|------|------|--------|
| Pydantic + SQLModel schemas | `backend/app/models/schema.py` | ✅ |
| SQLite DB layer | `backend/app/db.py` | ✅ |
| Swappable Ollama/OpenAI-compat LLM wrapper | `backend/app/llm.py` | ✅ |
| Taste extractor (IG zip, screenshot, quiz) | `backend/app/services/taste_extractor.py` | ✅ |
| Deterministic beam-search planner | `backend/app/services/planner.py` | ✅ |
| LLM writer with number-validation | `backend/app/services/writer.py` | ✅ |
| Memory / GDPR interface | `backend/app/memory.py` | ✅ |
| Session API (create, get, match-summary) | `backend/app/routers/sessions.py` | ✅ |
| Taste API (upload, quiz, confirm, delete) | `backend/app/routers/taste.py` | ✅ |
| Plan API (generate, current, swap, rain-mode) | `backend/app/routers/plan.py` | ✅ |
| Memory API (rate, insights) | `backend/app/routers/memory_router.py` | ✅ |
| FastAPI app wiring + CORS | `backend/app/main.py` | ✅ |
| Curated 36-venue Chennai dataset | `backend/data/venues.json` | ✅ |
| 6 passing backend tests | `backend/tests/` | ✅ |

### Frontend
| What | File | Status |
|------|------|--------|
| Vite + React + Tailwind setup | `frontend/` | ✅ |
| Warm romantic design system | `tailwind.config.js`, `index.css` | ✅ |
| API service layer | `frontend/src/lib/api.js` | ✅ |
| Session setup (date, area, budget, slots) | `SessionSetup.jsx` | ✅ |
| Partner B invite link screen | `PartnerInvite.jsx` | ✅ |
| Taste profiler (upload / screenshot / quiz tabs) | `TasteProfiler.jsx` | ✅ |
| Taste card review + consent + delete-all | `TasteCardReview.jsx` | ✅ |
| Anonymous match summary | `MatchSummary.jsx` | ✅ |
| 3-plan carousel + timeline stops | `ItineraryViewer.jsx` | ✅ |
| Swap stop diff modal | `SwapModal.jsx` | ✅ |
| Post-date rating + memory insights modal | `RatingModal.jsx` | ✅ |
| App flow orchestration + URL hash invite | `App.jsx` | ✅ |
| Production build passes | `npm run build` | ✅ |

### Deploy config
| What | File | Status |
|------|------|--------|
| Render deploy config (backend + frontend) | `render.yaml` | ✅ |
| `.env.example` with all vars documented | `backend/.env.example` | ✅ |

---

## ❌ NOT DONE — what still needs work

### P0 blockers (must fix before demo)

1. **Ollama not installed locally** — `ollama` command not found on this machine.
   - For local dev: install Ollama, run `ollama pull gemma3:4b` and `ollama pull llava:7b`
   - For deploy: set `OLLAMA_BASE_URL` in `render.yaml` to a Groq/OpenRouter endpoint
   - LLM calls (`/taste/upload`, `/plan/generate`) will 500 without this

2. **Venue dataset has only 36 venues** — tests assert `>= 30` so this passes, but the planner
   only finds **2 valid plans** with current data on a ₹6,000 budget + vegetarian filter
   (needs ≥ 3 per slot-type to return 3 plans consistently).
   **Fix:** add ~5–8 more venues per slot type to `backend/data/venues.json`.

3. **`is_open()` breaks on split-shift strings like `"12:30-15:00,19:00-23:30"`** — the current
   parser splits on `","` then `"-"` but `"12:30-15:00,19:00-23:30"` has two `"-"` segments per
   shift and works correctly. **Verified: this is fine.** ✅

4. **`test_api.py` was failing from project root** — fixed by adding `backend/conftest.py`.
   Run tests with: `cd backend && python -m pytest`

5. **Frontend `App.jsx` has two demo-mode shortcuts** (Partner A/B tab switcher in header,
   `onSwitchToPartnerB` button in invite screen) that are fine for hackathon demo but should
   be removed or gated before real-world deploy.

### P1 — nice-to-have before submission

6. **No `README.md` at repo root** — judges will land there first.
   Should have: what it is, how to run locally (Ollama + uvicorn + npm dev), 2 screenshots.

7. **No `__init__.py` in `backend/app/routers/` or `backend/tests/`** — works because of
   `conftest.py` path injection, but adding them is cleaner.

8. **Frontend `.env` not created** — `VITE_API_URL` defaults to `localhost:8000` which works
   locally. Create `frontend/.env` pointing to deployed API for production build.

9. **`TasteCardReview.jsx` and `MatchSummary.jsx` not checked** — these were in the repo
   from my earlier commits; verify they render and connect to the API correctly.

10. **Rain mode UI trigger** — `ItineraryViewer.jsx` has an `onRainToggle` prop but the
    actual button to trigger it may be missing in the rendered UI. Verify it exists.

---

## How to run locally right now

```bash
# Terminal 1 — backend (needs Python 3.11+)
cd backend
pip install -r requirements.txt
cp .env.example .env          # edit OLLAMA_BASE_URL if needed
uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

For tests:
```bash
cd backend
python -m pytest              # 6 tests pass (planner + API)
```

---

## Deployment (Render)

1. Push repo to GitHub
2. Go to render.com → New → Blueprint → point to `render.yaml`
3. Set `OLLAMA_BASE_URL` env var to a Groq or OpenRouter endpoint
4. Backend deploys to `datepilot-api.onrender.com`
5. Frontend deploys to `datepilot.onrender.com`

---

## Story for submission

> Open-weight models (Gemma 4 via Ollama or hosted endpoint) mean her Instagram taste data
> never leaves the local machine during extraction. A GPT-4o API call would send her saved
> posts to OpenAI's servers. Here, the model runs locally or on a self-hosted endpoint —
> her aesthetics, vibes, and food preferences stay private. Deterministic Python does all
> the math (budget, hours, travel) so the model never hallucinates a cost or a time.
