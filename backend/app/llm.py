"""The only module that talks to a model. Provider is picked by .env.

LLM_PROVIDER=ollama      -> local Ollama server (default)
LLM_PROVIDER=gemini_api  -> Google's Gemini API serving a Gemma model
"""

import json
import logging
import os
import re
from pathlib import Path

import httpx

log = logging.getLogger("revenant.llm")


def load_env() -> None:
    """Read KEY=value lines from the repo's .env into os.environ.

    A few lines here instead of adding python-dotenv as a dependency. Real
    environment variables win over the file.
    """
    env_file = Path(__file__).resolve().parents[2] / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()

PROVIDER = os.environ.get("LLM_PROVIDER", "ollama")
MODEL = os.environ.get("GEMMA_MODEL", "gemma4:e4b")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

TIMEOUT = httpx.Timeout(300.0, connect=10.0)  # local generation can be slow


class LLMError(Exception):
    pass


def _call_ollama(prompt: str) -> str:
    response = httpx.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": MODEL,
            "prompt": prompt,
            "format": "json",  # Ollama constrains the output to valid JSON
            "stream": False,
            "options": {"temperature": 0.2},
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["response"]


def _call_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise LLMError("GEMINI_API_KEY is not set in .env.")
    response = httpx.post(
        GEMINI_URL.format(model=MODEL),
        headers={"x-goog-api-key": GEMINI_API_KEY},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2},
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    parts = response.json()["candidates"][0]["content"]["parts"]
    return "".join(part.get("text", "") for part in parts)


def call_model(prompt: str) -> str:
    try:
        if PROVIDER == "gemini_api":
            return _call_gemini(prompt)
        return _call_ollama(prompt)
    except httpx.HTTPError as exc:
        raise LLMError(f"Model request failed: {exc}") from exc


def parse_json(text: str):
    """Parse model output defensively.

    Models sometimes wrap JSON in ``` fences or add a sentence before it, so
    strip fences, then keep only the outermost {...} or [...] block.
    """
    text = re.sub(r"```(?:json)?", "", text).strip()
    starts = [i for i in (text.find("{"), text.find("[")) if i != -1]
    if not starts:
        raise ValueError("no JSON object in model output")
    start = min(starts)
    end = max(text.rfind("}"), text.rfind("]"))
    return json.loads(text[start : end + 1])


def generate_json(prompt: str):
    """Ask the model for JSON. Retry once if the output does not parse.

    Raises LLMError if the model is unreachable or both attempts fail; the
    caller then skips that chunk.
    """
    for attempt in (1, 2):
        raw = call_model(prompt)
        try:
            return parse_json(raw)
        except (ValueError, json.JSONDecodeError) as exc:
            log.warning("Unparseable model output (attempt %d): %s", attempt, exc)
    raise LLMError("Model returned invalid JSON twice.")
