"""Card validation: the rules that keep questions grounded in the PDF."""

from app.generate import normalise, validate_card, validate_chunk_output

TEXT = normalise(
    "The Calvin cycle takes place in the stroma and uses ATP and NADPH\n to fix carbon dioxide."
)


def card(**overrides):
    base = {
        "type": "mcq",
        "prompt": "Where does the Calvin cycle take place?",
        "options": ["Stroma", "Thylakoid", "Nucleus", "Cytoplasm"],
        "answer": "Stroma",
        "source": {"page": 1, "snippet": "The Calvin cycle takes place in the stroma"},
    }
    base.update(overrides)
    return base


def test_valid_mcq_passes():
    assert validate_card(card(), TEXT) is None


def test_snippet_must_be_in_text():
    bad = card(source={"page": 1, "snippet": "The Calvin cycle happens in the stroma"})
    assert validate_card(bad, TEXT) == "snippet not found in source text"


def test_snippet_match_ignores_whitespace_differences():
    spaced = card(source={"page": 1, "snippet": "ATP and   NADPH to fix"})
    assert validate_card(spaced, TEXT) is None


def test_mcq_needs_exactly_four_unique_options_with_answer():
    assert validate_card(card(options=["Stroma", "Thylakoid", "Nucleus"]), TEXT)
    assert validate_card(card(options=["Stroma", "stroma", "Nucleus", "Cytoplasm"]), TEXT)
    assert validate_card(card(answer="Golgi"), TEXT)


def test_cloze_needs_exactly_one_blank():
    good = card(type="cloze", options=None, prompt="The Calvin cycle takes place in the ____.", answer="stroma")
    assert validate_card(good, TEXT) is None
    assert validate_card({**good, "prompt": "The ____ cycle is in the ____."}, TEXT)
    assert validate_card({**good, "prompt": "The Calvin cycle takes place in the stroma."}, TEXT)


def test_prompt_length_limit():
    assert validate_card(card(prompt="x" * 301), TEXT) == "prompt longer than 300 characters"


def test_invalid_cards_dropped_and_empty_concepts_skipped():
    chunk = {"pages": [1], "page_texts": {1: TEXT}}
    output = {"concepts": [
        {"name": "Calvin cycle", "summary": "Fixes carbon.", "cards": [card(), card(answer="Golgi")]},
        {"name": "Made up", "summary": "Not in the text.", "cards": [card(answer="Golgi")]},
    ]}
    kept = validate_chunk_output(output, chunk)
    assert [c["name"] for c in kept] == ["Calvin cycle"]
    assert len(kept[0]["cards"]) == 1
