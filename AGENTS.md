# PT

PT is a small, personal nutrition and training tracker. A Deno API stores local SQLite data and
serves a React/Vite web app. AI-assisted chat, transcription, and food lookup use Anthropic and
Gemini APIs.

## Principles

- Keep the project stupid-simple. Prefer direct code and existing platform features over
  abstractions, frameworks, or configuration layers.
- This is a single-user personal tool. Do not add multi-user, multi-tenant, or enterprise behavior
  unless explicitly requested.
- Preserve existing local data and import/export compatibility when changing storage or document
  formats.
- Keep backend and frontend changes focused. Avoid broad rewrites or speculative cleanup.
- Do not commit secrets, local databases, generated `web/dist/`, or dependency directories.

## Architecture

- `main.ts`: Deno server entry point, SQLite initialization, authentication, API routing, and static
  file serving
- `lib/agent/`: model orchestration and agent tools
- `lib/db/`: SQLite schema and document migrations
- `lib/entities/`: shared domain types
- `lib/routes/`: HTTP API handlers
- `lib/prompts/`: model system prompts
- `lib/util/`: small shared utilities
- `web/src/`: React frontend
- `data/fineli/`: checked-in Fineli nutrition dataset
- `.github/workflows/docker.yaml`: tag-based GHCR publishing

## Code conventions

- Deno 2, TypeScript, React, and Vite
- Use 2-space indentation, double quotes, semicolons, and a 100-character line width.
- Let `deno fmt` format backend files. Match the existing frontend formatting and ESLint rules.
- Use lowercase snake_case backend filenames and lowercase frontend component filenames.
- Types and components use `PascalCase`; values and functions use `camelCase`.
- Validate external input at route boundaries, then keep internal code direct.
- Prefer a few duplicated obvious lines over a premature helper or abstraction.
- Add dependencies only when the standard library or a small local implementation is not enough.

## Development

Install frontend dependencies once:

```sh
npm ci --prefix web
```

Run the API and Vite development server in separate terminals:

```sh
deno task dev
npm run dev --prefix web
```

The Vite server proxies `/api` to Deno on port 8000. Copy `.env.example` to `.env` and set the
credentials needed for the behavior being exercised.

## Verification

Format backend files before running the full check:

```sh
deno fmt main.ts lib deno.json
deno task check
```

`deno task check` verifies Deno formatting, linting, and type checking, then lints and builds the
frontend. There is no automated test suite; do not add low-value tests merely for coverage.

## Documentation

Keep `README.md`, `.env.example`, and this file aligned when changing setup, environment variables,
architecture, verification, or releases. Keep the README concise.

## Git and GitHub

- Use short, imperative commit subjects. Follow the repository's existing capitalization style.
- Use descriptive lowercase branch names without issue numbers unless a workflow supplies a branch
  name.
- Pull request titles should be concise and lowercase except for proper nouns.
- Pull request bodies use `## why` and `## what`, with `## details` only when useful. End with a
  closing keyword when the PR resolves an issue.
- Do not list routine verification commands in PR bodies; the `check` workflow is the source of
  truth.
- Releases remain tag based. Tags matching `v*.*.*` publish the container image and `latest` tag to
  GHCR.
- Use `gh` for GitHub reads and actions. Read the complete issue or pull request discussion before
  acting.
