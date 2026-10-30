"""Revenant backend: FastAPI app and every endpoint in CONTRACT.md."""

import logging
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import db, llm, stub, views
from .generate import generate_deck
from .ingest import IngestError, make_chunks, read_pdf

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Revenant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Errors: the contract wants { "error": { "code", "message" } } ---------

def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    # Our own raises pass detail as {"code", "message"}; anything else gets a generic code.
    if isinstance(exc.detail, dict):
        return error_response(exc.status_code, exc.detail["code"], exc.detail["message"])
    return error_response(exc.status_code, "http_error", str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    field = ".".join(str(part) for part in first["loc"][1:]) or "body"
    return error_response(422, "invalid_request", f"Invalid value for {field}: {first['msg']}.")


def not_found(what: str) -> HTTPException:
    return HTTPException(404, {"code": "not_found", "message": f"Could not find this {what}."})


def get_deck_row(conn, deck_id: str):
    row = conn.execute("SELECT * FROM decks WHERE id = ?", (deck_id,)).fetchone()
    if row is None:
        raise not_found("deck")
    return row


def get_card_row(conn, card_id: str):
    row = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    if row is None:
        raise not_found("card")
    return row


# --- Request bodies --------------------------------------------------------

class ReviewBody(BaseModel):
    grade: Literal["again", "hard", "good", "easy"]


class ExplainBody(BaseModel):
    answer: str


class SettingsBody(BaseModel):
    daily_goal: Literal[5, 15, 30]


class TimewarpBody(BaseModel):
    days: int


# --- Health ----------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"ok": True, "model": llm.MODEL, "provider": llm.PROVIDER}


# --- Decks -----------------------------------------------------------------

@app.post("/api/decks")
async def upload_deck(background: BackgroundTasks, file: UploadFile = File(...)):
    data = await file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, {"code": "not_a_pdf", "message": "This file is not a PDF. Upload a PDF file."})

    # Text extraction is quick, so do it now and reject unreadable PDFs
    # straight away. Only the slow model calls go to the background task.
    try:
        pages, pdf_title = read_pdf(data)
    except IngestError as exc:
        raise HTTPException(422, {"code": "unreadable_pdf", "message": str(exc)})
    chunks = make_chunks(pages)

    title = pdf_title or Path(file.filename or "Untitled").stem
    with db.connect() as conn:
        now = db.now(conn)
        deck_id = db.new_id("deck")
        conn.execute(
            "INSERT INTO decks (id, title, status, progress, page_count, created_at) "
            "VALUES (?, ?, 'processing', 0, ?, ?)",
            (deck_id, title, len(pages), db.iso(now)),
        )
        deck = views.deck_view(conn, get_deck_row(conn, deck_id), now)

    background.add_task(generate_deck, deck_id, chunks)
    return deck


@app.get("/api/decks")
def list_decks():
    with db.connect() as conn:
        now = db.now(conn)
        rows = conn.execute("SELECT * FROM decks ORDER BY created_at DESC").fetchall()
        return [views.deck_view(conn, row, now) for row in rows]


@app.get("/api/decks/{deck_id}")
def get_deck(deck_id: str):
    with db.connect() as conn:
        return views.deck_view(conn, get_deck_row(conn, deck_id), db.now(conn))


@app.get("/api/decks/{deck_id}/path")
def deck_path(deck_id: str):
    with db.connect() as conn:
        get_deck_row(conn, deck_id)
        return views.concept_views(conn, deck_id, db.now(conn))


# --- Review ----------------------------------------------------------------

@app.get("/api/review/due")
def due_cards(deck_id: str | None = None, limit: int = 15):
    with db.connect() as conn:
        now_iso = db.iso(db.now(conn))
        if deck_id is not None:
            get_deck_row(conn, deck_id)
        rows = conn.execute(
            "SELECT cards.* FROM cards JOIN concepts ON concepts.id = cards.concept_id "
            "WHERE cards.due_at <= ? AND (? IS NULL OR cards.deck_id = ?) "
            "ORDER BY cards.due_at, concepts.position LIMIT ?",
            (now_iso, deck_id, deck_id, max(limit, 0)),
        ).fetchall()
        return [views.card_view(row) for row in rows]


# Registered before /api/review/{card_id} so ".../explain" is never routed there.
@app.post("/api/review/{card_id}/explain")
def explain_card(card_id: str, body: ExplainBody):
    # P4 replaces this placeholder grading with Gemma.
    with db.connect() as conn:
        card = get_card_row(conn, card_id)
        now = db.now(conn)
        concept = conn.execute("SELECT * FROM concepts WHERE id = ?", (card["concept_id"],)).fetchone()
        return {
            "score": 0.6,
            "feedback": "You named the main idea. You missed the detail in the source.",
            "grade": "hard",
            "source": views.card_view(card)["source"],
            "next_due": db.iso(now + timedelta(days=1)),
            "concept": views.concept_view(conn, concept, now),
            "xp_gained": 12,
            "stats": stub.stats(conn),
        }


@app.post("/api/review/{card_id}")
def review_card(card_id: str, body: ReviewBody):
    # P3 replaces this placeholder with SM-2.
    with db.connect() as conn:
        card = get_card_row(conn, card_id)
        now = db.now(conn)
        concept = conn.execute("SELECT * FROM concepts WHERE id = ?", (card["concept_id"],)).fetchone()
        return {
            "next_due": db.iso(now + timedelta(days=0 if body.grade == "again" else 1)),
            "concept": views.concept_view(conn, concept, now),
            "xp_gained": 0 if body.grade == "again" else 10,
            "stats": stub.stats(conn),
        }


# --- Stats, settings, debug ------------------------------------------------

@app.get("/api/stats")
def get_stats():
    with db.connect() as conn:
        return stub.stats(conn)


@app.post("/api/settings")
def update_settings(body: SettingsBody):
    with db.connect() as conn:
        db.set_setting(conn, "daily_goal", body.daily_goal)
        return stub.stats(conn)


@app.post("/api/debug/timewarp")
def timewarp(body: TimewarpBody):
    with db.connect() as conn:
        offset = float(db.get_setting(conn, "offset_days", "0")) + body.days
        db.set_setting(conn, "offset_days", offset)
        return {"now": db.iso(db.now(conn))}


@app.post("/api/debug/reset")
def reset():
    with db.connect() as conn:
        db.set_setting(conn, "offset_days", 0)
        return {"now": db.iso(db.now(conn))}
