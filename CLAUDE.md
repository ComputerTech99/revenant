# Revenant — Claude Code instructions (Ojash: backend + engine)

Revenant turns a student's PDF into spaced-repetition revision: Gemma extracts concepts and writes grounded questions, SM-2 schedules them, and a Duolingo-style browser UI makes forgetting visible.
Built at the Devf8rge × Hacktoberfest Hack Day finals (Theme 02: Open Source for Education). **Code freeze: 10:00 AM IST, 31 Oct. Commits after that do not count.**

Two humans, two agents, one repo. You are Ojash's agent and you own the **backend**. Aditya's agent (Antigravity) owns the frontend.

@docs/CONTRACT.md

## Ownership (strict)

- You may edit only: `backend/`, `scripts/`, `demo/`, `.env.example`, `.gitignore`, `README.md`.
- **Never** edit `frontend/`, `GEMINI.md` or `docs/CONTRACT.md`. If the contract seems wrong, stop and tell Ojash. Do not work around it silently.
- Every endpoint must match the contract exactly: field names, types and enums.

## Hackathon rules (breaking these disqualifies the team)

- No real API keys or secrets in the repo, ever. `.env` is gitignored; commit only `.env.example` with placeholder values.
- Dependencies must have OSI licences compatible with MIT. **Do not use PyMuPDF (AGPL)**; use `pypdf`.
- Do not publish anything to PyPI or npm. Do not open issues or PRs on other repositories.
- Ojash must be able to explain every line to the judges. Prefer plain, readable code over clever code, and comment any non-obvious logic (SM-2, health, the streak edge cases).

## Stack

Python 3.11+, FastAPI, Uvicorn, SQLite via the standard `sqlite3` module (or SQLModel if it saves real time), `pypdf`, `httpx`. Use `requirements.txt` and a venv. Enable CORS for `http://localhost:5173`.

Model access goes through one module, `backend/app/llm.py`, with two providers selected by `.env`:
- `LLM_PROVIDER=ollama` (default): `OLLAMA_URL=http://localhost:11434`, `GEMMA_MODEL=<the Gemma 4 tag shown by ollama list>`.
- `LLM_PROVIDER=gemini_api`: `GEMINI_API_KEY=...` and a Gemma model name. This is the fallback if local inference is too slow.

Always request JSON output. Parse it defensively: strip code fences, retry once on a parse failure, then skip that chunk.

## Layout

```
backend/
  app/main.py          # FastAPI app, routers, CORS
  app/db.py            # schema + connection; "now" = utcnow + offset stored in settings table
  app/ingest.py        # PDF → pages → chunks
  app/generate.py      # chunk → concepts + cards (Gemma) + validation
  app/scheduler.py     # SM-2, health, status
  app/stats.py         # XP, streak, freezes
  app/llm.py           # provider switch
  app/seed.py          # load demo deck from JSON without calling the model
  seed/demo_deck.json
scripts/start.sh       # one command: backend + frontend (+ check Ollama is up)
demo/sample.pdf        # one clean, text-based PDF for the stage demo
```

## Phases (do them in order; each must work end to end before the next)

**P1 — stub server (target 12:15 AM).** Every contract endpoint returns realistic hardcoded data of the right shape, plus `GET /api/health`. Push immediately; Aditya builds against this.

**P2 — ingestion and generation (target 2:30 AM).**
- Extract text per page with `pypdf`. Merge consecutive pages into chunks of about 1,500–2,500 characters, keeping each chunk's page list. Cap at the first 40 pages.
- Upload returns at once with status `processing`. Generate in a FastAPI background task, one chunk at a time, updating `progress` after each. Cards from finished chunks are reviewable immediately.
- Per chunk, ask Gemma for 1–3 concepts (name, one-sentence summary) and 2–4 cards per concept across `mcq`, `cloze` and `explain`, each with `source.page` and a verbatim `source.snippet`.
- **Validation, which is a technical talking point, so keep it explicit:** reject a card if the snippet is not a substring of the chunk text (whitespace-normalised); if an mcq does not have exactly 4 unique options containing the answer; if a cloze prompt lacks exactly one `____`; or if the prompt is longer than 300 characters.

**P3 — scheduler (target 4:00 AM).** SM-2 with grade mapping again→1, hard→3, good→4, easy→5. Health and status exactly as the contract defines. Time-warp stores an offset; reset clears it. Implement stats, XP, streak and freezes per the contract. Write a few `pytest` tests for SM-2 and the streak, because judges may ask how you know it works.

**P4 — explain-back (target 5:00 AM).** Gemma compares the student's answer with the card's answer and source snippet, returns `{score, feedback}`, where feedback is at most two sentences, encouraging and specific, and quotes what was missing. The backend maps score to a grade and schedules the card.

**Voice for every user-facing string the backend produces** (error messages, explain-back feedback, generated concept names and summaries). The frontend follows a strict design system, and backend text appears inside it, so put these rules in the generation and grading prompts too:
- Sentence case. No exclamation marks, no "Oops", no hype words ("Elevate", "Seamless", "Unleash", "Delve", "Game changer").
- Direct and specific, in the active voice: "Could not read this PDF. It looks like scanned images rather than text." not "Something went wrong".
- Concept names are short noun phrases (two to five words), with no hyphens where a space or rewording works.

**P5 — demo safety and docs (target 6:00 AM).**
- `scripts/seed_demo.py` generates the deck from `demo/sample.pdf` once and saves it to `seed/demo_deck.json`; `python -m app.seed` loads it with no model call. The stage demo must work even if Ollama is down.
- `scripts/start.sh` starts everything with one command.
- The README backend section: setup, pulling the Gemma model, `.env`, architecture in five lines, AI tools used (Claude Code, Antigravity, Gemma 4), credits for every library.

## Working style

- Small commits with conventional messages (`feat(api): ...`, `fix(scheduler): ...`). Run `git pull --rebase` before every push.
- After each endpoint change, smoke-test it with curl and check the response against the contract.
- Ask Ojash before adding a dependency. Do not over-engineer: no auth, no users, no Docker unless P5 is done early.
- Ojash leaves early on 31 Oct and Aditya runs the demo alone, so anything Aditya needs to run must be in the README, not in Ojash's head.
