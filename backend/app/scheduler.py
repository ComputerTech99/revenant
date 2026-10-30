"""Health and status, exactly as CONTRACT.md defines them.

SM-2 scheduling is added in P3.
"""

from datetime import datetime

from .db import parse_iso

SHAKY_BELOW = 0.7
MASTERED_HEALTH = 0.85
MASTERED_INTERVAL_DAYS = 21


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
