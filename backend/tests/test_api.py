"""Upload -> background generation -> deck, path and due cards, with a fake model."""

from pathlib import Path

from fastapi.testclient import TestClient

from app import llm
from app.main import app

FIXTURE = Path(__file__).parent / "fixtures" / "photosynthesis.pdf"

FAKE_OUTPUT = {"concepts": [{
    "name": "Calvin cycle",
    "summary": "The stroma fixes carbon dioxide using ATP and NADPH.",
    "cards": [
        {"type": "cloze", "prompt": "The Calvin cycle takes place in the ____.", "options": None,
         "answer": "stroma", "source": {"page": 1, "snippet": "The Calvin cycle takes place in the stroma"}},
        {"type": "explain", "prompt": "Explain where oxygen comes from.", "options": None,
         "answer": "Water is split in the light dependent reactions.",
         "source": {"page": 1, "snippet": "invented sentence not in the pdf"}},
    ],
}]}


def test_upload_generates_deck(monkeypatch):
    monkeypatch.setattr(llm, "generate_json", lambda prompt: FAKE_OUTPUT)
    with TestClient(app) as client:
        response = client.post("/api/decks", files={"file": ("notes.pdf", FIXTURE.read_bytes(), "application/pdf")})
        assert response.status_code == 200
        deck = response.json()
        assert deck["status"] == "processing" and deck["page_count"] == 5

        # TestClient runs background tasks before returning, so it is done now.
        deck = client.get(f"/api/decks/{deck['deck_id']}").json()
        assert deck["status"] == "ready" and deck["progress"] == 1
        # Same concept name in every chunk is merged into one concept.
        assert deck["concept_count"] == 1
        assert deck["card_count"] == 3  # one valid card per chunk, 3 chunks

        path = client.get(f"/api/decks/{deck['deck_id']}/path").json()
        assert path[0]["status"] == "new" and path[0]["health"] is None

        due = client.get("/api/review/due", params={"deck_id": deck["deck_id"]}).json()
        assert len(due) == 3 and due[0]["type"] == "cloze"


def test_model_down_marks_deck_failed(monkeypatch):
    def down(prompt):
        raise llm.LLMError("connection refused")
    monkeypatch.setattr(llm, "generate_json", down)
    with TestClient(app) as client:
        deck = client.post("/api/decks", files={"file": ("x.pdf", FIXTURE.read_bytes(), "application/pdf")}).json()
        assert client.get(f"/api/decks/{deck['deck_id']}").json()["status"] == "failed"


def test_non_pdf_rejected():
    with TestClient(app) as client:
        response = client.post("/api/decks", files={"file": ("x.txt", b"hello", "text/plain")})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "not_a_pdf"
