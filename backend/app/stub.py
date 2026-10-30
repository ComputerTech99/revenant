"""Placeholder stats until P3 implements XP, streak and freezes."""

from . import db


def stats(conn) -> dict:
    goal = int(db.get_setting(conn, "daily_goal", "15"))
    reviews_today = 8
    return {
        "streak": 3,
        "best_streak": 5,
        "freezes": 1,
        "xp_today": 80,
        "xp_total": 640,
        "daily_goal": goal,
        "reviews_today": reviews_today,
        "goal_met": reviews_today >= goal,
        "now": db.iso(db.now(conn)),
    }
