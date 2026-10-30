from pathlib import Path

import pytest

from app.ingest import CHUNK_MAX, IngestError, chunk_text, make_chunks, read_pdf

FIXTURE = Path(__file__).parent / "fixtures" / "photosynthesis.pdf"


def test_reads_text_per_page():
    pages, _ = read_pdf(FIXTURE.read_bytes())
    assert len(pages) == 5
    assert "thylakoid membranes" in pages[0]


def test_chunks_merge_pages_and_stay_under_max():
    chunks = make_chunks(["a " * 500] * 6)  # six pages of ~1,000 chars
    assert [c["pages"] for c in chunks] == [[1, 2], [3, 4], [5, 6]]
    assert all(len(chunk_text(c)) <= CHUNK_MAX for c in chunks)


def test_long_page_is_split():
    chunks = make_chunks(["word " * 2000])  # one 10,000 char page
    assert len(chunks) > 1
    assert all(c["pages"] == [1] for c in chunks)


def test_not_a_pdf_gives_clear_error():
    with pytest.raises(IngestError, match="Could not open"):
        read_pdf(b"%PDF-1.4 garbage")
