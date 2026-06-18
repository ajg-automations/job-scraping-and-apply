# Job Assistant — Search Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working search path — fetch postings from Greenhouse + Adzuna, normalize them to one schema, return them through a single trigger.dev task, and render them in a Next.js frontend stub.

**Architecture:** pnpm monorepo. Tools are pure TypeScript functions in `packages/tools` (Option A): each is unit-testable and exposed through a thin CLI wrapper. A trigger.dev task orchestrates the tools (fetch → normalize). A Next.js app on Vercel triggers the task and renders results. Shared types live in `packages/shared`.

**Tech Stack:** TypeScript, pnpm workspaces, Node 22, zod (validation), vitest (tests), trigger.dev v4 SDK, Next.js (App Router). Native `fetch` (no HTTP client dependency).

## Global Constraints

- Node >= 22; pnpm as the package manager (workspaces).
- All secrets come from `.env` / dashboard env vars only — never hardcoded, never committed. `.env` is git-ignored; only `.env.example` is committed.
- Workspace package names: `@job/shared`, `@job/tools`. Frontend is `web`; trigger project dir is `trigger/`.
- Tools are pure functions; no trigger.dev or Next.js imports inside `packages/tools`.
- HTTP is injected (`deps.fetch`) so adapters are testable without network. Default is `globalThis.fetch`.
- Greenhouse requires no key. Adzuna requires `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`; if absent, Adzuna is skipped (never crashes the search).
- Job ids are namespaced: `"greenhouse:<id>"`, `"adzuna:<id>"`.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.

---

### Task 1: Workspace root scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `.gitignore` (already ignores node_modules/dist — verify only)

**Interfaces:**
- Produces: a pnpm workspace where `pnpm install` succeeds and `@job/*` packages resolve.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "trigger"
  - "apps/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "job-assistant",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@11.7.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "tool": "pnpm --filter @job/tools tool"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Install and verify**

Run: `pnpm install`
Expected: completes without error; creates `pnpm-lock.yaml` and `node_modules/`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo root"
```

---

### Task 2: Shared types (`@job/shared`)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `SourceName`, `SearchInput`, `RawPosting`, `JobPosting`, `SkippedSource`, `FetchRawResult`, `FetchResult` — imported by `@job/tools` and the trigger task.

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@job/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "echo \"no tests\" && exit 0"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/index.ts`**

```typescript
export type SourceName = "greenhouse" | "adzuna";

export interface SearchInput {
  query: string;
  location?: string;
  sources?: SourceName[];
  /** Greenhouse board tokens (company slugs) to query. */
  greenhouseBoards?: string[];
}

/** A posting as returned by a source adapter, before normalization. */
export interface RawPosting {
  source: SourceName;
  raw: unknown;
}

/** A unified posting after normalization. */
export interface JobPosting {
  id: string;
  source: SourceName;
  title: string;
  org: string;
  location?: string;
  summary?: string;
  applyUrl: string;
  postedAt?: string;
}

export interface SkippedSource {
  source: SourceName;
  reason: string;
}

/** Output of fetchJobs: raw postings plus any sources that were skipped. */
export interface FetchRawResult {
  raw: RawPosting[];
  skippedSources: SkippedSource[];
}

/** Final search output returned to the frontend. */
export interface FetchResult {
  postings: JobPosting[];
  skippedSources: SkippedSource[];
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @job/shared typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add core job-posting types"
```

---

### Task 3: `@job/tools` package skeleton + Greenhouse adapter

**Files:**
- Create: `packages/tools/package.json`
- Create: `packages/tools/tsconfig.json`
- Create: `packages/tools/vitest.config.ts`
- Create: `packages/tools/src/fetch-jobs/greenhouse.ts`
- Test: `packages/tools/src/fetch-jobs/greenhouse.test.ts`

**Interfaces:**
- Consumes: `SearchInput`, `RawPosting` from `@job/shared`.
- Produces: `type FetchFn = typeof fetch`; `fetchGreenhouse(input: SearchInput, deps?: { fetch?: FetchFn }): Promise<RawPosting[]>`. Each `RawPosting.raw` is the Greenhouse job object augmented with `_org: string` (the board token).

- [ ] **Step 1: Create `packages/tools/package.json`**

