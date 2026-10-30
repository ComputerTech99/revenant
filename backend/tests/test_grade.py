"""Explain-back grading: model path, fallback path and the grade mapping."""

from fastapi.testclient import TestClient

from app import grade, llm
from app.main import app, score_to_grade

CARD = {
    "prompt": "Explain what happens to water in the light dependent reactions.",
    "answer": "Light energy splits water, releasing oxygen.",
    "source_snippet": "water is split, releasing oxygen",
}


def test_score_to_grade_boundaries():
    assert score_to_grade(0.8) == "good"
    assert score_to_grade(0.79) == "hard"
    assert score_to_grade(0.5) == "hard"
    assert score_to_grade(0.49) == "again"


def test_model_score_is_clamped_and_feedback_tidied(monkeypatch):
    monkeypatch.setattr(llm, "generate_json", lambda p: {
        "score": 1.4,
        "feedback": "Great job! You said water is split. You missed oxygen. Extra sentence.",
    })
    score, feedback = grade.grade_explanation(CARD, "water gets split")
    assert score == 1.0
    assert "!" not in feedback
    assert feedback == "Great job. You said water is split."


def test_falls_back_to_word_overlap_when_model_is_down(monkeypatch):
    def down(p):
        raise llm.LLMError("connection refused")
    monkeypatch.setattr(llm, "generate_json", down)
    score, feedback = grade.grade_explanation(CARD, "light splits water")
    assert 0 < score < 1  # 3 of the 5 key words
    assert CARD["source_snippet"] in feedback
    assert "You covered the core idea well." in feedback
    assert 'Review the source note "water is split, releasing oxygen" for the remaining detail.' in feedback

    # Test missed key terms branch
    score_low, feedback_low = grade.grade_explanation(CARD, "unrelated random words")
    assert score_low == 0.0
    assert CARD["source_snippet"] in feedback_low
    assert 'Your answer missed key terms from the notes. The text states "water is split, releasing oxygen".' == feedback_low


def test_blank_answer_scores_zero_without_model_call(monkeypatch):
    monkeypatch.setattr(llm, "generate_json", lambda p: (_ for _ in ()).throw(AssertionError("called")))
    assert grade.grade_explanation(CARD, "   ")[0] == 0.0


def test_explain_endpoint_schedules_card(monkeypatch):
    from tests.test_api import FAKE_OUTPUT, FIXTURE
    monkeypatch.setattr(llm, "generate_json", lambda p: FAKE_OUTPUT)
    with TestClient(app) as client:
        client.post("/api/decks", files={"file": ("n.pdf", FIXTURE.read_bytes(), "application/pdf")})
        card = client.get("/api/review/due").json()[0]

        monkeypatch.setattr(llm, "generate_json", lambda p: {"score": 0.65, "feedback": "You got part of it."})
        result = client.post(f"/api/review/{card['id']}/explain", json={"answer": "something"}).json()
        assert (result["score"], result["grade"], result["xp_gained"]) == (0.65, "hard", 13)
        assert result["source"] == card["source"]
        assert result["concept"]["health"] == 1.0
        assert set(result) == {"score", "feedback", "grade", "source", "next_due", "concept", "xp_gained", "stats"}
