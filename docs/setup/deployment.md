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
