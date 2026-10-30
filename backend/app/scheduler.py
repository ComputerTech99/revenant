"""SM-2 scheduling, plus health and status exactly as CONTRACT.md defines them."""

from datetime import datetime, timedelta

from . import db
from .db import parse_iso

# SM-2 grades a recall from 0 to 5. Our four buttons map onto it like this.
GRADE_TO_QUALITY = {"again": 1, "hard": 3, "good": 4, "easy": 5}
MIN_EASE = 1.3

SHAKY_BELOW = 0.7
MASTERED_HEALTH = 0.85
MASTERED_INTERVAL_DAYS = 21


def sm2(ease: float, interval_days: float, reps: int, grade: str) -> tuple[float, float, int]:
    """One SM-2 step. Returns the new (ease, interval_days, reps).

    - A failed recall (quality < 3, i.e. "again") restarts the card: reps go
      back to 0 and it comes back tomorrow.
    - A successful recall moves through the intervals 1 day, 6 days, then the
      previous interval times the ease factor.
    - The ease factor rises for easy answers and falls for hard ones, never
      below 1.3, using the formula from the original SM-2 algorithm.
    """
    q = GRADE_TO_QUALITY[grade]

    if q < 3:
        reps, interval_days = 0, 1
    else:
        if reps == 0:
            interval_days = 1
        elif reps == 1:
            interval_days = 6
        else:
            interval_days = round(interval_days * ease)
        reps += 1

    # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    # q=5: +0.10, q=4: +0.00, q=3: -0.14, q=1: -0.54
    ease = max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
    return round(ease, 4), interval_days, reps


def apply_review(conn, card, grade: str, now: datetime) -> str:
    """Run SM-2 on a card, store the result and return the new due date."""
    ease, interval_days, reps = sm2(card["ease"], card["interval_days"], card["reps"], grade)
    due_at = db.iso(now + timedelta(days=interval_days))
    conn.execute(
        "UPDATE cards SET ease = ?, interval_days = ?, reps = ?, due_at = ?, last_reviewed_at = ? "
        "WHERE id = ?",
        (ease, interval_days, reps, due_at, db.iso(now), card["id"]),
    )
    return due_at


def card_health(card, now: datetime) -> float | None:
    """health = 0.9 ^ (days_since_last_review / interval_days).

    1.0 right after a review, exactly 0.9 on the due date (when days since
    review equals the interval), and lower the longer the card is overdue.
    None for a card that has never been reviewed.
    """
    if card["last_reviewed_at"] is None:
        return None
    days_since = (now - parse_iso(card["last_reviewed_at"])).total_seconds() / 86400
    interval = max(card["interval_days"], 1e-6)  # SM-2 never sets 0 after a review; guard anyway
    return 0.9 ** (max(days_since, 0) / interval)


def concept_health(cards, now: datetime) -> float | None:
    """Mean health of the concept's reviewed cards, or None if none reviewed."""
    healths = [h for h in (card_health(c, now) for c in cards) if h is not None]
    return sum(healths) / len(healths) if healths else None


def concept_status(cards, now: datetime) -> str:
    health = concept_health(cards, now)
    if health is None:
        return "new"
    if health < SHAKY_BELOW:
        return "shaky"
    # Mastered needs every card (reviewed or not) to have a long interval,
    # so a concept with an unseen card can never be mastered.
    if health >= MASTERED_HEALTH and all(c["interval_days"] >= MASTERED_INTERVAL_DAYS for c in cards):
        return "mastered"
    return "learning"
