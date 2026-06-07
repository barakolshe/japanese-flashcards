# CLAUDE.md

## Rules

- **Ask before assuming**: When a task is ambiguous, requirements are unclear, or you're unsure about the intended approach, ask clarifying questions before proceeding. Don't guess — it's better to ask than to build the wrong thing.
- **Don't write code unless asked**: Default to investigation and explanation only. Do not write, edit, or commit code unless the user explicitly asks you to. Answer questions, diagnose issues, and propose solutions verbally first.
- **Write tests for code changes**: When you change or add code, add or update tests that cover the new behavior, and make sure the test suite passes before considering the work done. Worktrees are throwaway and usually have no dependencies installed — don't run `pnpm install` in a worktree just to typecheck or run tests. Lean on the pre-merge CI gate to run them for you; only install locally when you genuinely need to iterate on a failing check.
- **Avoid default values**: Try to avoid giving variables and parameters default values unless a default is specifically needed. Prefer making callers pass values explicitly so intent is clear and missing values surface as errors instead of being silently filled in.
- **Use the `impeccable` skill for frontend work**: Whenever you design, build, or change any user-facing interface — pages, components, layouts, styling, states, or UX copy — use the `impeccable` skill to bring the UI to a polished, production-grade standard. Don't ship frontend work without it.
- **Environment variables**: Never read environment variables (`process.env`) outside of a single central config/env module. Define and validate all configuration in one place and import it everywhere else.
- **Workflow**: At the start of a task, pull the latest `dev`. After completing an implementation, commit and open a pull request to `dev`. The PR is gated by a pre-merge CI check (linting, tests, and build) that runs automatically; wait for it to pass, then **merge the PR yourself** (`gh pr merge <num> --merge`) — CI/CD does NOT auto-merge. Resolve any merge conflicts first. After merging, sync your local `dev` with the remote in the **main project directory** (where `dev` is checked out), not in a worktree — git won't update a branch checked out elsewhere. A slower build/deploy runs on `dev` after the merge; you don't need to wait for it — if it goes red, fix forward on `dev`.
- **Releasing to `main`**: Merging `dev` → `main` is a production release. Always ask the user for explicit confirmation before opening a `dev` → `main` PR, and merge it yourself once it's green — never release to `main` without the user's go-ahead.

## Project

A personal Japanese-learning flashcards web app. The user uploads a CSV file of words; the app turns them into a deck of flip-and-shuffle flashcards (Japanese on one side, English meaning on the other). There is also an export button to download cards back out as a CSV. No login, no server, and no database — but the working deck (cards plus their folder organization) is saved client-side in the browser's `localStorage`, so a refresh or a return visit restores it. Cards still originate from an uploaded CSV; uploading a new file replaces the saved deck, and "Load a different file" clears it (behind a confirmation).

The web app lives in `./web` (Next.js 15, App Router, TypeScript, Tailwind CSS, pnpm). Run commands from inside `./web`.

## Tools

- **Package manager**: pnpm (run from `./web`). Common scripts: `pnpm dev`, `pnpm build`, `pnpm lint`.
- No database, backend, or external services are used — this is a purely client-side web app. The only persistence is the browser's `localStorage` (see `web/src/lib/deck-storage.ts`); there is no server-side or cross-device storage. If the project ever grows to need accounts or synced data, consider adding Supabase (and the `supabase` MCP server for managing schema/migrations) at that point.

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
