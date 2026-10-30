"""SM-2 and the health/status rules from the contract."""

from datetime import datetime, timedelta, timezone

import pytest

from app import db
from app.scheduler import card_health, concept_status, sm2

NOW = datetime(2026, 10, 31, 9, 0, tzinfo=timezone.utc)


def test_good_answers_follow_1_6_then_ease_intervals():
    ease, interval, reps = 2.5, 0, 0
    intervals = []
    for _ in range(4):
        ease, interval, reps = sm2(ease, interval, reps, "good")
        intervals.append(interval)
    # "good" (quality 4) leaves ease at 2.5: 1, 6, 6*2.5=15, 15*2.5=38 (rounded)
    assert intervals == [1, 6, 15, 38]
    assert ease == 2.5


def test_again_resets_the_card_and_lowers_ease():
    ease, interval, reps = sm2(2.5, 15, 3, "again")
    assert (interval, reps) == (1, 0)
    assert ease == pytest.approx(2.5 - 0.54)


def test_easy_raises_ease_hard_lowers_it():
    assert sm2(2.5, 0, 0, "easy")[0] == pytest.approx(2.6)
    assert sm2(2.5, 0, 0, "hard")[0] == pytest.approx(2.36)


def test_ease_never_drops_below_1_3():
    ease = 1.4
    for _ in range(5):
        ease, _, _ = sm2(ease, 1, 0, "again")
    assert ease == 1.3


def card(days_ago, interval):
    return {"last_reviewed_at": db.iso(NOW - timedelta(days=days_ago)), "interval_days": interval}


def test_health_is_1_after_review_and_0_9_on_due_date():
    assert card_health(card(0, 6), NOW) == pytest.approx(1.0)
    assert card_health(card(6, 6), NOW) == pytest.approx(0.9)
    assert card_health(card(12, 6), NOW) == pytest.approx(0.81)  # overdue keeps falling


def test_unreviewed_card_has_no_health():
    assert card_health({"last_reviewed_at": None, "interval_days": 0}, NOW) is None


def test_concept_status_rules():
    unseen = {"last_reviewed_at": None, "interval_days": 0}
    assert concept_status([unseen], NOW) == "new"
    assert concept_status([card(30, 6)], NOW) == "shaky"            # 0.9^5 = 0.59
    assert concept_status([card(1, 6)], NOW) == "learning"          # healthy, short interval
    assert concept_status([card(1, 21), card(2, 30)], NOW) == "mastered"
    # One card still unseen (interval 0) blocks mastery.
    assert concept_status([card(1, 21), unseen], NOW) == "learning"
