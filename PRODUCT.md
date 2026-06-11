# Product

## Register

product

## Users

A single person learning Japanese (the app's owner). They study at a desk, usually in daytime light, working through vocabulary they've collected into a CSV. Their context is short, focused study sessions: load a set of words, drill them, move on. No account, no clutter. Their deck is saved to the cloud (Firestore), so it's waiting for them when they come back — on any device — and a CSV is still how cards get in and out.

## Product Purpose

A personal Japanese-learning flashcards app. The user uploads a CSV of words and the app turns each row into a flip-and-shuffle flashcard (Japanese on one side, English meaning on the other), grouped by the collection named in the file. Collections can be given colored tags, and the deck screen can filter to the collections sharing a tag. The deck and its organization are saved to the cloud (Firestore) between visits, and the user can export their cards back to CSV. Success is: drop in a file, and within seconds be studying clean, correctly-parsed cards with zero ceremony — then find them right where you left them next time, on any device.

## Brand Personality

Calm, focused, quietly precise. Three words: **composed, legible, unhurried**. The interface should feel like a tidy study desk — nothing competing for attention with the word you're learning. The Japanese text is the hero; everything else recedes.

## Anti-references

- Gamified language-app maximalism (Duolingo streaks, mascots, confetti, badges) — this is a quiet personal tool, not a dopamine machine.
- Dense SaaS dashboards with toolbars, side nav, and stat cards — there's one job per screen.
- Generic "AI startup" look: purple-on-white gradients, glassmorphism, hero-metric templates.

## Design Principles

1. **The word is the hero.** Japanese text gets the largest type, the strongest contrast, and the most breathing room. UI chrome stays out of its way.
2. **Zero ceremony.** From file picker to studying should feel instant and obvious. No setup screens, no configuration, no dead ends.
3. **Honest feedback.** Parsing tells the truth: what loaded, what was skipped, and exactly why — never a silent failure or a fake success.
4. **Calm over clever.** Restraint in color and motion. Delight comes from clarity and smooth, purposeful transitions, not decoration.

## Accessibility & Inclusion

WCAG 2.1 AA throughout. Japanese text rendered large with high contrast and a font stack that handles kanji/kana cleanly. Full keyboard operability (file upload, future flip/shuffle controls). All motion has a `prefers-reduced-motion` alternative. Status and error messaging is conveyed by text, not color alone.
