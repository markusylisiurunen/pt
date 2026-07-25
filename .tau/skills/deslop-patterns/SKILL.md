---
name: "deslop-patterns"
description: "Apply PT-specific compatibility, contract ownership, and regression-risk guidance during deslop cleanup. Use only alongside the deslop skill in the PT repository. Trigger: explicit."
---

# PT deslop patterns

Use these patterns alongside `deslop`. Treat `AGENTS.md` as the source of truth for repository policy, architecture, conventions, and verification.

## Compatibility boundaries

The SQLite database and import/export documents contain real local user data. Preserve existing data, migration paths, and document compatibility; do not reset storage or remove old migration support merely to obtain a cleaner canonical shape. Before tightening optional persisted fields, decide how existing databases and imported documents will be handled. Unshipped internal contracts may be tightened when all callers are updated.

## Contract ownership

Apply the ownership boundaries in `AGENTS.md` when choosing the canonical representation and validation point:

- HTTP routes own validation and normalization of request input. Internal code should consume the resulting trusted shape.
- Database code owns schemas, persisted documents, and ordered migrations. Keep persistence changes explicit rather than hiding compatibility in downstream fallbacks.
- Shared domain entities should not drift into subtly different route, agent-tool, or frontend types. Use an explicit boundary transformation when representations genuinely differ.
- Agent tool contracts, persisted documents, and model prompts describe overlapping concepts and must move together when food, memory, or chat shapes change.
- React components should not become an alternative owner of backend domain truth.

## High-risk cleanup

- Preserve authentication and per-user runtime separation even though PT is a personal, single-user deployment.
- Trace food-log, weight-log, known-ingredient, memory, and document changes through storage, routes, tools, prompts, import, export, and UI consumers. These layers are common contract-drift surfaces.
- Treat AI provider responses, transcription, uploads, and Python execution as external or untrusted boundaries. Tighten their validation without moving provider-specific uncertainty into internal domain contracts.
- Keep the checked-in Fineli dataset unchanged during ordinary cleanup unless the target explicitly concerns its source data or generation.
- Preserve focused coverage for chat event flow, runtime isolation, persistence, migrations, and non-trivial parsing when it is the only protection for those regressions.
