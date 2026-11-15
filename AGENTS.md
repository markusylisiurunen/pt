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

## Releases

Releases are tag based. Tags matching `v*.*.*` publish the container image and `latest` tag to GHCR.

## Agent setup

`.agents/managed.json` identifies centrally managed skills, prompts, configuration, and the marked section below. Change their sources in the agents repository rather than editing managed content directly. Follow each skill's activation rules. Use `github-workflow` for Git and GitHub work and `clear-writing` for prose.

`.cowork/scripts/` and `.tau/scripts/provision` are repo-owned. Keep lifecycle hooks safe for dirty, non-default worktrees and preserve Git state. Do not add recurring schedules unless requested.

<!-- agents:subagents:start -->

## Subagent model selection

When neither the user nor active instructions request a subagent model or reasoning effort, omit the model override so the subagent uses the same model and settings as you. A model allowlist alone is not a request to select a model.

When a model is requested without an effort, use its default below. When an effort is explicitly requested, preserve it. If the environment cannot select the requested combination, explain the limitation rather than silently substituting another model.

For Claude subagents, prefer the Claude Code models, which use subscription limits instead of paid API usage. Use the direct Anthropic API only when the user or active instructions ask for it, so a plain request for Sonnet, Opus, or Haiku means the Claude Code model. If Claude Code is unavailable or out of limits, say so instead of switching to the API.

- Luna: `openai-codex/gpt-6-luna`; allowed efforts: low, medium, high, xhigh; default: `medium`.
- Terra: `openai-codex/gpt-6.1-terra`; allowed efforts: low, medium, high; default: `medium`.
- Sol: `openai-codex/gpt-6.1-sol`; allowed efforts: low, medium, high; default: `medium`.
- Astra: `openai-codex/gpt-6-astra`; allowed efforts: low, medium, high; default: `low`.
- Sonnet: `anthropic/claude-sonnet-5-5`; allowed efforts: low, medium, high; default: `medium`.
- Claude Code Sonnet: `claude-code/claude-sonnet-5-5`; allowed efforts: low, medium, high; default: `medium`.
- Claude Code Opus: `claude-code/claude-opus-5-5`; allowed efforts: low, medium, high; default: `medium`.
- Claude Code Haiku: `claude-code/claude-haiku-5-5`; allowed efforts: low, medium, high; default: `medium`.
- Opus: `anthropic/claude-opus-5-5`; allowed efforts: low, medium, high; default: `medium`.

Sonnet, Claude Code Sonnet, Claude Code Opus, Claude Code Haiku, and Opus may be selected as model overrides only when explicitly requested by the user or active instructions. Do not select them on your own. This does not prevent inheriting the parent model when no override is requested.
<!-- agents:subagents:end -->
