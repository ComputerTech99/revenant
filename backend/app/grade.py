"""Explain-back: Gemma grades the student's own-words answer.

Returns {score: 0-1, feedback}. If the model is unreachable we fall back to a
plain word-overlap score, so the demo still works with Ollama down.
"""

import logging
import re

from . import llm

log = logging.getLogger("revenant.grade")

PROMPT = """You grade a student's answer to a revision question. Compare it with the model answer and the source text.

Question: {prompt}
Model answer: {answer}
Source text: "{snippet}"
Student answer: {student}

Score from 0 to 1 for how much of the model answer's meaning the student got right. Wording does not matter, meaning does.
- 1.0: every key idea is there and correct.
- 0.5: some key ideas are there, others are missing.
- 0.0: wrong, unrelated or empty.

Feedback: at most two sentences, addressed to the student as "you". First say specifically what they got right, if anything. Then name what was missing and quote the exact words from the source text that cover it.
Style: sentence case, direct, active voice, encouraging without hype. No exclamation marks. Never use the words elevate, seamless, unleash, delve or game changer.

Return only JSON: {{"score": 0.0, "feedback": "..."}}
"""

STOPWORDS = set(
    "the a an and or of to in on at for by with from into is are was were be been it its this that "
    "these those as which who what when where how why their they them than then also can".split()
)


def tidy_feedback(text: str) -> str:
    """Enforce the voice rules the model might ignore: no "!", two sentences max."""
    text = re.sub(r"\s+", " ", text.replace("!", ".")).strip()
    sentences = re.split(r"(?<=[.?])\s+", text)
    return " ".join(sentences[:2])


def overlap_score(student: str, model_answer: str) -> float:
    """Share of the model answer's content words that appear in the student's answer."""
    def words(text):
        return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOPWORDS and len(w) > 2}
    key = words(model_answer)
    return len(key & words(student)) / len(key) if key else 0.0


def grade_explanation(card, student_answer: str) -> tuple[float, str]:
    student = student_answer.strip()
    if not student:
        return 0.0, "You left this blank. The source text below has the answer."

    prompt = PROMPT.format(
        prompt=card["prompt"],
        answer=card["answer"],
        snippet=card["source_snippet"],
        student=student[:2000],  # keep a pasted essay from blowing up the prompt
    )
    try:
        result = llm.generate_json(prompt)
        score = min(1.0, max(0.0, float(result["score"])))
        feedback = tidy_feedback(str(result["feedback"]))
        if not feedback:
            raise ValueError("empty feedback")
        return round(score, 2), feedback
    except (llm.LLMError, KeyError, TypeError, ValueError) as exc:
        log.warning("Model grading failed, using word overlap: %s", exc)
        score = round(overlap_score(student, card["answer"]), 2)
        return score, (
            "The model is not available, so this score counts matching key words. "
            "Compare your answer with the source text below."
        )
