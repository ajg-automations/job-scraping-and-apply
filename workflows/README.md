# workflows/ — Layer 1 (Instructions)

Each file here is a plain-language procedure: the *what* and the *order*, not the code.
Tools (`../tools/`) do the work; the agent reads the workflow and runs the tools in
sequence. Write these the way you'd brief a teammate.

## Every workflow must define

1. **Objective** — what it accomplishes (1–2 sentences).
2. **Inputs** — required and optional, with shape/format.
3. **Tools (in order)** — which `tools/` scripts run, in what sequence, with what input.
4. **Expected output** — the shape of the final result.
5. **Edge cases / failure handling** — what to do when a tool fails or data is missing.

## Template

```markdown
# <workflow name>

## Objective
<one or two sentences>

## Inputs
- `<name>` (required) — <type/shape, description>
- `<name>` (optional) — <type/shape, description>

## Tools (in order)
1. `tools/<script>` — <what it does> — input: <…> → output: <…>
2. `tools/<script>` — <what it does> — input: <prev output> → output: <…>

## Expected output
<shape of the final result, e.g. JSON written to temp/outputs/…>

## Edge cases / failure handling
- <condition> → <what the agent should do>
- On any tool failure → stop, report what failed and why; do not work around it.
```

See `job-assistant.md` for the live example.
