"""Load the demo deck from seed/demo_deck.json with no model call.

Run from backend/:  python -m app.seed
The stage demo works from this even if Ollama is down.
"""

import json
from datetime import timedelta
from pathlib import Path

from . import db
from .generate import save_concept

SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "demo_deck.json"


def _clear_existing_deck(conn, title: str) -> None:
    """Keep seeding idempotent so repeated runs do not duplicate the demo deck."""
    rows = conn.execute("SELECT id FROM decks WHERE title = ?", (title,)).fetchall()
    for row in rows:
        old_id = row["id"]
        conn.execute(
            "DELETE FROM reviews WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)",
            (old_id,),
        )
        conn.execute("DELETE FROM cards WHERE deck_id = ?", (old_id,))
        conn.execute("DELETE FROM concepts WHERE deck_id = ?", (old_id,))
        conn.execute("DELETE FROM decks WHERE id = ?", (old_id,))


def _apply_demo_schedule(conn, deck_id: str, now_dt) -> None:
    """Give the seeded concepts realistic SM-2 history across mastered, learning, shaky and new."""
    concepts = conn.execute(
        "SELECT id, position FROM concepts WHERE deck_id = ? ORDER BY position",
        (deck_id,),
    ).fetchall()

    # Position 0: mastered (health ~0.99, interval 24d >= 21d)
    # Position 1: learning (health ~0.78, slightly faded, due now)
    # Position 2: shaky (health ~0.56, cracked, due now)
    # Position 3: new (unreviewed, outlined and locked, due now)
    presets = {
        0: {
            "interval_days": 24,
            "reps": 3,
            "last_reviewed_at": db.iso(now_dt - timedelta(days=2)),
            "due_at": db.iso(now_dt + timedelta(days=22)),
            "ever_mastered": 1,
        },
        1: {
            "interval_days": 6,
            "reps": 2,
            "last_reviewed_at": db.iso(now_dt - timedelta(days=14)),
            "due_at": db.iso(now_dt - timedelta(days=1)),
            "ever_mastered": 0,
        },
        2: {
            "interval_days": 2,
            "reps": 1,
            "last_reviewed_at": db.iso(now_dt - timedelta(days=11)),
            "due_at": db.iso(now_dt - timedelta(days=2)),
            "ever_mastered": 0,
        },
    }

    for concept in concepts:
        preset = presets.get(concept["position"])
        if not preset:
            continue
        conn.execute(
            "UPDATE concepts SET ever_mastered = ? WHERE id = ?",
            (preset["ever_mastered"], concept["id"]),
        )
        conn.execute(
            "UPDATE cards SET interval_days = ?, reps = ?, last_reviewed_at = ?, due_at = ? "
            "WHERE concept_id = ?",
            (
                preset["interval_days"],
                preset["reps"],
                preset["last_reviewed_at"],
                preset["due_at"],
                concept["id"],
            ),
        )


def load_seed(path: Path = SEED_FILE) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    db.init_db()
    with db.connect() as conn:
        db.set_setting(conn, "offset_days", 0)
        now_dt = db.now(conn)
        now_iso = db.iso(now_dt)
        _clear_existing_deck(conn, data["title"])

        deck_id = db.new_id("deck")
        conn.execute(
            "INSERT INTO decks (id, title, status, progress, page_count, created_at) "
            "VALUES (?, ?, 'ready', 1, ?, ?)",
            (deck_id, data["title"], data["page_count"], now_iso),
        )
        for concept in data["concepts"]:
            save_concept(conn, deck_id, concept, now_iso)
        _apply_demo_schedule(conn, deck_id, now_dt)
    return deck_id


if __name__ == "__main__":
    deck_id = load_seed()
    print(f"Loaded demo deck {deck_id} from {SEED_FILE}")
