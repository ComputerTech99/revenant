# Revenant — Stage Demo & Full Setup Guide (Aditya)

## Pre-stage checklist (2 minutes before going on)

1. **Seed and start the Backend (`:8000`)** *(Terminal 1, from repo root)*:
   ```powershell
   cd backend
   ..\.venv\Scripts\python.exe -m app.seed
   ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```
   - Verify `http://localhost:8000/api/health` returns `{"ok": true, ...}`.
   - The seeded **Photosynthesis** deck (`backend/seed/demo_deck.json`) is loaded into SQLite (`backend/data/revenant.db`) and works **even if Ollama is down** (including `explain` cards, which fall back to keyword-overlap scoring in `backend/app/grade.py`).

2. **Start the Frontend (`:5173`)** *(Terminal 2, from repo root)*:
   - **Live backend mode** (set `VITE_USE_MOCKS=false` in `frontend/.env`):
     ```powershell
     cd frontend
     npm.cmd run dev
     ```
   - **Mock fixture mode** (set `VITE_USE_MOCKS=true` in `frontend/.env` for the *Operating Systems, Unit 3* 47-card fixture with pre-varied concept health):
     ```powershell
     cd frontend
     npm.cmd run dev
     ```

3. **Browser setup**:
   - Open `http://localhost:5173` at `1280px` width.
   - Click the **sparkle + number** button on the right of the floating top navigation pill (or run `localStorage.clear()` in DevTools and refresh) so the **Onboarding tagline screen** is ready on stage.
   - Click **Reset** on the Path page's **Demo: time travel** pill beforehand so the clock starts at day 0.

---

## 0:00 – 0:35 · Opening Shot: Onboarding Tagline & Daily Goal

1. **On screen**: Full-screen onboarding view. Watch the tagline brighten word by word on the `cubic-bezier(0.32, 0.72, 0, 1)` curve:
   > *"Notes that come back / to haunt you, on schedule."*
2. **What to say**:
   - "Students highlight PDFs and forget 70% within a week. Flashcard apps fail because making cards is tedious and AI flashcards hallucinate."
   - "Revenant runs locally with Gemma and SM-2 scheduling to turn lecture PDFs into grounded spaced repetition."
3. **Exact click**:
   - Click **Casual · 5** or **Regular · 15**. This posts `{ "daily_goal": 5 }` (or `15`) to `POST /api/settings` and reveals **Home**. *(Tip: picking **Casual · 5** lets you hit the daily goal and trigger confetti + Ghost solidification after just 5 cards on stage.)*

---

## 0:35 – 1:15 · Home, the Ghost Mascot & Seeded Deck vs PDF Upload

1. **On screen**:
   - Point out the **Ghost mascot** floating on the right (opacity `0.35` when streak is 0, `0.70` when streak > 0, `1.0` with a bounce when the daily goal is met), the **streak counter** in Geist Mono, **streak freezes**, and the **daily XP ring**.
   - Point out the seeded deck (**Photosynthesis** on live backend, or **Operating Systems, Unit 3** in mock mode) with its due count and concept mastery bar.
2. **Exact click (PDF Upload)**:
   - Drag and drop `backend/tests/fixtures/photosynthesis.pdf` (or any lecture PDF) onto **Drag and drop a lecture PDF here**.
   - Show client-side validation (PDF only, ≤ 20 MB) and the live progress bar polling `GET /api/decks/:deck_id` every 2 seconds.
3. **Fallback if the local model is slow**:
   - Do **not** wait for a large PDF to finish chunking on stage. Immediately say: *"While Gemma processes new chapters in the background, let's jump into our seeded deck which is already indexed."*
   - Click **Review deck** on the seeded deck.

---

## 1:15 – 2:15 · Grounded Review Session (MCQ, Cloze, Explain & Page Citations)

> **Why Review comes before Path on the live backend**: Newly seeded cards start with `status: "new"` (`last_reviewed_at = null`). Reviewing 2–3 cards sets their SM-2 `last_reviewed_at` timestamp and brings their concept health to `100%`, so when you time-travel on the Path screen next, those exact concepts visibly decay and crack.

1. **Card 1 — Multiple choice (`mcq`)**:
   - Press key **`1`** (or click the correct option) to answer in a single keystroke.
   - **Crucial click**: Click the **From page N** chip in the feedback block to expand the **Verbatim PDF excerpt**.
   - **What to say**: "Every card is validated against the PDF chunk before saving—if the verbatim snippet isn't in your notes, Revenant rejects the card."
   - Press **`Enter`** to continue.
