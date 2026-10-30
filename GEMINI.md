# Revenant — Antigravity rules (Aditya: frontend + experience)

Revenant turns a student's PDF into spaced-repetition revision: Gemma extracts concepts and writes grounded questions, SM-2 schedules them, and this browser UI makes revising feel like Duolingo and makes forgetting visible.
Devf8rge × Hacktoberfest finals, Theme 02 (Open Source for Education). **Code freeze: 10:00 AM IST, 31 Oct. Later commits do not count.**

You are Aditya's agent and own the **frontend**. Ojash's agent (Claude Code) owns the backend.

@docs/CONTRACT.md

## Ownership (strict)
- Edit only `frontend/` and `docs/DEMO.md`.
- **Never** edit `backend/`, `scripts/`, `CLAUDE.md` or `docs/CONTRACT.md`. If the API seems wrong, stop and tell Aditya. Never invent endpoints or fields.

## Hackathon rules (breaking these disqualifies the team)
- No secrets in the repo; the frontend talks only to `/api`.
- OSI-licensed dependencies only. Never publish to npm. No issues or PRs on other repos.
- Aditya demos alone and must be able to explain every component: small, readable components, no clever abstractions.
- The mascot is an **original ghost drawn in SVG**. Never imitate Duolingo's owl or any brand mascot.

## Stack
React + Vite (JavaScript), Tailwind CSS v4 (`@tailwindcss/vite`), Framer Motion, `canvas-confetti`, React Router, `@phosphor-icons/react`. Vite proxies `/api` → `http://localhost:8000`.
**Mock mode first:** with `VITE_USE_MOCKS=true`, all calls in `src/api/client.js` return fixtures from `src/mocks/` that match the contract exactly. Network code lives only in `src/api/client.js`.

## Visual system (non-negotiable; every value resolves through these rules)

**Type.** One typeface: **Geist**, self-hosted via Fontsource so the app works offline (no Google Fonts CDN). **Geist Mono** only for numbers: streak count, XP, page chips, timers. Weights 400–700 only; never 800/900; never italics. Font sizes only from Tailwind's scale (`text-xs` … `text-9xl`); no arbitrary sizes like `text-[19px]`. Buttons `text-base font-semibold`; nav/header buttons `text-sm font-semibold`. Headings get `text-balance`, body text gets `text-pretty`.

**Spacing.** Padding, margin and gap only from: `0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24` (2px … 96px). Nothing else (no `p-5`, `gap-7`, `mt-14`). Main buttons are `py-2 px-3`.

**Radius.** Tailwind radius classes only. Nested shapes with a gap under 32px: inner radius = outer radius − gap, applied only if the result is above 2px. Example: card `rounded-2xl` with `p-2` → inner element `rounded-lg`. Pills and chips are `rounded-full`.

**Colour.** Flat backgrounds only, never gradients. Page base `#131209`; surfaces `#1F1F1F`, raised `#272727`, borders and dividers `#313131`. Text `#EDEDED`, muted `#9B9B9B`. One accent, warm amber, for streaks, mastery and focus; red only for `shaky`. Glows come from `box-shadow` or `drop-shadow`, never gradient backgrounds. **The only gradient allowed** is on the Home heading text: left to right `#FFFFFF` → `#9B9B9B`, with the heading and its subheading capped at `max-w-[680px]` and broken where the thought breaks.

**Borders.** All four sides or none. Never a single-sided card border.

**Icons.** Phosphor only (flame for streak, snowflake for freeze, lightning for XP, etc.). No Material icons, no emoji standing in for icons.

**Motion.** One easing curve everywhere: `cubic-bezier(0.32,0.72,0,1)` (Framer: `ease: [0.32, 0.72, 0, 1]`); never default easings. Section and list reveals: `y: 64, filter: blur(12px), opacity: 0` → `y: 0, blur(0), opacity: 1` over 800ms via `whileInView` (once). **Deliberate exception for demo speed:** inside a review session (answer feedback, card swaps, button presses) use the same curve at 250–400ms. Never `window.addEventListener('scroll')`. Respect `prefers-reduced-motion`.

**Navigation.** A floating glass pill: `mt-6 mx-auto w-max rounded-full bg-black/80 backdrop-blur-3xl`, with Home · Path · Review and the current route clearly indicated. Below 640px (P5 stretch): a hamburger whose lines rotate into an X (`rotate-45` / `-rotate-45`, never disappearing) and open a full-screen `bg-black/80 backdrop-blur-3xl` overlay whose links fade up from `translate-y-12 opacity-0`, staggered 100/150/200ms.

