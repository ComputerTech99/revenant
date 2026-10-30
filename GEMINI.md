# Revenant — Antigravity rules (Aditya: frontend + experience)

Revenant turns a student's PDF into spaced-repetition revision: Gemma extracts concepts and writes grounded questions, SM-2 schedules them, and this browser UI makes revising feel like Duolingo and makes forgetting visible.
Built at the Devf8rge × Hacktoberfest Hack Day finals (Theme 02: Open Source for Education). **Code freeze: 10:00 AM IST, 31 Oct. Commits after that do not count.**

Two humans, two agents, one repo. You are Aditya's agent and you own the **frontend**. Ojash's agent (Claude Code) owns the backend.

@docs/CONTRACT.md

## Ownership (strict)

- You may edit only: `frontend/` and `docs/DEMO.md`.
- **Never** edit `backend/`, `scripts/`, `CLAUDE.md` or `docs/CONTRACT.md`. If the API seems wrong or missing something, stop and tell Aditya. Do not invent endpoints or fields.

## Hackathon rules (breaking these disqualifies the team)

- No real API keys or secrets in the repo. The frontend needs none; it talks only to `/api`.
- Dependencies must have OSI licences. Do not publish to npm. Do not open issues or PRs on other repositories.
- Aditya demos alone and must be able to explain every component. Keep components small and readable; no clever abstractions.
- **The mascot is an original ghost drawn in SVG.** Do not imitate Duolingo's owl, its exact colours, or any brand's mascot or logo.

## Stack

React + Vite (JavaScript), Tailwind CSS, Framer Motion, `canvas-confetti`, React Router. Vite proxies `/api` → `http://localhost:8000`.

**Mock mode first:** with `VITE_USE_MOCKS=true`, every call goes through `src/api/client.js` to fixtures in `src/mocks/` that match the contract exactly. Build all screens on mocks, then flip the flag. All network code lives in `src/api/client.js` and nowhere else.

## Design direction

- A dark "night" base, one warm amber accent, ghost-white for the mascot, and red only for "shaky". Rounded, chunky, friendly; large tap targets.
- Use CSS variables for colours. Respect `prefers-reduced-motion`.
- **Demo speed matters:** keys 1–4 pick an mcq option, Enter submits or continues, and nothing on the review path takes more than one click.
- Every screen needs loading, empty and error states. A blank screen during the demo is the worst outcome.

## Screens and phases (do them in order)

**P1 — scaffold (target 12:15 AM).** Vite, Tailwind, router, the API client and mock fixtures, plus the theme tokens. Push immediately.

**P2 — onboarding and home (target 2:00 AM).**
- First launch: a daily-goal picker (Casual 5 · Regular 15 · Serious 30) → `POST /api/settings`.
- Home shows the streak flame and count, freezes, and today's XP against the goal as a progress ring.
- **The ghost** sits on Home. Its opacity reflects streak health: 1.0 if `goal_met`, 0.7 if `streak > 0` but today's goal isn't met, 0.35 if `streak` is 0. Animate a gentle float. It "solidifies" with a little bounce when the goal is met.
- The deck list shows each deck's due count and mastery %. A PDF upload with drag and drop shows a progress bar while polling `GET /api/decks/:id` every 2 s.

**P3 — review session (target 3:30 AM).**
- Card types: mcq (4 options), cloze (a text input in place of `____`, case-insensitive trimmed match), explain (a textarea → `POST /api/review/:id/explain`, with a "Gemma is reading your answer…" state).
- After each answer, show right or wrong, the correct answer, and a **"From page N" chip with the source snippet**. Grounding is our anti-hallucination story, so make it visible.
- A progress bar across the top, and a satisfying sound or animation on a correct answer.

**P4 — path, time travel and session end (target 4:30 AM).**
- **Path screen** (`GET /api/decks/:id/path`): concepts as nodes on a winding vertical path. Map `health` to visuals: ≥ 0.85 solid with a glow; 0.7–0.85 slightly faded; 0.5–0.7 cracked; < 0.5 heavily cracked and ghostly. `new` = outlined and locked-looking. Tapping a node shows its summary and pages.
- **Time-travel control:** a small pill labelled "Demo: time travel" with +1 day and +7 days → `POST /api/debug/timewarp`, then refetch everything so the nodes visibly crack. This is the centrepiece of the demo, so make the transition animated and obvious.
- **Session end:** XP gained, accuracy, "N cards return tomorrow, M next week", confetti when the goal is reached.

**P5 — go live and polish (target 5:30 AM).** Flip off mock mode and fix every mismatch with the real backend (report contract problems to Aditya rather than patching around them). Add a browser Notification when cards are due while the tab is open. Write `docs/DEMO.md`: a 3-minute script with exact clicks, the seeded deck, and what to do if the model is slow (use the seeded deck; it needs no model).

## Working style

- Small commits with conventional messages (`feat(ui): ...`, `fix(review): ...`). Run `git pull --rebase` before every push.
- Check every screen at a 1280 px laptop width (the stage) and a 390 px phone width.
- Ask Aditya before adding a dependency.