2. **Card 2 — Explain it back (`explain`)**:
   - Type a one-sentence explanation (e.g., *"Light energy splits water into oxygen, protons and electrons"*) and press **`Enter`**.
   - Point out the **layout-shaped skeleton feedback block** while Gemma grades the response (`POST /api/review/:id/explain`), returning a 0–1 score, two-sentence feedback, and the grounded page citation.
3. **Card 3 — Fill the blank (`cloze`)**:
   - Type the missing word (e.g., `stroma` or `reflects`) into the inline blank and press **`Enter`**.
   - Finish the remaining cards to reach **Session End**: calm copy (*"Goal reached."*), XP gained, session accuracy, *"N cards return tomorrow, M next week"*, and confetti.

---

## 2:15 – 3:00 · The Centrepiece: Concept Path & Time Travel

1. **Exact click**:
   - Click **View concept path** (or **Path** in the floating glass pill).
2. **On screen**:
   - Point out the winding vertical path of concepts:
     - **Solid with warm amber glow** (`health ≥ 0.85`)
     - **Slightly faded** (`0.70 – 0.85`, learning)
     - **Cracked in red** (`0.50 – 0.70`, shaky)
     - **Heavily cracked & ghostly** (`health < 0.50`)
     - **Outlined & locked** (`new`)
   - Tap a concept node to expand its one-sentence summary and PDF page chips.
3. **Exact clicks (Time Travel centrepiece)**:
   - In the top-right **Demo: time travel** pill, click **`+1 day`**, then click **`+7 days`**.
   - Watch the concept nodes animate and **visibly crack and turn ghostly** as `POST /api/debug/timewarp` advances the server clock and SM-2 retention health decays according to `0.9 ^ (days / interval)`.
4. **Closing line**:
   - "Revenant makes forgetting visible before the exam, grounds every question in your own PDF, and runs 100% locally on your laptop."

---

## Architecture, Model Setup & Credits (for Judges Q&A)

### Architecture in Five Lines
1. **Ingest (`backend/app/ingest.py`)**: Extracts text per page with `pypdf` (up to 40 pages) and merges consecutive pages into 1,500–2,500 character chunks with page maps.
2. **Grounded Generation (`backend/app/generate.py`)**: Prompts Gemma (`ollama` or `gemini_api`) for 1–3 concepts and 2–4 cards (`mcq`, `cloze`, `explain`) per chunk, rejecting any card whose `source.snippet` is not a whitespace-normalised substring of the PDF chunk.
3. **SM-2 & Retention Decay (`backend/app/scheduler.py`)**: Schedules card intervals via SM-2 (`again→1`, `hard→3`, `good→4`, `easy→5`) and computes live card/concept retention health as `0.9 ^ (days_since_last_review / interval_days)`.
4. **Explain-Back Grader (`backend/app/grade.py`)**: Evaluates free-text answers with Gemma against the model answer and verbatim PDF snippet, falling back to content-word overlap if the local model is offline.
5. **Browser Experience (`frontend/src/`)**: React + Vite + Tailwind CSS v4 + Framer Motion UI that renders the Ghost mascot, grounded review session with expandable page excerpts, and the winding concept path with live time-travel decay.

### Local Model & `.env` Setup
```bash
ollama pull gemma4:e4b
cp .env.example .env
```
- Default `.env` uses `LLM_PROVIDER=ollama`, `OLLAMA_URL=http://localhost:11434`, `GEMMA_MODEL=gemma4:e4b`.
- To use the Gemini API fallback, set `LLM_PROVIDER=gemini_api` and `GEMINI_API_KEY=...` in `.env`.

### AI Tools & Open-Source Credits
- **AI Tools Used**: Google Antigravity (frontend), Claude Code (backend), Google Gemma 4 (`gemma4:e4b` via Ollama / Gemini API).
- **Backend Libraries (OSI-licensed)**: FastAPI, Uvicorn, Pydantic, `pypdf` (BSD-3-Clause), `httpx` (BSD-3-Clause), `sqlite3`, `pytest` (MIT).
- **Frontend Libraries (OSI-licensed)**: React 19 (MIT), Vite 6 (MIT), Tailwind CSS v4 (MIT), Framer Motion (MIT), React Router (MIT), Phosphor Icons (MIT), `canvas-confetti` (ISC), Fontsource Geist Sans & Geist Mono (OFL-1.1).
