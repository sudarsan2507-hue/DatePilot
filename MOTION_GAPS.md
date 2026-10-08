# Motion gaps — DatePilot

Where motion graphics could go, measured in a real browser (Playwright, Chromium) at three
viewport widths: **1440 × 900** (laptop), **1024 × 768** (small laptop / tablet landscape) and
**390 × 844** (phone). Sizes are CSS pixels. "Gap" means space with no content in it today.

Line numbers refer to the files as of this audit.

---

## 1. Project theme (so animations match)

**What it does.** DatePilot plans a date for two people in Chennai, Coimbatore and Madurai.
Each partner answers privately on their own phone; a local open-weight model (Gemma via
Ollama) reads their tastes, and a deterministic planner builds three plans that fit the budget,
opening hours and driving limits, shown with photos, a route map and navigation.

**Look and feel.** Calm, editorial, warm. Light mode only (`color-scheme: light`, no dark theme).
Rules live in `.claude/skills/datepilot-ui/SKILL.md`.

| Token | Hex | Used for |
|---|---|---|
| `cream` | `#f4f0e8` | Page background |
| `paper` | `#fffdf9` | Cards |
| `line` | `#ded5c8` | 1px borders |
| `well` | `#f9f6f0` | Inputs, wells |
| `ink` | `#382a22` | Main text |
| `ink-2` | `#59473b` | Secondary text |
| `ink-3` | `#746358` | Muted text |
| `accent` | `#8f4935` (hover `#763c2d`) | Primary action, active step |
| `accent-soft` | `#a65d45` | Accents, timeline, route line |
| `sage` | `#7f8a70` | "OK" ticks, illustration greenery |
| Illustration only | `#d7bca0` sand, `#f6ddae` sun, `#ab7660` clay, `#3d3027` deep brown | Hero card and side scenes |

- **Fonts.** Headings: Georgia (`font-serif`, weight 400). Body: "Avenir Next", "Segoe UI",
  system-ui (`font-sans`). System fonts only, nothing downloaded.
- **Radius.** 8px (`rounded-lg`) for buttons, inputs, chips; 12px (`rounded-xl`) for cards and
  sheets. `rounded-full` only for dots, avatars and step circles.
- **Depth.** 1px `line` borders first; one soft shadow (`shadow-soft`).
- **Motion already in use.** 150–250ms ease-out for UI; slower eased "story" motion for the hero
  scene, planning scene and side scenes (`cubic-bezier(.2,.7,.2,1)`); everything stops under
  `prefers-reduced-motion`.
- **Framework.** React 19 + Vite 8 + Tailwind CSS 3, JavaScript (no TypeScript), single page with
  a `view` state machine in `frontend/src/App.jsx` (no router).
- **How assets load.**
  - Illustrations are inline SVG/CSS in components (`App.jsx` hero, `SideScenes.jsx`,
    `PlanningScene.jsx`). No image files for decoration.
  - Icons: `lucide-react` (line icons, `strokeWidth 1.5`).
  - Venue photos: hot-linked 500px thumbnails from Wikimedia Commons (URLs stored in
    `backend/data/venues.json`).
  - Map: Leaflet with OpenStreetMap tiles.
  - Static files: `frontend/public/` is served at the site root (e.g. `/favicon.svg`), so
    `/public/intro/intro.webm` is reachable as `/intro/intro.webm`.

---

## 2. Gaps

### Summary

| # | Gap | 1440 | 1024 | 390 | Shown on phone? | Today |
|---|---|---|---|---|---|---|
| 1 | Side gutters on form steps, 768–1179px wide | filled | **176 × full height, each side** | none | — | **Empty** |
| 2 | Side gutters on the plans page | **208 × ~3,300, each side** | 24 (none) | none | — | **Empty** |
| 3 | Blank band under short steps, above the footer | **~100–190 tall** | ~60–100 | ~60 | yes | **Empty** |
| 4 | Waiting for partner (empty state) | 672 × ~300 card | same | 358 × ~330 | yes | Static clock icon |
| 5 | "Reading your answers" wait after the quiz | button only | same | same | yes | **No visual, 10–20 s** |
| 6 | Hero, left column above/below the text | **520 × ~125 above + ~125 below** | 456 × ~25 | none (stacked) | no | **Empty** |
| 7 | Upload drop zones (Instagram / screenshots) | ~606 × 230 | same | ~316 × 290 | yes | Static icon |
| 8 | Invite card header | 672 × ~120 | same | 358 × ~140 | yes | Text only |
| 9 | Plans summary column below the sticky card | 320 × ~2,300 (scrolls under sticky) | same | — | no | Empty, but sticky |
| — | Already animated | hero card, side scenes (≥1180px), planning scene, step bar, map | | | | |

### 1. Side gutters on form steps when the window is 768–1179px wide
- **Where:** left and right of the main card on every form step: setup (below the hero), your
  tastes, review, private limits, invite, match, planning.
- **Code:** `frontend/src/App.jsx:495` (the `min-[1180px]:grid` wrapper) and the two
  `<aside className="hidden min-[1180px]:…">` at `App.jsx:497` and `App.jsx:591`. The side scenes
  (`components/SideScenes.jsx:147` `SideArtLeft`, `:165` `SideArtRight`) only appear from 1180px.
- **Sizes:** 1440: **filled** (two 240px columns of side art; left 581px tall, right 419px).
  1024: **176px each side, as tall as the card** (454px on limits up to 1,024px on taste), and
  completely empty. 390: none (16px page margins).
- **Mobile:** not applicable (no gutter).
- **Suggested motion:** a slim, quiet vertical piece that fits 120–150px wide, e.g. a kolam
  (rice-flour pattern) slowly drawing itself, or a few jasmine petals drifting down. Stay in the
  illustration palette, opacity/translate only, pause off-screen.