```json
{
  "name": "@job/tools",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "tool": "node --experimental-strip-types src/cli.ts"
  },
  "dependencies": {
    "@job/shared": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/tools/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/tools/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Install new deps**

Run: `pnpm install`
Expected: installs zod + vitest; `@job/shared` linked via workspace.

- [ ] **Step 5: Write the failing test** — `packages/tools/src/fetch-jobs/greenhouse.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { fetchGreenhouse } from "./greenhouse";

function mockFetch(body: unknown, ok = true) {
  return async () =>
    ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
}

describe("fetchGreenhouse", () => {
  it("returns postings whose title matches the query, tagged with the board", async () => {
    const fetch = mockFetch({
      jobs: [
        { id: 1, title: "Data Scientist", absolute_url: "https://x/1", location: { name: "Remote" }, updated_at: "2026-01-01" },
        { id: 2, title: "Barista", absolute_url: "https://x/2", location: { name: "NYC" }, updated_at: "2026-01-02" },
      ],
    });
    const result = await fetchGreenhouse(
      { query: "data", greenhouseBoards: ["acme"] },
      { fetch },
    );
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("greenhouse");
    expect((result[0].raw as any).title).toBe("Data Scientist");
    expect((result[0].raw as any)._org).toBe("acme");
  });

  it("throws when no boards are configured", async () => {
    await expect(
      fetchGreenhouse({ query: "data" }, { fetch: mockFetch({}) }),
    ).rejects.toThrow(/board/i);
  });

  it("throws when the API responds non-ok", async () => {
    await expect(
      fetchGreenhouse({ query: "data", greenhouseBoards: ["acme"] }, { fetch: mockFetch({}, false) }),
    ).rejects.toThrow(/greenhouse/i);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @job/tools test`
Expected: FAIL — cannot find module `./greenhouse`.

- [ ] **Step 7: Implement** — `packages/tools/src/fetch-jobs/greenhouse.ts`

```typescript
import type { RawPosting, SearchInput } from "@job/shared";

export type FetchFn = typeof fetch;

export async function fetchGreenhouse(
  input: SearchInput,
  deps: { fetch?: FetchFn } = {},
): Promise<RawPosting[]> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const boards = input.greenhouseBoards ?? [];
  if (boards.length === 0) {
    throw new Error("No Greenhouse boards configured (greenhouseBoards is empty)");
  }
  const q = input.query.toLowerCase();
  const postings: RawPosting[] = [];

  for (const board of boards) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Greenhouse request failed for board "${board}" (status ${res.status})`);
    }
    const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
    for (const job of data.jobs ?? []) {
      const title = String(job.title ?? "");
      if (!q || title.toLowerCase().includes(q)) {
        postings.push({ source: "greenhouse", raw: { ...job, _org: board } });
      }
    }
  }
  return postings;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @job/tools test`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/tools
git commit -m "feat(tools): add Greenhouse fetch adapter"
```

---

### Task 4: Adzuna adapter

**Files:**
- Create: `packages/tools/src/fetch-jobs/adzuna.ts`
- Test: `packages/tools/src/fetch-jobs/adzuna.test.ts`

**Interfaces:**
- Consumes: `SearchInput`, `RawPosting` from `@job/shared`; `FetchFn` imported from `./greenhouse`.
- Produces: `fetchAdzuna(input: SearchInput, deps?: { fetch?: FetchFn }): Promise<RawPosting[]>`. Reads `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` from `process.env`; throws if missing.

- [ ] **Step 1: Write the failing test** — `packages/tools/src/fetch-jobs/adzuna.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fetchAdzuna } from "./adzuna";

function mockFetch(body: unknown, ok = true) {
  return async () =>
    ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
}

describe("fetchAdzuna", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
  });
  afterEach(() => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
  });

  it("returns the results array as raw postings", async () => {
    const fetch = mockFetch({
      results: [
        { id: "9", title: "ML Engineer", redirect_url: "https://a/9", company: { display_name: "Acme" }, location: { display_name: "Remote" }, created: "2026-01-01", description: "..." },
      ],
    });
    const result = await fetchAdzuna({ query: "ml" }, { fetch });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("adzuna");
    expect((result[0].raw as any).id).toBe("9");
  });

  it("throws when credentials are missing", async () => {
    delete process.env.ADZUNA_APP_ID;
    await expect(
      fetchAdzuna({ query: "ml" }, { fetch: mockFetch({}) }),
    ).rejects.toThrow(/adzuna credentials/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @job/tools test adzuna`
Expected: FAIL — cannot find module `./adzuna`.

- [ ] **Step 3: Implement** — `packages/tools/src/fetch-jobs/adzuna.ts`

```typescript
import type { RawPosting, SearchInput } from "@job/shared";
import type { FetchFn } from "./greenhouse";

export async function fetchAdzuna(
  input: SearchInput,
  deps: { fetch?: FetchFn } = {},
): Promise<RawPosting[]> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna credentials missing (set ADZUNA_APP_ID and ADZUNA_APP_KEY)");
  }
  const country = "us";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: input.query,
    results_per_page: "20",
  });
  if (input.location) params.set("where", input.location);

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Adzuna request failed (status ${res.status})`);
  }
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).map((r) => ({ source: "adzuna" as const, raw: r }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @job/tools test`
Expected: PASS (all tests, including Task 3's).

- [ ] **Step 5: Commit**

```bash
git add packages/tools/src/fetch-jobs/adzuna.ts packages/tools/src/fetch-jobs/adzuna.test.ts
git commit -m "feat(tools): add Adzuna fetch adapter"
```

---

### Task 5: `fetch-jobs` orchestrator

**Files:**
- Create: `packages/tools/src/fetch-jobs/index.ts`
- Test: `packages/tools/src/fetch-jobs/index.test.ts`

**Interfaces:**
- Consumes: `fetchGreenhouse`, `fetchAdzuna`, `FetchFn`; `SearchInput`, `FetchRawResult` from `@job/shared`.
- Produces: `fetchJobs(input: SearchInput, deps?: { fetch?: FetchFn }): Promise<FetchRawResult>`. Runs the requested sources (default both), isolating per-source failures into `skippedSources`.

- [ ] **Step 1: Write the failing test** — `packages/tools/src/fetch-jobs/index.test.ts`

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { fetchJobs } from "./index";

function mockFetch(byUrl: (url: string) => { ok: boolean; body: unknown }) {
  return (async (url: string) => {
    const { ok, body } = byUrl(String(url));
    return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
  }) as typeof fetch;
}

afterEach(() => {
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
});

describe("fetchJobs", () => {
  it("collects postings from both sources and reports none skipped", async () => {
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
    const fetch = mockFetch((url) =>
      url.includes("greenhouse")
        ? { ok: true, body: { jobs: [{ id: 1, title: "Data Scientist", absolute_url: "u" }] } }
        : { ok: true, body: { results: [{ id: "9", title: "ML Engineer", redirect_url: "u" }] } },
    );
    const result = await fetchJobs(
      { query: "data", sources: ["greenhouse", "adzuna"], greenhouseBoards: ["acme"] },
      { fetch },
    );
    expect(result.raw).toHaveLength(2);
    expect(result.skippedSources).toHaveLength(0);
  });

  it("skips Adzuna (with a reason) when credentials are missing, still returns Greenhouse", async () => {
    const fetch = mockFetch(() => ({ ok: true, body: { jobs: [{ id: 1, title: "Data Scientist", absolute_url: "u" }] } }));
    const result = await fetchJobs(
      { query: "data", sources: ["greenhouse", "adzuna"], greenhouseBoards: ["acme"] },
      { fetch },
    );
    expect(result.raw).toHaveLength(1);
    expect(result.skippedSources).toEqual([
      { source: "adzuna", reason: expect.stringMatching(/credentials/i) },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @job/tools test index`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Implement** — `packages/tools/src/fetch-jobs/index.ts`

```typescript
import type { FetchRawResult, RawPosting, SearchInput, SkippedSource } from "@job/shared";
import { fetchGreenhouse, type FetchFn } from "./greenhouse";
import { fetchAdzuna } from "./adzuna";

export async function fetchJobs(
  input: SearchInput,
  deps: { fetch?: FetchFn } = {},
): Promise<FetchRawResult> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const sources = input.sources ?? ["greenhouse", "adzuna"];
  const raw: RawPosting[] = [];
  const skippedSources: SkippedSource[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        if (source === "greenhouse") {
          raw.push(...(await fetchGreenhouse(input, { fetch: fetchImpl })));
        } else if (source === "adzuna") {
          raw.push(...(await fetchAdzuna(input, { fetch: fetchImpl })));
        }
      } catch (err) {
        skippedSources.push({
          source,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  return { raw, skippedSources };
}

export { fetchGreenhouse, fetchAdzuna };
export type { FetchFn };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @job/tools test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tools/src/fetch-jobs/index.ts packages/tools/src/fetch-jobs/index.test.ts
git commit -m "feat(tools): add fetch-jobs orchestrator with per-source isolation"
```

---

### Task 6: `normalize-postings` tool

**Files:**
- Create: `packages/tools/src/normalize-postings/index.ts`
- Test: `packages/tools/src/normalize-postings/index.test.ts`

**Interfaces:**
- Consumes: `RawPosting`, `JobPosting` from `@job/shared`.
- Produces: `normalizePostings(raw: RawPosting[]): JobPosting[]`. Maps Greenhouse and Adzuna raw shapes to the unified `JobPosting`. Ids namespaced `greenhouse:<id>` / `adzuna:<id>`.

- [ ] **Step 1: Write the failing test** — `packages/tools/src/normalize-postings/index.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { normalizePostings } from "./index";

describe("normalizePostings", () => {
  it("normalizes a Greenhouse raw posting", () => {
    const out = normalizePostings([
      {
        source: "greenhouse",
        raw: { id: 1, title: "Data Scientist", absolute_url: "https://x/1", location: { name: "Remote" }, updated_at: "2026-01-01", _org: "acme" },
      },
    ]);
    expect(out[0]).toEqual({
      id: "greenhouse:1",
      source: "greenhouse",
      title: "Data Scientist",
      org: "acme",
      location: "Remote",
      applyUrl: "https://x/1",
      postedAt: "2026-01-01",
    });
  });

  it("normalizes an Adzuna raw posting", () => {
    const out = normalizePostings([
      {
        source: "adzuna",
        raw: { id: "9", title: "ML Engineer", redirect_url: "https://a/9", company: { display_name: "Acme" }, location: { display_name: "NYC" }, created: "2026-01-02", description: "do ml" },
      },
    ]);
    expect(out[0]).toEqual({
      id: "adzuna:9",
      source: "adzuna",
      title: "ML Engineer",
      org: "Acme",
      location: "NYC",
      summary: "do ml",
      applyUrl: "https://a/9",
      postedAt: "2026-01-02",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @job/tools test normalize`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Implement** — `packages/tools/src/normalize-postings/index.ts`

```typescript
import type { JobPosting, RawPosting } from "@job/shared";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function normalizeGreenhouse(raw: Record<string, any>): JobPosting {
  return {
    id: `greenhouse:${raw.id}`,
    source: "greenhouse",
    title: String(raw.title ?? ""),
    org: str(raw._org) ?? "Unknown",
    location: str(raw.location?.name),
    applyUrl: String(raw.absolute_url ?? ""),
    postedAt: str(raw.updated_at),
  };
}

function normalizeAdzuna(raw: Record<string, any>): JobPosting {
  return {
    id: `adzuna:${raw.id}`,
    source: "adzuna",
    title: String(raw.title ?? ""),
    org: str(raw.company?.display_name) ?? "Unknown",
    location: str(raw.location?.display_name),
    summary: str(raw.description),
    applyUrl: String(raw.redirect_url ?? ""),
    postedAt: str(raw.created),
  };
}

export function normalizePostings(raw: RawPosting[]): JobPosting[] {
  return raw.map((p) =>
    p.source === "greenhouse"
      ? normalizeGreenhouse(p.raw as Record<string, any>)
      : normalizeAdzuna(p.raw as Record<string, any>),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @job/tools test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tools/src/normalize-postings
git commit -m "feat(tools): add normalize-postings tool"
```

---

### Task 7: Tools barrel + CLI runner + live smoke test

**Files:**
- Create: `packages/tools/src/index.ts`
- Create: `packages/tools/src/cli.ts`

**Interfaces:**
- Consumes: `fetchJobs`, `normalizePostings`.
- Produces: `packages/tools/src/index.ts` re-exporting `fetchJobs`, `normalizePostings`, types. A CLI: `pnpm tool <fetch-jobs|normalize-postings|search> '<json>'` printing JSON to stdout.

- [ ] **Step 1: Create the barrel** — `packages/tools/src/index.ts`

```typescript
export { fetchJobs, fetchGreenhouse, fetchAdzuna } from "./fetch-jobs/index";
export type { FetchFn } from "./fetch-jobs/index";
export { normalizePostings } from "./normalize-postings/index";
```

- [ ] **Step 2: Create the CLI** — `packages/tools/src/cli.ts`

```typescript
import type { FetchResult, SearchInput } from "@job/shared";
import { fetchJobs } from "./fetch-jobs/index";
import { normalizePostings } from "./normalize-postings/index";

async function main() {
  const [, , command, json] = process.argv;
  if (!command || !json) {
    console.error('Usage: pnpm tool <fetch-jobs|normalize-postings|search> \'<json>\'');
    process.exit(1);
  }
  const input = JSON.parse(json);

  if (command === "fetch-jobs") {
    const result = await fetchJobs(input as SearchInput);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "normalize-postings") {
    console.log(JSON.stringify(normalizePostings(input), null, 2));
  } else if (command === "search") {
    const { raw, skippedSources } = await fetchJobs(input as SearchInput);
    const result: FetchResult = { postings: normalizePostings(raw), skippedSources };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Live smoke test against Greenhouse (no key needed)**

Run (use a real public board token, e.g. a company on Greenhouse such as `stripe`):
```bash
pnpm tool search '{"query":"engineer","sources":["greenhouse"],"greenhouseBoards":["stripe"]}'
```
Expected: prints a JSON `FetchResult` with a non-empty `postings` array (each with `title`, `org: "stripe"`, `applyUrl`) and `skippedSources: []`. If the board token is invalid, you'll instead see it under `skippedSources` — try another known board.

- [ ] **Step 4: Typecheck + full test run**

Run: `pnpm --filter @job/tools typecheck && pnpm --filter @job/tools test`
Expected: no type errors; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tools/src/index.ts packages/tools/src/cli.ts
git commit -m "feat(tools): add barrel exports and CLI runner"
```

---

### Task 8: trigger.dev project + `search-jobs` task

**Files:**
- Create: `trigger/package.json`
- Create: `trigger/trigger.config.ts`
- Create: `trigger/src/trigger/search-jobs.ts`
- Modify: `.env` (local, untracked) — add `TRIGGER_*` + Adzuna keys

**Interfaces:**
- Consumes: `fetchJobs`, `normalizePostings` from `@job/tools`; `SearchInput`, `FetchResult` from `@job/shared`.
- Produces: a trigger.dev task with id `"search-jobs"` taking `SearchInput`, returning `FetchResult`.

> **Manual steps (you run these — interactive login):** This task has shell steps the agent cannot do for you because they require your trigger.dev account.

- [ ] **Step 1: Create `trigger/package.json`**

```json
{
  "name": "@job/trigger",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "trigger.dev dev",
    "deploy": "trigger.dev deploy",
    "typecheck": "tsc --noEmit",
    "test": "echo \"no tests\" && exit 0",
    "build": "echo \"built by trigger.dev\" && exit 0"
  },
  "dependencies": {
    "@job/shared": "workspace:*",
    "@job/tools": "workspace:*",
    "@trigger.dev/sdk": "^4.0.0"
  },
  "devDependencies": {
    "trigger.dev": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: installs `@trigger.dev/sdk` + `trigger.dev` CLI into the workspace.

- [ ] **Step 3: (MANUAL) Log in, create the project, and init config**

Run yourself (opens a browser):
```bash
cd trigger
pnpm exec trigger.dev login
```
Create a project in the trigger.dev dashboard (https://cloud.trigger.dev) named e.g.
`job-assistant`; copy its **project ref** (`proj_xxxxxxxx`). Then scaffold config:
```bash
pnpm exec trigger.dev init
```
This generates `trigger.config.ts` (and an example task) **using the exact import paths
for your installed SDK version** — important, because v4 and v3 differ (`@trigger.dev/sdk`
vs `@trigger.dev/sdk/v3`). Use whatever import the generated example uses in the next step.

- [ ] **Step 4: Edit the generated `trigger/trigger.config.ts`**

Ensure it points at your ref and our task dir (keep the generated import line as-is):
```typescript
// import line as generated by `trigger.dev init` (do not change it)
export default defineConfig({
  project: "proj_REPLACE_WITH_YOUR_REF",
  dirs: ["./src/trigger"],
  maxDuration: 120,
});
```

- [ ] **Step 5: Create the task** — `trigger/src/trigger/search-jobs.ts`

Use the **same `task` import path** the generated example task uses (`@trigger.dev/sdk/v3`
on v3, `@trigger.dev/sdk` on v4 — copy it from the example file `init` created):

```typescript
import { task } from "@trigger.dev/sdk/v3"; // ← match the generated example's import
import type { FetchResult, SearchInput } from "@job/shared";
import { fetchJobs, normalizePostings } from "@job/tools";

export const searchJobs = task({
  id: "search-jobs",
  run: async (payload: SearchInput): Promise<FetchResult> => {
    const { raw, skippedSources } = await fetchJobs(payload);
    return { postings: normalizePostings(raw), skippedSources };
  },
});
```

You can delete the example task `init` generated once `search-jobs` works.

- [ ] **Step 6: Add local env vars** — append to `.env` (create from `.env.example` if absent; never commit `.env`)

```
ADZUNA_APP_ID=your_id_or_leave_blank
ADZUNA_APP_KEY=your_key_or_leave_blank
TRIGGER_PROJECT_ID=proj_REPLACE_WITH_YOUR_REF
```

- [ ] **Step 7: (MANUAL) Run the dev server and test the task**

Run yourself:
```bash
pnpm --filter @job/trigger dev
```
In the trigger.dev dashboard → your project → `search-jobs` → Test, submit:
```json
{ "query": "engineer", "sources": ["greenhouse"], "greenhouseBoards": ["stripe"] }
```
Expected: run succeeds; output is a `FetchResult` with a non-empty `postings` array.

- [ ] **Step 8: Commit (config + task only — not `.env`)**

```bash
git add trigger/package.json trigger/trigger.config.ts trigger/src/trigger/search-jobs.ts pnpm-lock.yaml
git commit -m "feat(trigger): add search-jobs task and trigger.dev config"
```

---

### Task 9: Next.js frontend stub

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/api/search/route.ts`

**Interfaces:**
- Consumes: the `search-jobs` task (triggered by id via `@trigger.dev/sdk`); `JobPosting`, `SearchInput`, `FetchResult` from `@job/shared`.
- Produces: a page with a search form that POSTs to `/api/search`, which triggers the task and returns its result for rendering.

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "echo \"no tests\" && exit 0"
  },
  "dependencies": {
    "@job/shared": "workspace:*",
    "@trigger.dev/sdk": "^4.0.0",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/react": "^18.3.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = { transpilePackages: ["@job/shared"] };
export default nextConfig;
```

- [ ] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["app", "next-env.d.ts"]
}
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: installs Next.js + React into `apps/web`.

- [ ] **Step 5: Create `apps/web/app/layout.tsx`**

```tsx
export const metadata = { title: "Job Assistant" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create the API route** — `apps/web/app/api/search/route.ts`

> Import note: use the same `@trigger.dev/sdk` path family your installed SDK uses (the one
> the `init`-generated task imports from). The `tasks` helper lives in the same package.

```typescript
import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3"; // ← match your installed SDK's import path
import type { FetchResult, SearchInput } from "@job/shared";

export async function POST(request: Request) {
  const input = (await request.json()) as SearchInput;
  // Triggers the task and waits for its result. Requires TRIGGER_SECRET_KEY in env.
  const handle = await tasks.triggerAndPoll<{ payload: SearchInput; output: FetchResult }>(
    "search-jobs",
    input,
  );
  if (handle.status !== "COMPLETED" || !handle.output) {
    return NextResponse.json({ error: `task ${handle.status}` }, { status: 502 });
  }
  return NextResponse.json(handle.output);
}
```

- [ ] **Step 7: Create the page** — `apps/web/app/page.tsx`

```tsx
"use client";
import { useState } from "react";
import type { FetchResult } from "@job/shared";

export default function Home() {
  const [query, setQuery] = useState("engineer");
  const [boards, setBoards] = useState("stripe");
  const [result, setResult] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        sources: ["greenhouse"],
        greenhouseBoards: boards.split(",").map((b) => b.trim()).filter(Boolean),
      }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Job Assistant — Search</h1>
      <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="query" />
        <input value={boards} onChange={(e) => setBoards(e.target.value)} placeholder="greenhouse boards (comma-sep)" />
        <button type="submit" disabled={loading}>{loading ? "Searching…" : "Find"}</button>
      </form>
      {result && (
        <>
          {result.skippedSources.length > 0 && (
            <p style={{ color: "#a60" }}>
              Skipped: {result.skippedSources.map((s) => `${s.source} (${s.reason})`).join(", ")}
            </p>
          )}
          <ul>
            {result.postings.map((p) => (
              <li key={p.id} style={{ marginBottom: 12 }}>
                <a href={p.applyUrl} target="_blank" rel="noreferrer"><strong>{p.title}</strong></a>
                {" — "}{p.org}{p.location ? ` · ${p.location}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 8: (MANUAL) Run locally and verify**

Ensure `.env` has `TRIGGER_SECRET_KEY` (from the trigger.dev dashboard → API keys), then with the trigger dev server running (Task 8 Step 7), in another terminal:
```bash
pnpm --filter web dev
```
Open http://localhost:3000, submit the form. Expected: postings render with apply links.

- [ ] **Step 9: Typecheck + commit**

Run: `pnpm --filter web typecheck`
Expected: no errors.

```bash
git add apps/web
git commit -m "feat(web): add Next.js search stub triggering search-jobs"
```

---

### Task 10: Deployment wiring docs (GitHub + Vercel + trigger.dev)

**Files:**
- Create: `docs/setup/deployment.md`
- Modify: `.env.example` (add `TRIGGER_SECRET_KEY` if not present — verify)

**Interfaces:**
- Produces: a checklist the user follows to push to GitHub and connect both deploy targets. No runtime code.

- [ ] **Step 1: Verify `.env.example` has the needed keys**

Confirm it lists `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID`. Add any missing (placeholders only).

- [ ] **Step 2: Create `docs/setup/deployment.md`**

````markdown
# Deployment

## 1. Push to GitHub
```bash
git remote add origin git@github.com:<you>/job-assistant.git
git push -u origin main
```

## 2. trigger.dev (backend)
- Dashboard → your project → API keys: copy the **secret key** (`tr_...`).
- Deploy tasks: `pnpm --filter @job/trigger deploy`
- Set production env vars in the trigger.dev dashboard: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`.

## 3. Vercel (frontend)
- Import the GitHub repo in Vercel.
- Root directory: `apps/web`.
- Environment variables: `TRIGGER_SECRET_KEY` (the `tr_...` key) — so the API route can trigger tasks.
- Deploy. Every push to `main` redeploys.

## Secrets never go in git
Only `.env.example` is committed. Real values live in `.env` (local), the trigger.dev
dashboard, and the Vercel dashboard.
````

- [ ] **Step 3: Commit**

```bash
git add docs/setup/deployment.md .env.example
git commit -m "docs: add deployment wiring for GitHub, Vercel, trigger.dev"
```

---

## Verification (definition of done)

- `pnpm install` succeeds; `pnpm -r typecheck` and `pnpm -r test` are green.
- `pnpm tool search '{"query":"engineer","sources":["greenhouse"],"greenhouseBoards":["stripe"]}'` prints real postings.
- `pnpm --filter @job/trigger dev` runs; `search-jobs` returns a valid `FetchResult` from the dashboard test UI.
- Frontend at localhost:3000 triggers the task and renders postings with apply links.
- `git ls-files | grep -E '^\.env$'` returns nothing (only `.env.example` tracked).

## Notes on deferred work (next slices)

Ranking, summarization, the apply mode (resume parse + prefill), additional data sources
(USAJOBS, JSearch, academic boards), and the full frontend UI are intentionally out of
scope here. Each is its own spec → plan → implementation cycle.
