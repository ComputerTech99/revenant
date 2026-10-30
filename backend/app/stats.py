"""XP, daily goal, streak and freezes, as CONTRACT.md defines them.

Streak state lives in the settings table:
  streak, best_streak, freezes
  streak_day  - the last day that counts toward the streak (goal met or frozen)
  goal_day    - the last day the +20 goal bonus was paid, so it is paid once

A "day" is the server's local calendar date of "now" (the app clock with
time-warp), so midnight is the student's midnight, not UTC midnight.
"""

from datetime import date, datetime, timedelta

from . import db

XP_CORRECT = 10
XP_GOAL_BONUS = 20
MAX_FREEZES = 2


def local_day(now: datetime) -> date:
    return now.astimezone().date()


def _int(conn, key: str, default: int = 0) -> int:
    return int(float(db.get_setting(conn, key, str(default))))


def _day(conn, key: str) -> date | None:
    value = db.get_setting(conn, key, "")
    return date.fromisoformat(value) if value else None


def settle_streak(conn, today: date) -> None:
    """Apply any whole days missed since the streak last counted.

    Each missed day uses up a freeze if one is left; the first missed day
    with no freeze resets the streak to 0. Today never counts as missed,
    because the student still has until midnight. With no streak running,
    freezes are kept rather than spent protecting nothing.
    """
    streak = _int(conn, "streak")
    last = _day(conn, "streak_day")
    if streak == 0 or last is None:
        return

    freezes = _int(conn, "freezes")
    missed = (today - last).days - 1  # days strictly between last and today
    while missed > 0:
        if freezes > 0:
            freezes -= 1
            last += timedelta(days=1)  # the frozen day now counts as covered
            missed -= 1
        else:
            streak = 0
            break

    db.set_setting(conn, "streak", streak)
    db.set_setting(conn, "freezes", freezes)
    db.set_setting(conn, "streak_day", last.isoformat())


def count_today_toward_streak(conn, today: date) -> None:
    """Called once, the moment today's goal is met."""
    settle_streak(conn, today)
    if _day(conn, "streak_day") == today:
        return
    # After settling, a running streak always ends yesterday (or today), so
    # meeting today's goal extends it. A streak of 0 starts again at 1.
    streak = _int(conn, "streak") + 1
    db.set_setting(conn, "streak", streak)
    db.set_setting(conn, "best_streak", max(streak, _int(conn, "best_streak")))
    db.set_setting(conn, "streak_day", today.isoformat())


def record_review(conn, card_id: str, grade: str, base_xp: int, now: datetime) -> int:
    """Log a review and return the XP it earned, including the goal bonus."""
    today = local_day(now)
    xp = base_xp
    reviews_today = conn.execute(
        "SELECT COUNT(*) FROM reviews WHERE day = ?", (today.isoformat(),)
    ).fetchone()[0] + 1  # this review included

    goal = _int(conn, "daily_goal", 15)
    if reviews_today >= goal and _day(conn, "goal_day") != today:
        xp += XP_GOAL_BONUS
        db.set_setting(conn, "goal_day", today.isoformat())
        count_today_toward_streak(conn, today)

    conn.execute(
        "INSERT INTO reviews (id, card_id, grade, xp, reviewed_at, day) VALUES (?, ?, ?, ?, ?, ?)",
        (db.new_id("rev"), card_id, grade, xp, db.iso(now), today.isoformat()),
    )
    return xp


def award_mastery_freeze(conn, concept: dict) -> None:
    """+1 freeze the first time a concept becomes mastered, holding at most 2."""
    if concept["status"] != "mastered":
        return
    row = conn.execute("SELECT ever_mastered FROM concepts WHERE id = ?", (concept["id"],)).fetchone()
    if row["ever_mastered"]:
        return
    conn.execute("UPDATE concepts SET ever_mastered = 1 WHERE id = ?", (concept["id"],))
    db.set_setting(conn, "freezes", min(MAX_FREEZES, _int(conn, "freezes") + 1))


def get_stats(conn, now: datetime) -> dict:
    today = local_day(now)
    settle_streak(conn, today)
    reviews_today, xp_today = conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(xp), 0) FROM reviews WHERE day = ?", (today.isoformat(),)
    ).fetchone()
    xp_total = conn.execute("SELECT COALESCE(SUM(xp), 0) FROM reviews").fetchone()[0]
    goal = _int(conn, "daily_goal", 15)
    return {
        "streak": _int(conn, "streak"),
        "best_streak": _int(conn, "best_streak"),
        "freezes": _int(conn, "freezes"),
        "xp_today": xp_today,
        "xp_total": xp_total,
        "daily_goal": goal,
        "reviews_today": reviews_today,
        "goal_met": reviews_today >= goal,
        "now": db.iso(now),
    }
