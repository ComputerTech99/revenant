"""Chunk -> concepts + cards with Gemma, then validate every card.

Validation is what keeps generated questions grounded in the student's PDF:
a card whose source snippet is not really in the text is thrown away.
"""

import json
import logging
import re
import unicodedata

from . import db, llm
from .ingest import chunk_text

log = logging.getLogger("revenant.generate")

CARD_TYPES = {"mcq", "cloze", "explain"}
MAX_PROMPT_CHARS = 300
BLANK = "____"

# The voice rules are repeated here because Gemma writes text the student sees.
PROMPT = """You write revision questions for a student from one section of their study notes.

Return only JSON in exactly this shape:
{{"concepts": [{{"name": "...", "summary": "...", "cards": [
  {{"type": "mcq", "prompt": "...", "options": ["...", "...", "...", "..."], "answer": "...", "source": {{"page": 1, "snippet": "..."}}}}
]}}]}}

Rules:
- Pick 1 to 3 concepts that this section actually teaches. Ignore headings, page furniture, references and exercise lists.
- name: a short noun phrase of two to five words in sentence case, with no hyphens.
- summary: one plain sentence.
- Write 2 to 4 cards per concept and mix the types mcq, cloze and explain.
- mcq: "options" holds exactly 4 different strings, "answer" is copied exactly from one of them, and the wrong options are plausible.
- cloze: "prompt" is one sentence with exactly one blank written as ____ (four underscores), "answer" is the missing words, "options" is null.
- explain: "prompt" asks the student to explain an idea in their own words, "answer" is a model answer of one to three sentences, "options" is null.
- Keep every prompt under 300 characters.
- source.snippet: copy a phrase or sentence from the text EXACTLY, character for character, that supports the answer. Use 5 to 25 words. Do not paraphrase or fix typos.
- source.page: the page the snippet comes from, shown by the [page N] markers.
- Style for every string: sentence case, direct, active voice. No exclamation marks. Never use the words elevate, seamless, unleash, delve or game changer.

Text:
{text}
"""


def build_prompt(chunk: dict) -> str:
    text = "\n\n".join(f"[page {p}]\n{chunk['page_texts'][p]}" for p in chunk["pages"])
    return PROMPT.format(text=text)


# --- Validation ------------------------------------------------------------

def normalise(text: str) -> str:
    """Whitespace-normalise for the snippet check.

    NFKC also turns PDF ligatures like "ﬁ" into "fi", so a snippet the model
    copied correctly is not rejected over an invisible character difference.
    """
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def validate_card(card: dict, chunk_text_normalised: str) -> str | None:
    """Return None if the card is valid, otherwise the reason it is rejected."""
    if not isinstance(card, dict):
        return "not an object"
    card_type = card.get("type")
    prompt = card.get("prompt")
    answer = card.get("answer")
    source = card.get("source") or {}
    snippet = source.get("snippet") if isinstance(source, dict) else None

    if card_type not in CARD_TYPES:
        return f"unknown type {card_type!r}"
    if not isinstance(prompt, str) or not prompt.strip():
        return "empty prompt"
    if not isinstance(answer, str) or not answer.strip():
        return "empty answer"
    if len(prompt) > MAX_PROMPT_CHARS:
        return "prompt longer than 300 characters"

    # Grounding: the snippet must appear verbatim in the chunk.
    if not isinstance(snippet, str) or not snippet.strip():
        return "missing source snippet"
    if normalise(snippet) not in chunk_text_normalised:
        return "snippet not found in source text"

    if card_type == "mcq":
        options = card.get("options")
        if not isinstance(options, list) or len(options) != 4:
            return "mcq does not have exactly 4 options"
        if not all(isinstance(o, str) and o.strip() for o in options):
            return "mcq has an empty option"
        if len({o.strip().lower() for o in options}) != 4:
            return "mcq options are not unique"
        if answer.strip() not in [o.strip() for o in options]:
            return "mcq answer is not one of the options"

    if card_type == "cloze":
        # Count runs of 4+ underscores so "_____" counts as one blank, not two.
        if len(re.findall(r"_{4,}", prompt)) != 1:
            return "cloze prompt does not have exactly one ____"

    return None


