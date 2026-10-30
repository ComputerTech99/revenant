"""Revenant backend: FastAPI app.

P1 stub: every contract endpoint returns realistic hardcoded data of the right
shape so the frontend can build against it. Later phases swap the stub data
for the real database, generator and scheduler.
"""

from datetime import timedelta
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import stub

app = FastAPI(title="Revenant")

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


# --- Request bodies --------------------------------------------------------

class ReviewBody(BaseModel):
    grade: Literal["again", "hard", "good", "easy"]


class ExplainBody(BaseModel):
    answer: str


class SettingsBody(BaseModel):
    daily_goal: Literal[5, 15, 30]


class TimewarpBody(BaseModel):
    days: int


# --- Endpoints -------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"ok": True, "model": "gemma4:e4b", "provider": "ollama"}


@app.post("/api/decks")
async def upload_deck(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, {"code": "not_a_pdf", "message": "Upload a PDF file."})
    return stub.new_processing_deck(file.filename)


@app.get("/api/decks")
def list_decks():
    return [stub.deck()]


@app.get("/api/decks/{deck_id}")
def get_deck(deck_id: str):
    if deck_id == stub.PROCESSING_DECK_ID:
        return stub.new_processing_deck("upload.pdf")
    if deck_id != stub.DECK_ID:
        raise not_found("deck")
    return stub.deck()


@app.get("/api/decks/{deck_id}/path")
def deck_path(deck_id: str):
    if deck_id != stub.DECK_ID:
        raise not_found("deck")
    return stub.concepts()


@app.get("/api/review/due")
def due_cards(deck_id: str | None = None, limit: int = 15):
    if deck_id is not None and deck_id != stub.DECK_ID:
        raise not_found("deck")
    return stub.cards()[:limit]


@app.post("/api/review/{card_id}/explain")
def explain_card(card_id: str, body: ExplainBody):
    card = stub.card_by_id(card_id)
    if card is None:
        raise not_found("card")
    return {
        "score": 0.6,
        "feedback": "You named the light reactions correctly. You missed that they happen in the thylakoid membranes.",
        "grade": "hard",
        "source": card["source"],
        "next_due": stub.iso(stub.now() + timedelta(days=1)),
        "concept": stub.concept_by_id(card["concept_id"]),
        "xp_gained": 12,
        "stats": stub.stats(),
    }


@app.post("/api/review/{card_id}")
def review_card(card_id: str, body: ReviewBody):
    card = stub.card_by_id(card_id)
    if card is None:
        raise not_found("card")
    xp = 10 if body.grade in ("good", "easy") else 0
    return {
        "next_due": stub.iso(stub.now() + timedelta(days=1 if body.grade != "again" else 0)),
        "concept": stub.concept_by_id(card["concept_id"]),
        "xp_gained": xp,
        "stats": stub.stats(),
    }


@app.get("/api/stats")
def get_stats():
    return stub.stats()


@app.post("/api/settings")
def update_settings(body: SettingsBody):
    stub.STATE["daily_goal"] = body.daily_goal
    return stub.stats()


@app.post("/api/debug/timewarp")
def timewarp(body: TimewarpBody):
    stub.STATE["offset_days"] += body.days
    return {"now": stub.iso(stub.now())}


@app.post("/api/debug/reset")
def reset():
    stub.STATE["offset_days"] = 0
    return {"now": stub.iso(stub.now())}