### 2. Side gutters on the plans page
- **Where:** left and right of the plans layout (plans are `max-w-5xl`; side art is turned off
  on this view).
- **Code:** `App.jsx:495` (`view === 'plans' ? ''` disables the grid) and
  `components/ItineraryViewer.jsx:134` (`lg:grid-cols-[1fr_320px]`).
- **Sizes:** 1440: **208px each side**, the full page height (~3,300px). 1024: 24px (none).
  390: none.
- **Mobile:** not applicable.
- **Suggested motion:** very light, so it doesn't compete with photos and the map, e.g. a thin
  dotted route line that draws down the margin as you scroll past each stop, ending at a small sun
  for the sunset stop. Only at ≥1280px.

### 3. Blank band under short steps, above the footer
- **Where:** between the bottom of the card and the footer on short steps: private limits,
  invite, match.
- **Code:** `App.jsx:494` (`<main … pb-16>`) and the footer at `App.jsx:597`.
- **Sizes (measured):** 1440 × 900: limits ~191px, invite ~223px, match ~97px.
  1024 × 768: ~60–100px. 390: ~60px plus the footer.
- **Mobile:** yes, small.
- **Suggested motion:** a small two-dots-meet motif (two circles drifting together into a heart
  or a joined line), about 120 × 60px, centred, playing once when the step loads. Fits the
  "two people, one day" idea.

### 4. Waiting for your partner (empty state)
- **Where:** the card shown to the first partner until the second has answered.
- **Code:** `components/MatchSummary.jsx:30` (`if (!summary?.ready)`), a static `Clock` icon.
- **Sizes:** card 672 × ~300 at 1440 and 1024; 358 × ~330 at 390. The icon area is 24px.
- **Mobile:** yes.
- **Suggested motion:** two small orbiting dots (you and your partner) that slowly circle and
  pulse, replacing the clock, about 96 × 96px. Calm loop, ≥3s period, since this can last minutes.

### 5. "Reading your answers" wait after the quiz or an upload
- **Where:** after "Review my answers" or choosing a file, the local model takes 10–20 seconds.
  The only feedback is the button text changing.
- **Code:** `components/TasteProfiler.jsx` submit button (`loading ? 'Reading your answers…'`)
  and the upload panels at `TasteProfiler.jsx:122`.
- **Sizes:** whole card 672 × ~1,024 at 1440 and 1024; 358 × ~1,370 at 390.
- **Mobile:** yes; this is the most noticeable dead time on a phone.
- **Suggested motion:** a short "reading" scene over the form: the chosen chips gently lift into
  a small taste card that assembles itself, or the same route-drawing style as `PlanningScene.jsx`
  for consistency, plus a line such as "Reading your answers on this device".

### 6. Hero, left column above and below the headline
- **Where:** setup page hero. The text column is vertically centred against a taller card.
- **Code:** `App.jsx:412` (`items-center` grid); text column at `App.jsx:413` onwards.
- **Sizes:** 1440: text block 520 × 297 inside a 548px-tall row, so ~125px empty above and
  below. 1024: 456 × 368 in a 420px row (~25px). 390: none (stacked: text 358 × 270, card
  358 × 360).
- **Mobile:** no gap.
- **Suggested motion:** a single line of small animated "how it works" steps under the
  assurances (set the day → share tastes → three plans), drawn as a dotted line that fills in.
  Desktop only.

### 7. Upload drop zones
- **Where:** the Instagram and Screenshots tabs of "What do you enjoy?".
- **Code:** `components/TasteProfiler.jsx:122` (`uploadPanel`), a static `Upload` icon in a
  dashed box.
- **Sizes:** ~606 × 230 at 1440 and 1024; ~316 × 290 at 390.
- **Mobile:** yes.
- **Suggested motion:** the icon gently bobs on hover or drag-over, and a file flies in and
  "unpacks" into a few chips on success. Hover effects only on `(hover: hover)` devices.

### 8. Invite card header
- **Where:** top of "Now your partner's turn", above the link field.
- **Code:** `components/PartnerInvite.jsx:14`.
- **Sizes:** 672 × ~120 at 1440 and 1024; 358 × ~140 at 390.
- **Mobile:** yes.
- **Suggested motion:** a small paper plane or envelope that flies off when "Copy link" is
  pressed. One shot, under 1s.

### 9. Plans summary column below the sticky card (laptop)
- **Where:** right column of the plans page. The summary (320 × 631) is sticky, so the column
  below it is mostly hidden while scrolling.
- **Code:** `components/ItineraryViewer.jsx:259`.
- **Sizes:** 320 × ~2,300 at 1440 and 1024 (`lg:` and up). Stacked on phones.
- **Mobile:** no.
- **Suggested motion:** low priority. A tiny "now / next" indicator that follows the stop you're
  scrolling past would fit better than decoration.

### Already animated (no gap)
- Hero card on setup: sun rise, arches, birds (`App.jsx:412`).
- Side scenes at ≥1180px: rotating postcards and sample-day timeline (`SideScenes.jsx`).
- Planning scene while plans generate (`PlanningScene.jsx`).
- Step bar progress line (`App.jsx:453`), count-up totals, timeline line, route map drawing
  (`ItineraryViewer.jsx`, `RouteMap.jsx`).

---

## 3. Recommended order

1. **#5 "Reading your answers"**: the longest silent wait, on every device.
2. **#1 tablet-width gutters**: the most visible empty space (two 176px columns).
3. **#4 waiting for partner**: can last minutes; a calm loop helps.
4. **#3 under short steps**: small, but every short step shows it.
5. **#2, #6, #7, #8**: polish.
6. **#9**: only if it does a job (now/next), not decoration.
