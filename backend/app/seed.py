"""Load the demo deck from seed/demo_deck.json with no model call.

Run from backend/:  python -m app.seed
The stage demo works from this even if Ollama is down.
"""

import json
from pathlib import Path

from . import db
from .generate import save_concept

SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "demo_deck.json"


def load_seed(path: Path = SEED_FILE) -> str:
    data = json.loads(path.read_text())
    db.init_db()
    with db.connect() as conn:
        now_iso = db.iso(db.now(conn))
        deck_id = db.new_id("deck")
        conn.execute(
            "INSERT INTO decks (id, title, status, progress, page_count, created_at) "
            "VALUES (?, ?, 'ready', 1, ?, ?)",
            (deck_id, data["title"], data["page_count"], now_iso),
        )
        for concept in data["concepts"]:
            save_concept(conn, deck_id, concept, now_iso)
    return deck_id


if __name__ == "__main__":
    deck_id = load_seed()
    print(f"Loaded demo deck {deck_id} from {SEED_FILE}")
