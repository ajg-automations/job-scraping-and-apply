# tools/ — Layer 3 (Execution)

Deterministic scripts that do the real work: API calls, data transforms, file ops.
Consistent, testable, fast. The agent runs these in the order a workflow specifies.

## Tool contract

Every tool:

- takes a **documented input** — CLI args or JSON on **stdin**;
- returns a **documented output** — **JSON on stdout** (machine-readable);
- reads all config/secrets from **`../.env`** (never hardcoded);
- has **no side effects outside `../temp/`** (except documented external API calls);
- is independently runnable and testable from the command line.

This keeps tools composable: a workflow is "run tool A, feed its output to tool B."

## Conventions

- TypeScript, kebab-case filenames (e.g. `fetch-jobs.ts`, `rank-postings.ts`).
- Fetched/user data → `../temp/resources/`; results → `../temp/outputs/`.
- Document each tool's input/output shape at the top of its file.

## Planned tools (not built yet)

| Tool | Purpose |
|------|---------|
| `fetch-jobs` | Query data-source APIs (Greenhouse, Lever, Adzuna, USAJobs, JSearch, academic boards). |
| `normalize-postings` | Unify raw postings into one schema. |
| `rank-postings` | Score postings against the user's criteria + qualifications. |
| `summarize-postings` | Write a brief per posting, keep the apply link. |
| `parse-resume` | Extract structured fields from an uploaded resume. |
| `prefill-application` | Map fields onto an application for human review (no submit). |
