"""XP, daily goal bonus, streak and freezes."""

from datetime import datetime, timedelta, timezone

from app import db, stats

DAY1 = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)


def review(conn, now, n=1, base_xp=10):
    return [stats.record_review(conn, "card_x", "good", base_xp, now) for _ in range(n)]


def setup(conn, goal=5, freezes=0):
    """Settings plus one deck, three concepts and one card for reviews to point at."""
    db.set_setting(conn, "daily_goal", goal)
    db.set_setting(conn, "freezes", freezes)
    conn.execute("INSERT INTO decks VALUES ('d', 't', 'ready', 1, 1, '2026-10-28T00:00:00Z')")
    for cid in ("c1", "c2", "c3"):
        conn.execute("INSERT INTO concepts (id, deck_id, name, summary, pages, position) "
                     "VALUES (?, 'd', 'n', 's', '[]', 0)", (cid,))
    conn.execute("INSERT INTO cards (id, concept_id, deck_id, type, prompt, answer, source_page, "
                 "source_snippet, due_at, created_at) VALUES ('card_x', 'c1', 'd', 'cloze', 'p ____', "
                 "'a', 1, 's', '2026-10-28T00:00:00Z', '2026-10-28T00:00:00Z')")


def test_goal_bonus_paid_once_and_streak_starts():
    with db.connect() as conn:
        setup(conn)
        xp = review(conn, DAY1, n=7)
        assert xp == [10, 10, 10, 10, 30, 10, 10]  # +20 on the 5th review only
        s = stats.get_stats(conn, DAY1)
        assert (s["streak"], s["reviews_today"], s["goal_met"], s["xp_today"]) == (1, 7, True, 90)


def test_consecutive_days_extend_streak():
    with db.connect() as conn:
        setup(conn)
        for d in range(3):
            review(conn, DAY1 + timedelta(days=d), n=5)
        s = stats.get_stats(conn, DAY1 + timedelta(days=2))
        assert (s["streak"], s["best_streak"]) == (3, 3)


def test_today_is_never_counted_as_missed():
    with db.connect() as conn:
        setup(conn)
        review(conn, DAY1, n=5)
        # Next day, no reviews yet: streak still 1, not reset.
        assert stats.get_stats(conn, DAY1 + timedelta(days=1))["streak"] == 1


def test_missed_day_uses_a_freeze():
    with db.connect() as conn:
        setup(conn, freezes=1)
        review(conn, DAY1, n=5)
        s = stats.get_stats(conn, DAY1 + timedelta(days=2))  # day 2 missed
        assert (s["streak"], s["freezes"]) == (1, 0)
        review(conn, DAY1 + timedelta(days=2), n=5)
        assert stats.get_stats(conn, DAY1 + timedelta(days=2))["streak"] == 2


def test_missed_day_without_freeze_resets():
    with db.connect() as conn:
        setup(conn)
        review(conn, DAY1, n=5)
        review(conn, DAY1 + timedelta(days=1), n=5)
        s = stats.get_stats(conn, DAY1 + timedelta(days=3))
        assert (s["streak"], s["best_streak"]) == (0, 2)


def test_two_missed_days_with_one_freeze_still_resets():
    with db.connect() as conn:
        setup(conn, freezes=1)
        review(conn, DAY1, n=5)
        s = stats.get_stats(conn, DAY1 + timedelta(days=3))
        assert (s["streak"], s["freezes"]) == (0, 0)


def test_freezes_not_spent_without_a_streak():
    with db.connect() as conn:
        setup(conn, freezes=2)
        assert stats.get_stats(conn, DAY1 + timedelta(days=10))["freezes"] == 2


def test_mastery_freeze_once_per_concept_max_two():
    with db.connect() as conn:
        setup(conn)
        stats.award_mastery_freeze(conn, {"id": "c1", "status": "mastered"})
        stats.award_mastery_freeze(conn, {"id": "c1", "status": "mastered"})  # same concept again
        assert stats.get_stats(conn, DAY1)["freezes"] == 1
        stats.award_mastery_freeze(conn, {"id": "c2", "status": "mastered"})
        stats.award_mastery_freeze(conn, {"id": "c3", "status": "mastered"})
        assert stats.get_stats(conn, DAY1)["freezes"] == 2
