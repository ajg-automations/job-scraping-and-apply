# claude.md — Job Search & Application Assistant (WAT)

A job search & application assistant for soon-to-graduate **PhDs** (industry + academic).
A user enters career criteria and qualifications in the frontend → a backend task runs
this project's workflow → ranked job postings come back (summary + direct apply link) →
the user can opt to apply, where the system **prefills** the application for them to
review and submit.

This file is the operating guide **I (the agent) read first every session.** It defines
how this repo is organized and how I am expected to do work in it.

---

## The WAT framework

Three layers. Keep them separate — that separation is the whole point.

- **W — Workflows (`workflows/`)** — plain-language markdown instructions. The *what*,
  the required inputs/outputs, *which* tools to use and *in what order*, and how to
  handle edge cases. Written like briefing a teammate.
- **A — Agent (me)** — the decision-maker. I read the relevant workflow, run the tools
  in sequence, handle failures gracefully, and ask clarifying questions when intent is
  unclear. I connect intent to execution; I do not do the work by hand.
- **T — Tools (`tools/`)** — deterministic scripts that do the actual work: API calls,
  data transforms, file ops. Consistent, testable, fast. All secrets come from `.env`.

**Cardinal rule:** business logic lives in **tools**, sequencing lives in **workflows**,
judgment lives in **me**. I never hand-code one-off business logic in chat — if a step
needs real work, it belongs in a tool.

---

## Folder map

```
claude.md          # this guide
.env               # real secrets — never committed, never echoed (git-ignored)
.env.example       # template listing required vars (committed)
workflows/         # Layer 1 — instruction docs
  README.md        # the workflow-file template (what every workflow must define)
  job-assistant.md # the workflow: two modes — "search" and "apply"
tools/             # Layer 3 — scripts & integrations
  README.md        # tool conventions (I/O contract, .env usage)
temp/              # Layer 2 working area — git-ignored, safe to wipe
  outputs/         # intermediate + final results
  resources/       # user resume, profile, fetched job data
```

---

## Operating rules for me (the agent)

1. **Read the relevant `workflows/*.md` before acting.** Do not improvise the sequence.
2. **Run tools in the order the workflow specifies.** On a tool failure, stop and report
   what failed and why — do not silently work around it.
3. **Write all working files under `temp/`** (`outputs/`, `resources/`). Never scatter
   intermediate files in the repo root.
4. **Ask, don't guess.** When the user's intent, criteria, or qualifications are
   ambiguous, ask a clarifying question rather than assuming.
5. **Never auto-submit an application.** Apply mode prefills only; a human reviews and
   submits (see Auto-submit policy).

---

## Secrets policy

- All API keys and credentials live in **`.env` only**, loaded by tools at runtime.
- **Never** echo, log, print, or commit a secret. `.env` is git-ignored.
- `.env.example` documents every required variable with a placeholder (no real values).
- If a tool needs a new credential, add it to `.env.example` and note it in the workflow.

---

## Architecture / tech stack

- **Runtime:** Node.js / TypeScript (matches both platforms below).
- **Backend — trigger.dev.** Each user action maps to a trigger.dev task that invokes
  this workflow. Search and apply are **two separate tasks** (they fire at different
  times) but share one workflow file.
- **Frontend — Vercel** (deployed from GitHub). User fills the form → frontend triggers
  the search task → renders postings with apply links. Clicking "apply" + uploading a
  resume triggers the apply task.
- **Frontend ↔ backend:** the trigger.dev SDK / a signed API endpoint. The frontend
  never holds backend secrets.
- **Data sources (prefer JSON APIs over HTML scraping):**
  - ATS public APIs — Greenhouse, Lever
  - Job aggregator APIs — Adzuna, USAJobs, JSearch
  - Academic boards — HigherEdJobs, AcademicJobsOnline
- **Auto-submit policy:** assisted prefill only. Tools prepare/prefill an application;
  the human reviews and clicks submit. No fully-autonomous submission.

---

## Tool contract (`tools/`)

Every tool is a standalone script that:

- takes a **documented input** — CLI args or JSON on **stdin**;
- returns a **documented output** — **JSON on stdout** (machine-readable);
- reads all config/secrets from **`.env`**;
- has **no side effects outside `temp/`** (or an explicitly documented external API call);
- is independently runnable and testable from the command line.

This keeps tools composable: a workflow is just "run tool A, feed its output to tool B."

---

## Workflow file template (`workflows/*.md`)

Every workflow must define:

1. **Objective** — what it accomplishes, in one or two sentences.
2. **Inputs** — required and optional, with shape/format.
3. **Tools (in order)** — which `tools/` scripts run, in what sequence, with what input.
4. **Expected output** — the shape of the final result.
5. **Edge cases / failure handling** — what to do when a tool fails or data is missing.

See `workflows/README.md` for the fillable template.

---

## The workflow — `workflows/job-assistant.md` (two modes)

- **search mode** — find (ATS / aggregator / academic APIs) → rank against the user's
  criteria & qualifications → summarize → return postings with direct apply links.
- **apply mode** — given one selected job + an uploaded resume → prefill that
  application for the user to review and submit (assisted; human confirms).

---

## Conventions

- **Language:** TypeScript for tools and the frontend.
- **Naming:** kebab-case for files (`fetch-greenhouse.ts`, `rank-postings.ts`).
- **Outputs land in `temp/outputs/`**; fetched/user data in `temp/resources/`.
- When adding a capability: write the **tool** first (testable in isolation), then wire
  it into the **workflow**, then expose it via the **frontend/trigger.dev task**.
