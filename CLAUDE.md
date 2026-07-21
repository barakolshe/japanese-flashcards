# CLAUDE.md

## Rules

- **Ask before assuming**: When a task is ambiguous, requirements are unclear, or you're unsure about the intended approach, ask clarifying questions before proceeding. Don't guess — it's better to ask than to build the wrong thing.
- **Don't write code unless asked**: Default to investigation and explanation only. Do not write, edit, or commit code unless the user explicitly asks you to. Answer questions, diagnose issues, and propose solutions verbally first.
- **Write tests for code changes**: When you change or add code, add or update tests that cover the new behavior. You don't run them yourself before a `dev` PR — the CI/CD pipeline runs lint, the full test suite, and the production build as required stages on the `dev` → `main` release PR, so keep your changes green for that gate.
- **Use the `impeccable` skill for frontend work**: Whenever you design, build, or change any user-facing interface — pages, components, layouts, styling, states, or UX copy — use the `impeccable` skill to bring the UI to a polished, production-grade standard. Don't ship frontend work without it. Skip impeccable's visual-inspection step — do not open or screenshot the running site to check it yourself; leave the visual checks to the user.
- **Avoid default values**: Try to avoid giving variables and parameters default values unless a default is specifically needed. Prefer making callers pass values explicitly so intent is clear and missing values surface as errors instead of being silently filled in.
- **Environment variables**: Never read environment variables (`process.env`) outside of a single central config/env module. Define and validate all configuration in one place and import it everywhere else.
- **Workflow**: At the start of a task, pull the latest `dev`. There is no pre-merge CI gate on PRs into `dev` and nothing to run locally first — open the PR and **merge it yourself** (`gh pr merge <num> --merge`) once it's mergeable; CI/CD does NOT auto-merge. Resolve any merge conflicts first. To check a CI/CD workflow's status, watch it with `gh pr checks <workflow> --watch --interval 15` instead of polling repeatedly. If a workflow never starts, or gets canceled for no apparent reason, a merge conflict with `dev` is the most likely cause — check the PR for conflicts and resolve them before assuming the pipeline is broken. After merging, sync your local `dev` with the remote in the **main project directory** (where `dev` is checked out), not in a worktree — git won't update a branch checked out elsewhere. If the project has a database, a post-merge job on `dev` applies any pending migrations after the merge (no build, no tests — the only quality checks live on the release PR); you don't need to wait for it — if it goes red, fix forward on `dev`.
- **Releasing to `main`**: Merging `dev` → `main` is a production release. Always ask the user for explicit confirmation before opening a `dev` → `main` PR. That PR is the project's single quality gate: the CI/CD pipeline runs lint, the full test suite, and the production build as required stages on it. Wait for them to pass, then merge the PR yourself once it's green; never release to `main` without the user's go-ahead.

## Project

A personal Japanese-learning flashcards web app. The user uploads a CSV file of words; the app turns them into a deck of flip-and-shuffle flashcards (Japanese on one side, English meaning on the other). There is also an export button to download cards back out as a CSV. No login and no user management — the app is single-user. Cards are sorted into **collections** (the per-card group), and collections can be grouped into **folders** (an in-app-only directory layer above collections — folders are never written to the exported CSV). The CSV column order is **japanese, english, pronunciation, collection, sentence** — **pronunciation** is an optional English reading of the Japanese word, and **sentence** is an optional very basic Japanese example sentence using the word; on a card, an eye toggle on the Japanese side reveals the pronunciation above the word, and the sentence (when present) is always visible below the word. (With a header row, columns are matched by name in any order; only the headerless/positional case depends on this order.) The working deck (cards plus their collection and folder organization) and the "show first" study direction are saved to the cloud in **Cloud Firestore**, so a refresh, a return visit, or a different device restores them. Cards still originate from an uploaded CSV; uploading a new file replaces the saved deck, and "Load a different file" clears it (behind a confirmation).

The web app lives in `./web` (Next.js 15, App Router, TypeScript, Tailwind CSS, pnpm). Run commands from inside `./web`.

## Tools

- **Package manager**: pnpm (run from `./web`). Common scripts: `pnpm dev`, `pnpm build`, `pnpm lint`.
- **Persistence**: Cloud Firestore (Firebase). There's no custom backend — the client talks to Firestore directly through the modular web SDK. State lives in two fixed documents (`flashcards/deck` and `flashcards/front`); the app is single-user with no auth. Wiring is in `web/src/lib/firebase.ts` (init + `getDb`) and `web/src/lib/deck-storage.ts` (read/write/validate). Firebase config comes from `NEXT_PUBLIC_FIREBASE_*` env vars, read and validated only in `web/src/lib/env.ts` (see `web/.env.example`). Firestore security rules are managed in the Firebase console, not in this repo.

## Issues

This project's issues live in a JSON file at `.forq/issues.json` — a JSON array of issue objects. The Forq VS Code extension renders them as a board and launches a Claude session for each issue moved to `todo`. Manage issues by editing this file directly.

Each issue object has this shape:

```json
{
  "id": "<uuid>",
  "idea_id": "<the ideaId from .project_idea>",
  "title": "Short, specific, self-explanatory title",
  "description": "A few sentences on the desired behavior or the problem.",
  "type": "feature" | "bug",
  "mode": "auto" | "plan",
  "assigned_to": "agent" | "human",
  "status": "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled",
  "order": 1,
  "created_at": "<ISO-8601 timestamp>",
  "updated_at": "<ISO-8601 timestamp>"
}
```

Rules when editing the file:

- Generate a fresh UUID for `id`; set `idea_id` to the id in `.project_idea`.
- New issues start in `backlog`. `order` is the position within a status column (use max existing order in that column + 1).
- Always update `updated_at` when you change an issue.
- When you finish work on an issue assigned to you, set its `status` to `in_review` — a human reviews before it becomes `done`. Do NOT set it to `done` yourself.
