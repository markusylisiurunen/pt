---
name: "deslop-patterns"
description: "Apply PT-specific single-user, SQLite, Deno, React, compatibility, and verification patterns during deslop cleanup. Use only alongside the deslop skill in the PT repository. Trigger: explicit."
---

# PT deslop patterns

Use these patterns alongside `deslop` and `AGENTS.md`.

## Product and compatibility

PT is a small personal nutrition and training tracker. Keep it stupid-simple and single-user. Do not introduce multi-user, multi-tenant, enterprise, plugin, or framework abstractions without an explicit product requirement.

The SQLite database and import/export documents contain real local user data. Preserve existing data, migrations, and document compatibility. Do not remove old migration support or reset storage merely because a canonical new shape is cleaner. Unshipped internal function and component contracts may be tightened when all callers are updated.

## Architecture and ownership

- `main.ts` owns Deno server startup, SQLite initialization, authentication, routing, and static serving.
- `lib/routes/` owns HTTP boundaries. Validate and normalize external input there, then keep internal code direct.
- `lib/db/` owns SQLite schema, documents, and migrations. Keep migration order and persisted shapes explicit.
- `lib/entities/` owns shared domain types. Do not duplicate them in routes, agent tools, or the web client without a real boundary transformation.
- `lib/agent/` owns model orchestration and tools; `lib/prompts/` owns model instructions. Keep tool contracts, persisted documents, and prompts aligned.
- `web/src/` owns the React UI. Keep backend truth out of components and avoid parallel client-only domain models when shared types or explicit DTOs already exist.
- Keep the checked-in Fineli dataset read-only during ordinary cleanup.

Prefer direct code and a few duplicated obvious lines over premature helpers, repositories, service layers, or configuration frameworks. Add dependencies only when Deno, browser APIs, or a small local implementation are insufficient.

## High-risk cleanup

- Preserve authentication and per-user runtime separation even though the deployment is personal.
- Keep food-log, weight-log, known-ingredient, memory, and document shapes synchronized across storage, routes, tools, prompts, import, and export.
- Treat AI provider calls, transcription, uploaded input, and Python execution as external boundaries requiring explicit validation and safe errors.
- Do not turn optional document fields into required fields without a migration and import/export decision.
- Keep generated `web/dist/`, local databases, secrets, and dependency directories out of commits.

## Tests and verification

Keep tests for chat event flow, user runtime isolation, persistence, migrations, parsing, and other behavior difficult to verify by inspection. Do not add low-value tests merely for coverage.

Run:

```sh
deno fmt main.ts lib deno.json
deno task check
```

`deno task check` owns backend formatting, linting, type checking, tests, frontend linting, and frontend build verification. Do not start development servers unless explicitly requested.
