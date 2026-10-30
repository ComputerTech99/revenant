"""SQLite schema, connections and the app clock.

"now" is the real UTC clock plus a time-warp offset stored in the settings
table, so the demo can jump days ahead without touching any card data.
"""

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "revenant.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decks (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL,          -- processing | ready | failed
    progress   REAL NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS concepts (
    id       TEXT PRIMARY KEY,
    deck_id  TEXT NOT NULL REFERENCES decks(id),
    name     TEXT NOT NULL,
    summary  TEXT NOT NULL,
    pages    TEXT NOT NULL,            -- JSON list of ints
    position INTEGER NOT NULL,         -- reading order within the deck
    ever_mastered INTEGER NOT NULL DEFAULT 0  -- 1 once it has earned its freeze
);

CREATE TABLE IF NOT EXISTS cards (
    id               TEXT PRIMARY KEY,
    concept_id       TEXT NOT NULL REFERENCES concepts(id),
    deck_id          TEXT NOT NULL REFERENCES decks(id),
    type             TEXT NOT NULL,    -- mcq | cloze | explain
    prompt           TEXT NOT NULL,
    options          TEXT,             -- JSON list, mcq only
    answer           TEXT NOT NULL,
    source_page      INTEGER NOT NULL,
    source_snippet   TEXT NOT NULL,
    -- SM-2 state
    ease             REAL NOT NULL DEFAULT 2.5,
    interval_days    REAL NOT NULL DEFAULT 0,
    reps             INTEGER NOT NULL DEFAULT 0,
    due_at           TEXT NOT NULL,
    last_reviewed_at TEXT,
    created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
    id          TEXT PRIMARY KEY,
    card_id     TEXT NOT NULL REFERENCES cards(id),
    grade       TEXT NOT NULL,
    xp          INTEGER NOT NULL,      -- includes the daily goal bonus if this review earned it
    reviewed_at TEXT NOT NULL,
    day         TEXT NOT NULL          -- local calendar date of "now", e.g. 2026-10-31
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, due_at);
"""


@contextmanager
def connect():
    """Open a connection, commit on success, always close.

    A fresh connection per use keeps the background generation thread and the
    request handlers from sharing one sqlite3 object.
    """
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        add_missing_columns(conn)
        # A deck still "processing" at startup lost its background task when
        # the server stopped, so it will never finish. Mark it failed.
        conn.execute("UPDATE decks SET status = 'failed' WHERE status = 'processing'")


# Columns added after the first schema; older database files get them here.
NEW_COLUMNS = [
    ("concepts", "ever_mastered", "INTEGER NOT NULL DEFAULT 0"),
    ("reviews", "day", "TEXT NOT NULL DEFAULT ''"),
]


def add_missing_columns(conn) -> None:
    for table, column, definition in NEW_COLUMNS:
        existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


# --- Settings --------------------------------------------------------------

def get_setting(conn, key: str, default: str) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(conn, key: str, value) -> None:
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, str(value)),
    )


# --- Time ------------------------------------------------------------------

def now(conn) -> datetime:
    offset_days = float(get_setting(conn, "offset_days", "0"))
    return datetime.now(timezone.utc) + timedelta(days=offset_days)


def iso(dt: datetime) -> str:
    # Fixed width, so ISO strings compare correctly as text in SQL.
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
