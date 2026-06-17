# Design: Job Assistant — Search Slice (Monorepo + trigger.dev + tools)

**Date:** 2026-06-17
**Status:** Approved (design); implementation plan to follow.

## Context / purpose

The project is a WAT-framework job search & application assistant for soon-to-graduate
PhDs (industry + academic). The WAT scaffolding and `claude.md` operating guide already
exist. This design covers the **first vertical slice**: a working **search** path —
fetch postings from Greenhouse + Adzuna, normalize them, and return them through a single
trigger.dev task — plus the monorepo and trigger.dev project setup that makes it deliverable.

It exists to prove the end-to-end shape (frontend → trigger.dev task → tools → result)
before investing in ranking, summarization, the apply mode, or more data sources.

## Goals (this slice)

- Monorepo (one GitHub repo, pnpm workspaces) housing tools, shared types, trigger.dev
  tasks, and a Next.js frontend stub.
- `fetch-jobs` tool with Greenhouse (no key) + Adzuna (key) adapters.
- `normalize-postings` tool unifying both into one `JobPosting` schema.
- One trigger.dev task (`search-jobs`) that orchestrates the two tools.
- A Next.js frontend stub that triggers the task and renders results.
- trigger.dev project wired up; documented steps for the user to create the project + log in.

## Non-goals (deferred)

Ranking, summarization, apply mode, resume parsing/prefill, additional data sources
(USAJOBS, JSearch, academic boards), and the full frontend UI. These are later slices.

## Architecture decision: tools ↔ trigger.dev tasks (Option A)

Tools are **pure TypeScript functions** in `packages/tools`, each also exposed through a
thin CLI wrapper for standalone runs. trigger.dev tasks **import and orchestrate** these
functions; they do not contain business logic.

- Keeps the WAT separation: logic in tools, sequencing in the task (which follows
  `workflows/job-assistant.md`), judgment in the agent.
- Tools are unit-testable with no trigger.dev runtime; the CLI wrapper satisfies the
  Layer-3 stdin/stdout contract from `claude.md`.
- Rejected: shelling out to CLI scripts from tasks (fragile in serverless); putting logic
  directly in tasks (breaks testability + WAT separation).

## Monorepo layout

```
package.json                 # workspace root (pnpm)
pnpm-workspace.yaml
tsconfig.base.json
packages/
  shared/                    # shared TS types
    src/index.ts             # JobPosting, SearchInput, FetchResult, SourceName
  tools/                     # Layer 3
    src/fetch-jobs/
      index.ts               # fetchJobs(input) → orchestrates adapters
      greenhouse.ts          # Greenhouse adapter (no key)
      adzuna.ts              # Adzuna adapter (key from env)
    src/normalize-postings/
      index.ts               # normalizePostings(raw) → JobPosting[]
    src/cli.ts               # `pnpm tool <name> '<json>'` runner (stdin/stdout)
trigger/
  trigger.config.ts
  src/trigger/search-jobs.ts # search-mode task: fetch → normalize → return
apps/web/                    # Next.js (Vercel) — stub
  app/page.tsx               # form → triggers task → renders results
workflows/  tools/(docs)  temp/  claude.md  .env.example   # already exist
```

## Data model (`packages/shared`)

- `SourceName = "greenhouse" | "adzuna"`
- `SearchInput { query: string; location?: string; sources?: SourceName[]; greenhouseBoards?: string[] }`
- `RawPosting { source: SourceName; raw: unknown }` (adapter output, pre-normalize)
- `JobPosting { id; source; title; org; location?; summary?; applyUrl; postedAt? }`
- `FetchResult { postings: JobPosting[]; skippedSources: { source; reason }[] }`

## Data flow (search slice)

1. Next.js form submits `SearchInput`.
2. Frontend triggers the `search-jobs` trigger.dev task (via trigger.dev SDK).
3. Task calls `fetchJobs(input)` → runs Greenhouse + Adzuna adapters in parallel.
4. Task calls `normalizePostings(raw)` → `JobPosting[]`.
5. Task returns `FetchResult`; frontend renders postings + apply links.

## Error handling

- Each source adapter is isolated. If one fails (network error, bad board token), it is
  added to `skippedSources` and the search returns the other source's results.
- Missing `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` → Adzuna is skipped with a clear reason; the
  Greenhouse path still returns. Never throw the whole search away for one source.
- Adapter inputs validated (zod) at the tool boundary; invalid `SearchInput` → typed error
  surfaced to the frontend, not a crash.

## Secrets / config

- All keys in `.env` (local) and the trigger.dev dashboard (deployed). `.env` git-ignored.
- New vars this slice: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (already in `.env.example`),
  `TRIGGER_PROJECT_ID`/ref. Greenhouse needs none.
- Frontend never holds backend secrets; it triggers via a trigger.dev public/SDK token.

## Testing

- **Unit:** vitest for `greenhouse.ts`, `adzuna.ts`, `normalize-postings` with mocked
  HTTP (fixtures of real API responses). Cover success, source failure, missing key.
- **CLI smoke:** `pnpm tool fetch-jobs '{"query":"data scientist","sources":["greenhouse"],"greenhouseBoards":["<co>"]}'`
  hits live Greenhouse (no key) and prints JSON.
- **Task:** run `pnpm dlx trigger.dev@latest dev` locally and invoke `search-jobs` from the
  trigger.dev dashboard test UI; confirm `FetchResult` shape.
- **Frontend:** manual — submit the form, see results render.

## Toolchain / setup (verified locally)

- Node v22.20, npm 11.9, pnpm 11.7 available. Not yet a git repo.
- trigger.dev: user has an account, **no project yet**. Plan provides exact steps to
  create the project, log in via CLI (`npx trigger.dev@latest login` — interactive, user
  runs it), and capture the project ref into `trigger.config.ts` + `.env`.
- GitHub: `git init` here → push to one repo → connect Vercel (frontend) + trigger.dev.

## Build order (high level)

1. Workspace root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `git init`.
2. `packages/shared` types.
3. `packages/tools/fetch-jobs` (Greenhouse + Adzuna) + CLI wrapper + unit tests.
4. `packages/tools/normalize-postings` + unit tests.
5. `trigger/` config + `search-jobs` task wiring the tools.
6. `apps/web` Next.js stub triggering the task.
7. Setup docs for trigger.dev project + GitHub + Vercel.

## Verification (definition of done)

- `pnpm install` + `pnpm -r build` succeed.
- `pnpm -r test` green (tool unit tests).
- CLI smoke against live Greenhouse returns real postings.
- `trigger.dev dev` runs; `search-jobs` returns a valid `FetchResult` from the dashboard.
- Frontend stub triggers the task and renders results locally.
- `.env` not tracked by git; only `.env.example` committed.
