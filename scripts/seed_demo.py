"""Generate backend/seed/demo_deck.json from demo/sample.pdf (when the model is up)
and load the seeded deck into SQLite.

Usage from repo root:
    python scripts/seed_demo.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app import llm  # noqa: E402
from app.generate import build_prompt, validate_chunk_output  # noqa: E402
from app.ingest import make_chunks, read_pdf  # noqa: E402
from app.seed import SEED_FILE, load_seed  # noqa: E402

SAMPLE_PDF = ROOT / "demo" / "sample.pdf"


def generate_seed_from_pdf(pdf_path: Path) -> dict | None:
    """Attempt live extraction from demo/sample.pdf via Gemma; return None if offline."""
    if not pdf_path.exists():
        return None
    pages, pdf_title = read_pdf(pdf_path.read_bytes())
    chunks = make_chunks(pages)
    concepts = []
    for chunk in chunks:
        try:
            raw = llm.generate_json(build_prompt(chunk))
            concepts.extend(validate_chunk_output(raw, chunk))
        except llm.LLMError:
            return None
    if not concepts:
        return None
    return {
        "title": pdf_title or "Photosynthesis",
        "page_count": len(pages),
        "concepts": concepts,
    }


def main() -> None:
    generated = generate_seed_from_pdf(SAMPLE_PDF)
    if generated is not None:
        SEED_FILE.parent.mkdir(parents=True, exist_ok=True)
        SEED_FILE.write_text(json.dumps(generated, indent=2) + "\n", encoding="utf-8")
        print(f"Generated {SEED_FILE} from {SAMPLE_PDF} using {llm.PROVIDER} ({llm.MODEL}).")
    else:
        print(f"Model unreachable or skipped; using existing grounded fixture at {SEED_FILE}.")

    deck_id = load_seed(SEED_FILE)
    print(f"Loaded seeded demo deck {deck_id} into SQLite.")


if __name__ == "__main__":
    main()
