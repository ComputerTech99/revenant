# Revenant — 3 Minute Stage Demo Script (Aditya)

## Pre-stage checklist (2 minutes before going on)

1. **Backend (`:8000`)**:
   ```bash
   cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000
   ```
   Verify `http://localhost:8000/api/health` returns `{"ok": true, ...}`.
2. **Frontend (`:5173`)**:
   - Live backend mode (default):
     ```bash
     cd frontend && npm run dev
     ```
   - Offline fixture fallback mode (if needed):
     ```bash
     cd frontend && VITE_USE_MOCKS=true npm run dev
     ```
3. **Browser setup**:
   - Open `http://localhost:5173` at `1280px` width.
   - Click the **sparkle + number** button on the right of the floating top navigation pill (or run `localStorage.clear()` and refresh) so the **Onboarding tagline screen** is ready on stage.
   - Click **Reset** on the Path page's **Demo: time travel** pill beforehand so the clock starts at day 0.

---

## 0:00 – 0:35 · Opening Shot: Onboarding Tagline & Daily Goal

1. **On screen**: Full-screen onboarding view. Watch the tagline brighten word by word on the `cubic-bezier(0.32, 0.72, 0, 1)` curve:
   > *"Notes that come back / to haunt you, on schedule."*
2. **What to say**:
   - "Students highlight PDFs and forget 70% within a week. Flashcard apps fail because making cards is tedious and AI flashcards hallucinate."
   - "Revenant runs locally with Gemma and SM-2 scheduling to turn lecture PDFs into grounded spaced repetition."
3. **Exact click**:
   - Click **Regular · 15** (or **Continue with 15 cards**). This posts `{ "daily_goal": 15 }` to `POST /api/settings` and reveals **Home**.

---

## 0:35 – 1:15 · Home, the Ghost Mascot & Seeded Deck vs PDF Upload

1. **On screen**:
   - Point out the **Ghost mascot** floating on the right (opacity reflects whether your daily goal is met and whether your streak is alive), the **streak counter** in Geist Mono, **streak freezes**, and the **daily XP ring**.
   - Point out the seeded deck (**Operating Systems, Unit 3** / **Photosynthesis** on the backend stub) with its live due count and concept mastery bar.
2. **Exact click (PDF Upload)**:
   - Drag and drop a sample lecture PDF onto the **Drag and drop a lecture PDF here** dropzone (or click **Choose PDF**).
   - Show the client-side validation and live progress bar polling `GET /api/decks/:deck_id` every 2 seconds.
3. **Fallback if the local model is slow**:
   - Do **not** wait for a large PDF to finish chunking on stage. Immediately say: *"While Gemma processes new chapters in the background, let's jump into our seeded deck which is already indexed."*
   - Click **Review deck** on the seeded deck (it needs no model for MCQ/Cloze and responds instantaneously).

---

## 1:15 – 2:15 · Grounded Review Session (MCQ, Cloze, Explain & Page Citations)

1. **Card 1 — Multiple choice (`mcq`)**:
   - Press key **`1`** (or click option `1`) to answer in a single keystroke.
   - **Crucial click**: Click the **From page N** chip in the feedback block to expand the **Verbatim PDF excerpt**.
   - **What to say**: "Every card carries the exact page number and verbatim sentence from the student's PDF. If it isn't in your notes, Revenant won't ask it."
   - Press **`Enter`** to continue.
2. **Card 2 — Fill the blank (`cloze`)**:
   - Type the missing word directly into the inline blank and press **`Enter`**.
   - Optionally click **Mark as easy** to demonstrate SM-2 interval boosting, then press **`Enter`**.
3. **Card 3 — Explain it back (`explain`)**:
   - Type a one-sentence explanation and press **`Enter`**.
   - Point out the **layout-shaped skeleton feedback block** while Gemma grades the free-text response (`POST /api/review/:id/explain`), returning a 0–1 score, specific feedback on what was missed, and the grounded page citation.
   - Press **`Enter`** through remaining cards to reach the **Session End** screen: calm copy (*"Goal reached."*), XP gained, session accuracy, *"N cards return tomorrow, M next week"*, and confetti.

---

## 2:15 – 3:00 · The Centrepiece: Concept Path & Time Travel

1. **Exact click**:
   - Click **View concept path** (or **Path** in the floating glass pill).
2. **On screen**:
   - Point out the winding vertical path of concepts:
     - **Solid with warm amber glow** (`health ≥ 0.85`, mastered)
     - **Slightly faded** (`0.70 – 0.85`, learning)
     - **Cracked in red** (`0.50 – 0.70`, shaky)
     - **Outlined & locked** (`new`)
   - Tap the top concept node to show its one-sentence summary and PDF page chips.
3. **Exact clicks (Time Travel centrepiece)**:
   - In the top-right **Demo: time travel** pill, click **`+1 day`**, then click **`+7 days`**.
   - Watch the concept nodes animate and **visibly crack and turn ghostly** as `POST /api/debug/timewarp` advances the server clock and SM-2 retention health decays according to `0.9 ^ (days / interval)`.
4. **Closing line**:
   - "Revenant makes forgetting visible before the exam, grounds every question in your own PDF, and runs 100% locally on your laptop."