**States, for every interactive element.** Hover: shift to the next surface colour or a slight scale. Active: `scale(0.98)`. Focus: a visible amber focus ring. Loading: **skeletons shaped like the real layout** (deck cards, path nodes, the feedback block), never spinners. Empty: a composed getting-started view. Errors: inline and specific, never `alert()`. No dead links; a button with nowhere to go is visibly disabled.

**Copy.** Sentence case. No hyphens inside UI text ("Fill the blank", "Explain it back"). No exclamation marks, no "Oops". Never "Elevate", "Seamless", "Unleash", "Next gen", "Game changer", "Delve". Mock data must be realistic: a deck like "Operating Systems, Unit 3" with 47 cards and 63.4% mastery; no Lorem Ipsum, no "John Doe", no round fake numbers.

**Ship details.** Ghost SVG favicon, `<title>`, meta description, a skip-to-content link, semantic `nav`/`main`/`section`, `aria-label` on icon buttons, a custom 404 route with the ghost and a link home, and a footer reading "Runs locally. Your PDFs never leave this laptop. MIT licence · Source on GitHub" (a real repo link).

## Screens and phases (in order)

**P1 — scaffold (target 12:15 AM).** Vite, Tailwind v4, fonts, colour tokens, easing token, router, nav pill, API client with mock fixtures. Push immediately.

**P2 — onboarding and home (target 2:00 AM).**
- **Onboarding opens with the tagline moment:** "Notes that come back / to haunt you, on schedule." at `text-5xl`, centred, `max-w-[680px]`. Words start at about 30% opacity and brighten to full one at a time in reading order on the easing curve (time-driven here, roughly 120ms apart). Then the goal picker fades up: Casual 5 · Regular 15 · Serious 30 → `POST /api/settings`. This doubles as the demo's opening shot.
- **Home:** gradient heading, the streak count in Geist Mono with a Phosphor flame, freezes, and today's XP against the goal as a progress ring.
- **The ghost** floats gently on Home; opacity is 1.0 if `goal_met`, 0.7 if `streak > 0` and the goal isn't met, 0.35 if `streak` is 0. It solidifies with a small bounce when the goal is met.
- **Decks:** due count and mastery % per deck. Drag-and-drop PDF upload validates on the client (PDF only, at most 20 MB, specific inline errors), then shows a progress bar while polling `GET /api/decks/:id` every 2s. With no decks, show the ghost and a single "Upload your first PDF" action.

**P3 — review session (target 3:30 AM).**
- mcq (four option cards, keys 1–4), cloze (an input in place of `____`, case-insensitive trimmed match), explain (textarea → `POST /api/review/:id/explain`, with a skeleton feedback block while Gemma grades).
- After each answer: right or wrong, the correct answer, and a **"From page N" chip** that expands to the source snippet. Grounding is our anti-hallucination story, so keep it visible.
- A progress bar along the top; Enter submits or continues; nothing on the review path takes more than one click.

**P4 — path, time travel, session end (target 4:30 AM).**
- **Path:** concept nodes on a winding vertical path. `health` ≥ 0.85 solid with an amber glow; 0.7–0.85 slightly faded; 0.5–0.7 cracked; < 0.5 heavily cracked and ghostly; `new` outlined and locked. Tapping a node shows its summary and pages.
- **Time travel:** a small pill labelled "Demo: time travel" with +1 day and +7 days → `POST /api/debug/timewarp`, then refetch so nodes visibly crack, with an animated transition. This is the centrepiece of the demo.
- **Session end:** XP gained, accuracy, "N cards return tomorrow, M next week", confetti when the goal is reached. The copy stays calm: "Goal reached." not "Amazing!".

**P5 — go live and polish (target 5:30 AM).** Turn off mock mode and fix mismatches with the real backend (report contract problems to Aditya; never patch around them). Add a browser Notification when cards are due while the tab is open. Write `docs/DEMO.md`: a 3-minute script with exact clicks, the seeded deck, and the fallback if the model is slow (use the seeded deck; it needs no model).

## Working style
- Small conventional commits (`feat(ui): ...`). `git pull --rebase` before every push.
- Check each screen at 1280px (the stage) and 390px (phone).
- Before calling a screen done, audit it against the visual system above: font sizes, spacing, radii, colours, easing, states and copy.
- Ask Aditya before adding a dependency.