def clean_card(card: dict, chunk: dict) -> dict:
    """Tidy a valid card into the shape we store."""
    prompt = card["prompt"].strip()
    if card["type"] == "cloze":
        prompt = re.sub(r"_{4,}", BLANK, prompt)
    snippet = card["source"]["snippet"].strip()

    # Trust the text, not the model, for the page number: use the page whose
    # text contains the snippet. Fall back to the model's page, then the first.
    page = next(
        (p for p in chunk["pages"] if normalise(snippet) in normalise(chunk["page_texts"][p])),
        None,
    )
    if page is None:
        claimed = card["source"].get("page")
        page = claimed if claimed in chunk["pages"] else chunk["pages"][0]

    return {
        "type": card["type"],
        "prompt": prompt,
        "options": [o.strip() for o in card["options"]] if card["type"] == "mcq" else None,
        "answer": card["answer"].strip(),
        "source": {"page": page, "snippet": snippet},
    }


def validate_chunk_output(output, chunk: dict) -> list[dict]:
    """Keep the concepts that still have at least one valid card."""
    concepts = output.get("concepts") if isinstance(output, dict) else output
    if not isinstance(concepts, list):
        return []
    text = normalise(chunk_text(chunk))
    kept = []
    for concept in concepts:
        if not isinstance(concept, dict):
            continue
        name = str(concept.get("name") or "").strip().rstrip(".")
        summary = str(concept.get("summary") or "").strip()
        if not name or not summary:
            continue
        cards = []
        for card in concept.get("cards") or []:
            reason = validate_card(card, text)
            if reason:
                log.info("Rejected card in %r: %s", name, reason)
            else:
                cards.append(clean_card(card, chunk))
        if cards:
            kept.append({"name": name, "summary": summary, "cards": cards})
    return kept


# --- Saving ----------------------------------------------------------------

def save_concept(conn, deck_id: str, concept: dict, now_iso: str) -> None:
    """Insert a concept and its cards.

    If the deck already has a concept with the same name (the PDF covers it
    across two chunks), add the cards to that concept instead of duplicating it.
    """
    pages = sorted({c["source"]["page"] for c in concept["cards"]})
    existing = conn.execute(
        "SELECT id, pages FROM concepts WHERE deck_id = ? AND lower(name) = lower(?)",
        (deck_id, concept["name"]),
    ).fetchone()

    if existing:
        concept_id = existing["id"]
        merged = sorted(set(json.loads(existing["pages"])) | set(pages))
        conn.execute("UPDATE concepts SET pages = ? WHERE id = ?", (json.dumps(merged), concept_id))
    else:
        concept_id = db.new_id("con")
        position = conn.execute(
            "SELECT COUNT(*) FROM concepts WHERE deck_id = ?", (deck_id,)
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO concepts (id, deck_id, name, summary, pages, position) VALUES (?, ?, ?, ?, ?, ?)",
            (concept_id, deck_id, concept["name"], concept["summary"], json.dumps(pages), position),
        )

    for card in concept["cards"]:
        # New cards are due immediately so they show up in the next review.
        conn.execute(
            "INSERT INTO cards (id, concept_id, deck_id, type, prompt, options, answer, "
            "source_page, source_snippet, due_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                db.new_id("card"), concept_id, deck_id, card["type"], card["prompt"],
                json.dumps(card["options"]) if card["options"] else None,
                card["answer"], card["source"]["page"], card["source"]["snippet"],
                now_iso, now_iso,
            ),
        )


# --- Background task -------------------------------------------------------

def generate_deck(deck_id: str, chunks: list[dict]) -> None:
    """Run in a FastAPI background task: one chunk at a time.

    Progress is written after every chunk and cards are committed as soon as
    their chunk is done, so the student can start reviewing early.
    """
    saved_cards = 0
    for index, chunk in enumerate(chunks, start=1):
        try:
            output = llm.generate_json(build_prompt(chunk))
            concepts = validate_chunk_output(output, chunk)
        except llm.LLMError as exc:
            log.warning("Skipping chunk %d of deck %s: %s", index, deck_id, exc)
            concepts = []

        with db.connect() as conn:
            now_iso = db.iso(db.now(conn))
            for concept in concepts:
                save_concept(conn, deck_id, concept, now_iso)
                saved_cards += len(concept["cards"])
            conn.execute("UPDATE decks SET progress = ? WHERE id = ?", (index / len(chunks), deck_id))

    status = "ready" if saved_cards else "failed"
    with db.connect() as conn:
        conn.execute("UPDATE decks SET status = ?, progress = 1 WHERE id = ?", (status, deck_id))
    log.info("Deck %s %s with %d cards", deck_id, status, saved_cards)
