# Revenant

Turns a student's lecture PDF into grounded spaced-repetition revision: Gemma extracts concepts and writes verbatim-cited questions, SM-2 schedules reviews, and a dark-mode browser UI makes forgetting visible before the exam.

API contract: [`CONTRACT.md`](CONTRACT.md) · 3-minute stage script: [`docs/DEMO.md`](docs/DEMO.md)

---

## Architecture in Five Lines

1. **Ingest (`backend/app/ingest.py`)**: Extracts text per page with `pypdf` (up to 40 pages) and merges consecutive pages into 1,500–2,500 character chunks while preserving page numbers.
2. **Grounded Generation (`backend/app/generate.py`)**: Prompts Gemma (`ollama` or `gemini_api`) for 1–3 concepts and 2–4 cards (`mcq`, `cloze`, `explain`) per chunk, rejecting any card whose `source.snippet` is not a whitespace-normalised substring of the PDF text.
3. **SM-2 & Retention Decay (`backend/app/scheduler.py`)**: Schedules card intervals with SM-2 (`again→1`, `hard→3`, `good→4`, `easy→5`) and computes live card/concept retention health as `0.9 ^ (days_since_last_review / interval_days)`.
4. **Explain-Back Grader (`backend/app/grade.py`)**: Grades free-text explanations with Gemma against the model answer and verbatim PDF snippet, falling back to content-word overlap if the local model is unreachable.
5. **Browser Experience (`frontend/src/`)**: React + Vite + Tailwind CSS v4 + Framer Motion UI featuring an original SVG Ghost mascot, single-keystroke grounded review cards with expandable `"From page N"` citations, and a winding concept path with live time-travel decay.

---

## Quick Start (One Command)

- **macOS / Linux / Git Bash**:
  ```bash
  bash scripts/start.sh
  ```
- **Windows PowerShell**:
  ```powershell
  .\scripts\start.ps1
  ```

---

## Manual Setup

### 1. Local Gemma Model & `.env`

Pull the Gemma 4 model with Ollama and create your `.env`:

```bash
ollama pull gemma4:e4b
cp .env.example .env
```

`.env` options:
```ini
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
GEMMA_MODEL=gemma4:e4b

# Fallback when LLM_PROVIDER=gemini_api
GEMINI_API_KEY=your-key-here
```

> **Offline stage safety**: Even if Ollama is down, `python -m app.seed` loads `backend/seed/demo_deck.json` (`Photosynthesis`) with zero model calls, and `explain` grading automatically falls back to content-word overlap.

### 2. Backend (`http://localhost:8000`)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd backend
../.venv/bin/python -m app.seed
../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

*(On Windows PowerShell, use `..\.venv\Scripts\python.exe` instead of `../.venv/bin/python`.)*

Run the 35-test backend suite:
```bash
cd backend && ../.venv/bin/python -m pytest
```

### 3. Frontend (`http://localhost:5173`)

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_USE_MOCKS=true` in `frontend/.env` to run against the built-in client fixtures (`src/mocks/fixtures.js`), or `VITE_USE_MOCKS=false` to use the FastAPI backend on `:8000`.

---

## AI Tools & Open-Source Credits

- **AI Tools Used**:
  - **Google Antigravity** — Frontend architecture, visual system & interactive review/path experience (Aditya)
  - **Claude Code** — FastAPI backend, PDF chunker, grounding validator & SM-2 engine (Ojash)
  - **Google Gemma 4 (`gemma4:e4b`)** — Local concept extraction, question generation & explain-back grading
- **Backend Libraries (OSI-licensed)**:
  - [FastAPI](https://fastapi.tiangolo.com/) (MIT), [Uvicorn](https://www.uvicorn.org/) (BSD-3-Clause), [Pydantic](https://docs.pydantic.dev/) (MIT), [`pypdf`](https://pypdf.readthedocs.io/) (BSD-3-Clause), [`httpx`](https://www.python-httpx.org/) (BSD-3-Clause), Python `sqlite3`, [`pytest`](https://pytest.org/) (MIT).
- **Frontend Libraries (OSI-licensed)**:
  - [React 19](https://react.dev/) (MIT), [Vite 6](https://vite.dev/) (MIT), [Tailwind CSS v4](https://tailwindcss.com/) (MIT), [Framer Motion](https://www.framer.com/motion/) (MIT), [React Router](https://reactrouter.com/) (MIT), [`@phosphor-icons/react`](https://phosphoricons.com/) (MIT), [`canvas-confetti`](https://github.com/catdad/canvas-confetti) (ISC), [Fontsource Geist Sans & Geist Mono](https://fontsource.org/) (OFL-1.1).
