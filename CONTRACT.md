# Revenant API Contract — v1 (FROZEN)

This file is the single source of truth between the backend (Ojash, Claude Code) and the frontend (Aditya, Antigravity).
**AI agents must never edit this file.** If a change is needed, stop and tell your human; the two humans agree and one of them edits it.

## Conventions

- Backend: `http://localhost:8000`. Frontend dev server: `http://localhost:5173`, proxying `/api` → `:8000`.
- JSON everywhere, `snake_case` keys, timestamps in ISO 8601 UTC, all IDs are strings.
- Errors: any 4xx/5xx returns `{ "error": { "code": "string", "message": "human-readable" } }`.
- **"now"** = real server clock + time-warp offset. All due dates, health, streak and XP use "now", never the raw clock.

## Types

```
Deck {
  deck_id, title,
  status: "processing" | "ready" | "failed",
  progress: number 0–1,            // fraction of chunks processed
  page_count, concept_count, card_count,
  due_count,                        // cards due at "now"
  mastery_pct: number 0–100,        // % of concepts with status "mastered"
  created_at
}

Concept {
  id, deck_id, name,
  summary,                          // one sentence
  pages: [int],
  health: number 0–1 | null,        // null while status is "new"
  status: "new" | "learning" | "shaky" | "mastered",
  next_due: timestamp | null,
  card_count
}

Card {
  id, concept_id, deck_id,
  type: "mcq" | "cloze" | "explain",
  prompt,                           // cloze: contains "____" exactly once
  options: [string] | null,         // mcq only: exactly 4, answer is one of them
  answer,                           // mcq: the correct option text; cloze: the missing words; explain: model answer
  source: { page: int, snippet: string }   // snippet is verbatim text from the PDF
}

Stats {
  streak, best_streak, freezes,
  xp_today, xp_total,
  daily_goal: 5 | 15 | 30,
  reviews_today, goal_met: bool,
  now: timestamp
}
```

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | — | `{ "ok": true, "model": "string", "provider": "ollama" \| "gemini_api" }` |
| POST | `/api/decks` | multipart, field `file` (PDF) | `Deck` (status `processing`) |
| GET | `/api/decks` | — | `[Deck]` |
| GET | `/api/decks/:deck_id` | — | `Deck` (poll every 2 s while `processing`) |
| GET | `/api/decks/:deck_id/path` | — | `[Concept]` in reading order |
| GET | `/api/review/due?deck_id=&limit=` | — | `[Card]` (`deck_id` optional = all decks; default limit 15) |
| POST | `/api/review/:card_id` | `{ "grade": "again" \| "hard" \| "good" \| "easy" }` | `{ "next_due", "concept": Concept, "xp_gained", "stats": Stats }` |
| POST | `/api/review/:card_id/explain` | `{ "answer": "string" }` | `{ "score": 0–1, "feedback", "grade", "source", "next_due", "concept": Concept, "xp_gained", "stats": Stats }` |
| GET | `/api/stats` | — | `Stats` |
| POST | `/api/settings` | `{ "daily_goal": 5 \| 15 \| 30 }` | `Stats` |
| POST | `/api/debug/timewarp` | `{ "days": int }` | `{ "now" }` |
| POST | `/api/debug/reset` | — | `{ "now" }` (clears the time offset only) |

Grading rules:
- **mcq / cloze**: the frontend decides correctness and sends `again` (wrong) or `good` (right). It may offer an optional "easy" after a correct answer.
- **explain**: the backend grades with Gemma and applies the grade itself: score ≥ 0.8 → `good`, 0.5–0.8 → `hard`, < 0.5 → `again`.

## Health and status (backend computes, frontend renders)

- Per card: `health = 0.9 ^ (days_since_last_review / interval_days)`. That is 1.0 just after a review, 0.9 on the due date, and it falls as the card goes overdue.
- Per concept: the mean health of its reviewed cards; `null` if none has been reviewed yet.
- Status: `new` (nothing reviewed) · `shaky` (health < 0.7) · `mastered` (health ≥ 0.85 and every card's interval ≥ 21 days) · otherwise `learning`.

## XP and streak (backend computes)

- XP: +10 for a correct mcq or cloze answer, `round(score × 20)` for explain, and +20 once when `daily_goal` is reached that day.
- A day counts toward the streak when `reviews_today ≥ daily_goal`. A missed day consumes a freeze if one is available; otherwise the streak resets to 0.
- +1 freeze the first time any concept becomes `mastered` (maximum 2).
