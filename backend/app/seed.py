"""Load the demo deck from seed/demo_deck.json with no model call.

Run from backend/:  python -m app.seed
The stage demo works from this even if Ollama is down.
"""

import json
from datetime import timedelta
from pathlib import Path

from . import db, stats
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
    """Give the seeded concepts realistic SM-2 history across mastered, learning, shaky and new.

    Leaves 3 cards due right now (1 mcq, 1 cloze, 1 explain) so a live stage review
    session covers all three card types in three questions and hits the daily goal.
    """
    concepts = conn.execute(
        "SELECT id, position FROM concepts WHERE deck_id = ? ORDER BY position",
        (deck_id,),
    ).fetchall()

    for concept in concepts:
        pos = concept["position"]
        cid = concept["id"]
        cards = conn.execute(
            "SELECT id, type FROM cards WHERE concept_id = ? ORDER BY id",
            (cid,),
        ).fetchall()

        if pos == 0:
            # Mastered: health ~0.99, interval 24d >= 21d
            conn.execute("UPDATE concepts SET ever_mastered = 1 WHERE id = ?", (cid,))
            conn.execute(
                "UPDATE cards SET interval_days = 24, reps = 3, last_reviewed_at = ?, due_at = ? "
                "WHERE concept_id = ?",
                (
                    db.iso(now_dt - timedelta(days=2)),
                    db.iso(now_dt + timedelta(days=22)),
                    cid,
                ),
            )
        elif pos == 1:
            # Learning (slightly faded): health ~0.78 (days_since=4.7, interval=2), both cards (cloze + explain) due now
            conn.execute(
                "UPDATE cards SET interval_days = 2, reps = 2, last_reviewed_at = ?, due_at = ? "
                "WHERE concept_id = ?",
                (
                    db.iso(now_dt - timedelta(hours=113)),
                    db.iso(now_dt - timedelta(days=1)),
                    cid,
                ),
            )
        elif pos == 2:
            # Shaky (cracked): health ~0.56 (days_since=11, interval=2). The mcq card is due now, the cloze card due tomorrow.
            for card in cards:
                due_target = (
                    now_dt - timedelta(days=2)
                    if card["type"] == "mcq"
                    else now_dt + timedelta(days=1)
                )
                conn.execute(
                    "UPDATE cards SET interval_days = 2, reps = 1, last_reviewed_at = ?, due_at = ? "
                    "WHERE id = ?",
                    (
                        db.iso(now_dt - timedelta(days=11)),
                        db.iso(due_target),
                        card["id"],
                    ),
                )
        elif pos == 3:
            # New (outlined and locked): unreviewed, scheduled for tomorrow so it stays "new" on the path after today's 3 due cards
            conn.execute(
                "UPDATE cards SET last_reviewed_at = NULL, interval_days = 0, reps = 0, due_at = ? "
                "WHERE concept_id = ?",
                (db.iso(now_dt + timedelta(days=1)), cid),
            )


def _seed_demo_stats(conn, deck_id: str, now_dt) -> None:
    """Seed realistic streak, freezes, XP and 2 reviews today toward a 5-card daily goal."""
    today = stats.local_day(now_dt)
    yesterday = today - timedelta(days=1)

    db.set_setting(conn, "daily_goal", 5)
    db.set_setting(conn, "streak", 4)
    db.set_setting(conn, "best_streak", 7)
    db.set_setting(conn, "freezes", 1)
    db.set_setting(conn, "streak_day", yesterday.isoformat())
    db.set_setting(conn, "goal_day", yesterday.isoformat())

    first_card = conn.execute(
        "SELECT id FROM cards WHERE deck_id = ? LIMIT 1",
        (deck_id,),
    ).fetchone()
    if not first_card:
        return
    card_id = first_card["id"]

    # Historical XP on previous days (460 XP across the 4-day streak)
    for days_back in (4, 3, 2, 1):
        past_day = (today - timedelta(days=days_back)).isoformat()
        past_iso = db.iso(now_dt - timedelta(days=days_back))
        conn.execute(
            "INSERT INTO reviews (id, card_id, grade, xp, reviewed_at, day) VALUES (?, ?, 'good', 115, ?, ?)",
            (db.new_id("rev"), card_id, past_iso, past_day),
        )

    # 2 reviews already done earlier today (20 XP today, 3 more needed to hit the 5-card goal)
    for _ in range(2):
        conn.execute(
            "INSERT INTO reviews (id, card_id, grade, xp, reviewed_at, day) VALUES (?, ?, 'good', 10, ?, ?)",
            (db.new_id("rev"), card_id, db.iso(now_dt - timedelta(hours=2)), today.isoformat()),
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
        _seed_demo_stats(conn, deck_id, now_dt)
    return deck_id


if __name__ == "__main__":
    deck_id = load_seed()
    print(f"Loaded demo deck {deck_id} from {SEED_FILE}")
