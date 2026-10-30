"""Turn database rows into the exact JSON shapes in CONTRACT.md."""

import json

from . import db, scheduler


def card_view(row) -> dict:
    return {
        "id": row["id"],
        "concept_id": row["concept_id"],
        "deck_id": row["deck_id"],
        "type": row["type"],
        "prompt": row["prompt"],
        "options": json.loads(row["options"]) if row["options"] else None,
        "answer": row["answer"],
        "source": {"page": row["source_page"], "snippet": row["source_snippet"]},
    }


def concept_view(conn, row, now) -> dict:
    cards = conn.execute("SELECT * FROM cards WHERE concept_id = ?", (row["id"],)).fetchall()
    health = scheduler.concept_health(cards, now)
    # next_due: the earliest due date among cards already reviewed.
    reviewed_due = [c["due_at"] for c in cards if c["last_reviewed_at"] is not None]
    return {
        "id": row["id"],
        "deck_id": row["deck_id"],
        "name": row["name"],
        "summary": row["summary"],
        "pages": json.loads(row["pages"]),
        "health": round(health, 3) if health is not None else None,
        "status": scheduler.concept_status(cards, now),
        "next_due": min(reviewed_due) if reviewed_due else None,
        "card_count": len(cards),
    }


def concept_views(conn, deck_id: str, now) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM concepts WHERE deck_id = ? ORDER BY position", (deck_id,)
    ).fetchall()
    return [concept_view(conn, row, now) for row in rows]


def deck_view(conn, row, now) -> dict:
    concepts = concept_views(conn, row["id"], now)
    card_count = sum(c["card_count"] for c in concepts)
    due_count = conn.execute(
        "SELECT COUNT(*) FROM cards WHERE deck_id = ? AND due_at <= ?", (row["id"], db.iso(now))
    ).fetchone()[0]
    mastered = sum(1 for c in concepts if c["status"] == "mastered")
    return {
        "deck_id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "progress": round(row["progress"], 3),
        "page_count": row["page_count"],
        "concept_count": len(concepts),
        "card_count": card_count,
        "due_count": due_count,
        "mastery_pct": round(100 * mastered / len(concepts), 1) if concepts else 0.0,
        "created_at": row["created_at"],
    }
