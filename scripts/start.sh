#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Checking local Ollama service on http://localhost:11434 ..."
if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "    Ollama is online."
else
  echo "    Ollama is not reachable; Revenant will use the seeded deck and keyword-overlap grading fallback."
fi

if [ -x ".venv/bin/python" ]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
elif [ -x ".venv/Scripts/python.exe" ]; then
  PYTHON_BIN="$ROOT_DIR/.venv/Scripts/python.exe"
else
  PYTHON_BIN="python3"
fi

echo "==> Seeding demo deck into SQLite ..."
(cd "$ROOT_DIR/backend" && "$PYTHON_BIN" -m app.seed)

echo "==> Starting FastAPI backend on http://localhost:8000 ..."
(cd "$ROOT_DIR/backend" && "$PYTHON_BIN" -m uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

echo "==> Starting Vite frontend on http://localhost:5173 ..."
cd "$ROOT_DIR/frontend"
npm run dev

