# Revenant

Turns a PDF into spaced-repetition revision. Gemma extracts concepts and writes grounded questions, SM-2 schedules them, and a browser UI makes forgetting visible.

API contract: [`CONTRACT.md`](CONTRACT.md).

## Backend: run it

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000
```

Check it is up: `curl http://localhost:8000/api/health`.

Interactive API docs: http://localhost:8000/docs
