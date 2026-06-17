# job-assistant

One workflow, two modes. Search and apply run as **two separate trigger.dev tasks**
(they fire at different times from different frontend actions) but share these
instructions. Tools below are **planned** — not built yet.

---

## Mode: search

### Objective
Find job postings matching the user's criteria and qualifications, rank them by fit,
and return a summary with a direct apply link for each.

### Inputs
- `criteria` (required) — desired role, field, location, industry/academic, etc.
- `qualifications` (required) — degree, field, skills, publications, experience.
- `sources` (optional) — subset of {greenhouse, lever, adzuna, usajobs, jsearch,
  higheredjobs, academicjobsonline}; default = all configured.

### Tools (in order)
1. `tools/fetch-jobs` — query the selected data-source APIs → raw postings in
   `temp/resources/`.
2. `tools/normalize-postings` — unify raw postings into one schema.
3. `tools/rank-postings` — score each posting against `criteria` + `qualifications`.
4. `tools/summarize-postings` — write a brief per top posting + keep the apply link.

### Expected output
JSON in `temp/outputs/search-results.json`: ranked list of
`{ title, org, location, summary, fitScore, applyUrl }`, returned to the frontend.

### Edge cases / failure handling
- No matches → return an empty list with a note; do not error.
- A single source API fails → continue with the others; report which source was skipped.
- Missing required input → ask the user before running any tool.

---

## Mode: apply

### Objective
For one posting the user selected, prefill the application using their uploaded resume,
for the user to review and submit. **Never auto-submits.**

### Inputs
- `job` (required) — one posting object from search results (incl. `applyUrl`).
- `resume` (required) — uploaded resume file in `temp/resources/`.
- `profile` (optional) — extra applicant fields (contact info, etc.).

### Tools (in order)
1. `tools/parse-resume` — extract structured fields from the resume.
2. `tools/prefill-application` — map fields onto the application; produce a prefilled
   draft + the apply link for human review.

### Expected output
JSON in `temp/outputs/prefilled-application.json`: the prefilled fields, any fields that
still need the user, and the `applyUrl` — surfaced in the frontend for review & submit.

### Edge cases / failure handling
- Resume unparseable → ask the user to re-upload or enter fields manually.
- Application requires login/CAPTCHA/unsupported ATS → return the apply link and tell the
  user to finish manually; do not attempt to bypass.
- On any tool failure → stop and report; never submit on the user's behalf.
