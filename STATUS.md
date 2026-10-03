# DatePilot (DateOptimizer) — Project Status & Roadmap

**Hackathon Challenge:** DEV Hacktoberfest Weekend Challenge  
**Core Mission:** An open-model AI agent that constructs a real, constraint-checked date for two partners in Chennai, India.  
**Core Guarantee:** Open-weight models (Gemma 4/3 via Ollama or hosted endpoints) ensure her taste data stays completely private and local. Deterministic code does all the math.

---

## 1. What Is Completed Till Now

### Core Models & Database Layer
- [x] **Curated Chennai Venue Database (`venues.json`)**: Hand-curated dataset of 36 real Chennai venues spanning 5 slots (`lunch`, `activity`, `cafe`, `sunset`, `dinner`) across key Chennai localities (Alwarpet, Adyar, Besant Nagar, Mylapore, Nungambakkam, ECR, Marina, Guindy, etc.). Contains accurate geographic coordinates, typical durations, operating hours per day (with split shifts), cuisine tags, vibe tags, veg-friendly flags, indoor flags, ratings, and Google Maps source links.
- [x] **Pydantic & SQLModel Schemas (`schema.py`)**: `TasteCard`, `PriceComfort`, `SlotType`, `Venue`, `PlannedStop`, `DatePlan`, `SessionCreate`, `SessionDB`, `TasteMemoryDB`, `StopFeedback`.
- [x] **SQLite Database Layer (`db.py`)**: Automatic table creation for sessions and memory.
- [x] **Memory & Feedback Interface (`memory.py`)**: Stable interface for storing taste profiles, recording post-date ratings (1-5 + notes), and generating learned taste insights ("What I learned about you two") ready for HippocampAI.
- [x] **GDPR Privacy Deletion (`memory.py`)**: Instant and permanent data deletion mechanism for any partner.

