"""Hardcoded P1 data in the exact contract shapes. Deleted once P2/P3 land."""

from datetime import datetime, timedelta, timezone

DECK_ID = "deck_demo"
PROCESSING_DECK_ID = "deck_processing"

# Tiny bit of mutable state so settings and time-warp visibly do something.
STATE = {"offset_days": 0, "daily_goal": 15}

CREATED_AT = datetime(2026, 10, 30, 18, 0, tzinfo=timezone.utc)


def now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=STATE["offset_days"])


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def deck() -> dict:
    return {
        "deck_id": DECK_ID,
        "title": "Photosynthesis",
        "status": "ready",
        "progress": 1.0,
        "page_count": 12,
        "concept_count": 4,
        "card_count": 7,
        "due_count": 5,
        "mastery_pct": 25.0,
        "created_at": iso(CREATED_AT),
    }


def new_processing_deck(filename: str) -> dict:
    return {
        "deck_id": PROCESSING_DECK_ID,
        "title": filename.rsplit(".", 1)[0],
        "status": "processing",
        "progress": 0.0,
        "page_count": 18,
        "concept_count": 0,
        "card_count": 0,
        "due_count": 0,
        "mastery_pct": 0.0,
        "created_at": iso(now()),
    }


def concepts() -> list[dict]:
    n = now()
    return [
        {
            "id": "c1", "deck_id": DECK_ID, "name": "Light dependent reactions",
            "summary": "Light energy splits water and produces ATP and NADPH in the thylakoid membranes.",
            "pages": [1, 2, 3], "health": 0.93, "status": "mastered",
            "next_due": iso(n + timedelta(days=24)), "card_count": 2,
        },
        {
            "id": "c2", "deck_id": DECK_ID, "name": "Calvin cycle",
            "summary": "The stroma uses ATP and NADPH to fix carbon dioxide into sugar.",
            "pages": [4, 5, 6], "health": 0.78, "status": "learning",
            "next_due": iso(n + timedelta(days=2)), "card_count": 2,
        },
        {
            "id": "c3", "deck_id": DECK_ID, "name": "Role of chlorophyll",
            "summary": "Chlorophyll absorbs red and blue light and reflects green.",
            "pages": [7, 8], "health": 0.52, "status": "shaky",
            "next_due": iso(n - timedelta(days=3)), "card_count": 2,
        },
        {
            "id": "c4", "deck_id": DECK_ID, "name": "Limiting factors",
            "summary": "Light intensity, carbon dioxide and temperature cap the rate of photosynthesis.",
            "pages": [9, 10, 11, 12], "health": None, "status": "new",
            "next_due": None, "card_count": 1,
        },
    ]


def cards() -> list[dict]:
    return [
        {
            "id": "k1", "concept_id": "c3", "deck_id": DECK_ID, "type": "mcq",
            "prompt": "Which colours of light does chlorophyll absorb most strongly?",
            "options": ["Red and blue", "Green and yellow", "Only green", "Infrared and ultraviolet"],
            "answer": "Red and blue",
            "source": {"page": 7, "snippet": "Chlorophyll absorbs mainly red and blue light"},
        },
        {
            "id": "k2", "concept_id": "c3", "deck_id": DECK_ID, "type": "cloze",
            "prompt": "Leaves look green because chlorophyll ____ green light.",
            "options": None,
            "answer": "reflects",
            "source": {"page": 8, "snippet": "leaves appear green because chlorophyll reflects green light"},
        },
        {
            "id": "k3", "concept_id": "c2", "deck_id": DECK_ID, "type": "cloze",
            "prompt": "The Calvin cycle takes place in the ____ of the chloroplast.",
            "options": None,
            "answer": "stroma",
            "source": {"page": 4, "snippet": "The Calvin cycle takes place in the stroma"},
        },
        {
            "id": "k4", "concept_id": "c2", "deck_id": DECK_ID, "type": "explain",
            "prompt": "Explain how the Calvin cycle depends on the light dependent reactions.",
            "options": None,
            "answer": "It uses the ATP and NADPH made by the light dependent reactions to reduce fixed carbon dioxide into sugar.",
            "source": {"page": 5, "snippet": "ATP and NADPH from the light dependent reactions power the reduction of carbon"},
        },
        {
            "id": "k5", "concept_id": "c4", "deck_id": DECK_ID, "type": "mcq",
            "prompt": "Which of these is not a limiting factor of photosynthesis?",
            "options": ["Light intensity", "Carbon dioxide concentration", "Temperature", "Soil colour"],
            "answer": "Soil colour",
            "source": {"page": 9, "snippet": "light intensity, carbon dioxide concentration and temperature"},
        },
        {
            "id": "k6", "concept_id": "c1", "deck_id": DECK_ID, "type": "mcq",
            "prompt": "Where do the light dependent reactions take place?",
            "options": ["Thylakoid membranes", "Stroma", "Cytoplasm", "Mitochondria"],
            "answer": "Thylakoid membranes",
            "source": {"page": 2, "snippet": "occur in the thylakoid membranes"},
        },
        {
            "id": "k7", "concept_id": "c1", "deck_id": DECK_ID, "type": "explain",
            "prompt": "Explain what happens to water during the light dependent reactions.",
            "options": None,
            "answer": "Light energy splits water into oxygen, protons and electrons; the oxygen is released.",
            "source": {"page": 3, "snippet": "water is split, releasing oxygen"},
        },
    ]


def card_by_id(card_id: str) -> dict | None:
    return next((c for c in cards() if c["id"] == card_id), None)


def concept_by_id(concept_id: str) -> dict | None:
    return next((c for c in concepts() if c["id"] == concept_id), None)


def stats() -> dict:
    goal = STATE["daily_goal"]
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
        "now": iso(now()),
    }
