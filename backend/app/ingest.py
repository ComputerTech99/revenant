"""PDF -> page texts -> chunks of roughly 1,500-2,500 characters."""

import io
import re

from pypdf import PdfReader

MAX_PAGES = 40
CHUNK_MIN = 1500
CHUNK_MAX = 2500
MIN_TOTAL_TEXT = 200  # less than this across all pages means a scanned PDF


class IngestError(Exception):
    """Raised with a user-facing message when a PDF cannot be used."""


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def read_pdf(data: bytes) -> tuple[list[str], str | None]:
    """Return (page texts for the first MAX_PAGES pages, PDF title or None)."""
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [clean(page.extract_text() or "") for page in reader.pages[:MAX_PAGES]]
        title = reader.metadata.title if reader.metadata else None
    except Exception:
        raise IngestError("Could not open this file as a PDF. Check that it is not damaged or password protected.")

    if sum(len(p) for p in pages) < MIN_TOTAL_TEXT:
        raise IngestError("Could not read this PDF. It looks like scanned images rather than text.")
    return pages, (title or "").strip() or None


def split_long(text: str, limit: int) -> list[str]:
    """Split text longer than `limit` into pieces at word boundaries."""
    pieces, current = [], ""
    for word in text.split(" "):
        if current and len(current) + 1 + len(word) > limit:
            pieces.append(current)
            current = word
        else:
            current = f"{current} {word}" if current else word
    if current:
        pieces.append(current)
    return pieces


def make_chunks(pages: list[str]) -> list[dict]:
    """Merge consecutive pages into chunks of about CHUNK_MIN-CHUNK_MAX chars.

    Each chunk is {"pages": [page numbers, 1-based], "page_texts": {page: text}}.
    Keeping text per page lets the generator tell Gemma which page each
    sentence is on, and lets validation look up the page of a snippet.
    """
    chunks: list[dict] = []
    current: dict = {"pages": [], "page_texts": {}}
    size = 0

    def flush():
        nonlocal current, size
        if current["pages"]:
            chunks.append(current)
        current, size = {"pages": [], "page_texts": {}}, 0

    for number, text in enumerate(pages, start=1):
        if not text:
            continue
        # A very long page is cut into pieces that each fit in a chunk.
        for piece in split_long(text, CHUNK_MAX):
            if size and size + len(piece) > CHUNK_MAX:
                flush()
            if number not in current["page_texts"]:
                current["pages"].append(number)
                current["page_texts"][number] = piece
            else:
                current["page_texts"][number] += " " + piece
            size += len(piece)
            if size >= CHUNK_MIN:
                flush()

    # A small leftover tail is folded into the previous chunk rather than
    # sent to the model on its own with too little context.
    if current["pages"] and chunks and size < CHUNK_MIN // 3:
        last = chunks[-1]
        for number in current["pages"]:
            if number in last["page_texts"]:
                last["page_texts"][number] += " " + current["page_texts"][number]
            else:
                last["pages"].append(number)
                last["page_texts"][number] = current["page_texts"][number]
    else:
        flush()
    return chunks


def chunk_text(chunk: dict) -> str:
    return " ".join(chunk["page_texts"][p] for p in chunk["pages"])