### Pure Python Deterministic Date Planner
- [x] **Beam Search Itinerary Solver (`planner.py`)**: Pure deterministic Python (no LLM math errors).
- [x] **Hard Constraint Engine**:
  - Total cost ≤ budget (strictly takes the minimum of both partners' limits).
  - All stops verified open during arrival and departure windows.
  - Inter-stop travel time ≤ max travel limit (Haversine formula × road factor 1.4 ÷ 24 km/h Chennai traffic speed).
  - Whole itinerary fits within requested time window.
  - Strict dietary enforcement (union of vegetarian/vegan signals).
  - Strict exclusion of dislikes from either partner.
- [x] **Soft Scoring & Variety**: Optimizes for taste overlap, venue ratings, travel efficiency, budget reserve, and cuisine variety.
- [x] **Ranked Backup Venues**: Automatically computes and assigns the second-best open venue for each stop.
- [x] **Rain Mode Protocol Generator (`planner.py`)**: Generates Plan B with indoor weather-proof substitutions and dynamic trigger notes.

### Open-Model AI Layer & Consent-Based Extraction
- [x] **Swappable LLM Wrapper (`llm.py`)**: Supports Ollama endpoints (`/api/chat`) for Gemma 4/3 and hosted OpenAI-compatible endpoints (`/v1/chat/completions`), with resilient fallback if offline.
- [x] **Defensive Instagram & Social Parser (`taste_extractor.py`)**: Walks Instagram export zip and JSON files defensively, extracts captions, hashtags, and locations, deletes raw uploads immediately from memory.
- [x] **Screenshot Vision Parser (`taste_extractor.py`)**: Analyzes aesthetic screenshots via vision model with fallback.
- [x] **Privacy Safeguards**: Enforces strict removal of religion, health, and sexuality from prompts and output.
- [x] **Factual AI Writer (`writer.py`)**: Writes "Why we picked this" per stop using strictly verified facts. Generates friendly itinerary text and validates numbers against planner output.

---

## 2. What Is Being Finished Now

1. **FastAPI Endpoints (`routers/`)**:
   - `POST /sessions/` (Session creation with dual share tokens)
   - `GET /sessions/{token}` (Session retrieval without leaking partner's raw preferences)
   - `POST /sessions/{token_b}/limits` (Partner B private limits)
   - `GET /sessions/{token}/match-summary` ("What we matched on" overlap card)
   - `POST /taste/{token}/upload` (IG export / screenshot upload with instant raw file discard)
   - `POST /taste/{token}/quiz` (Manual romantic quiz fallback)
   - `POST /taste/{token}/confirm` (Consent confirmation of reviewed Taste Card)
   - `DELETE /taste/{token}` ("Delete all my data" GDPR wipe)
   - `POST /plan/{token_a}/generate` (Top 3 date plans generation)
   - `GET /plan/{token}/current` (Current active plan)
   - `POST /plan/{token}/swap/{plan_index}/{stop_index}` (Slot re-solver with before/after diff)
   - `POST /plan/{token}/rain-mode/{plan_index}` (Rain Plan B toggle)
   - `POST /plan/{token}/rate` (Post-date stop ratings 1-5 & review notes)
   - `GET /plan/{token}/memory-insights` ("What I learned about you two" summary)

2. **Frontend UI (React + Vite + Tailwind CSS)**:
   - Mobile-first, romantic-minimal aesthetic (blush rose, warm slate, elegant serif accents, cards).
   - Partner A setup screen (budget, date, time window, Chennai starting area, max travel, enabled slots).
   - Partner B private invite link screen with copy button.
   - Interactive Taste Card profiling (Upload IG Export, Upload Screenshot, or Romantic Preference Quiz).
   - Taste Card Review Modal (editable tags, delete buttons, confidence badges, confirm button, delete all data button).
   - "What We Matched On" private overlap card.
   - 3-Plan Carousel with constraint checklist badges (Budget ✓, Hours ✓, Travel ✓, Dietary ✓).
   - Timeline cards per stop with photos, times, travel estimates, why-picked reasoning, and backup venues.
   - Live "Swap Stop" modal with instant cost and travel diff calculation.
   - Rain Mode toggle & Stay recommendation toggle.
   - Post-date rating modal with memory feedback.

3. **Deployment & Dev Experience**:
   - `render.yaml` for 1-click Render backend + static frontend build.
   - Dockerfile and start scripts.
   - Full automated test suite verifying constraints, planner, and API routes.

---

## 3. The 15 Logical Commits Plan

1. `feat(core): schema models, memory interface, and curated Chennai venue dataset` *(done)*
2. `feat(planner): deterministic beam-search date planner with constraint validation & time slot engine` *(done)*
3. `feat(ai): open-model LLM integration (Gemma/Ollama) with fallback & Instagram/quiz taste extractor` *(done)*
4. `feat(sessions): private 2-person session management, invite tokens & anonymous match summary`
5. `feat(taste-api): consent-based taste card upload, quiz, review, and GDPR data wipe routes`
6. `feat(plan-api): top-3 itinerary generation, stop swapping diff engine & rain mode protocol`
7. `feat(memory-api): post-date stop rating, learned taste feedback & memory insights endpoints`
8. `test(backend): comprehensive test suite for planner constraints, API routes & fallbacks`
9. `feat(ui-setup): configure Tailwind CSS, romantic-minimal design system, and API service layer`
10. `feat(ui-session): session creation, Chennai area picker, time window controls & partner invite link`
11. `feat(ui-taste): taste profiling uploader, screenshot parser, interactive quiz & review card`
12. `feat(ui-match): 'What We Matched On' anonymous overlap summary component`
13. `feat(ui-itinerary): multi-plan carousel, constraint checklist, timeline stops & ranked backups`
14. `feat(ui-interactive): single-stop swap diff modal, rain mode toggle & post-date rating memory`
15. `docs(deploy): Render deployment configuration, project documentation, status tracking & demo assets`
