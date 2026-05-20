# Deploy on Render

This app is now prepared to run on Render as a single Node web service plus a managed PostgreSQL database.

## What is included

- `render.yaml` creates:
  - one web service: `eventus-ats`
  - one PostgreSQL database: `eventus-ats-db`
- the Node server serves:
  - the built Vite frontend
  - `/api/ats/*`
  - `/api/ai/*`
  - `/healthz`

## Steps

1. Push this project to GitHub.
2. In Render, choose **New -> Blueprint**.
3. Select the repository and confirm the `render.yaml` resources.
4. Provide values for optional secret environment variables if you want live AI:
   - `LLM_API_URL`
   - `LLM_API_KEY`
   - `LLM_MODEL`
5. Deploy.

## Fresh app behavior

- The frontend starts with no ATS records.
- The browser local workspace is reset on first load.
- There is no hardcoded default SuperUser password.
- On the first visit to `/login`, create the initial SuperUser password.

## Notes

- Production should use PostgreSQL only.
- `ATS_STORAGE=postgres` is already set in `render.yaml`.
- Render runs `npm run db:migrate` before each deploy.
- If you do not configure AI provider variables, the app falls back to its safe local deterministic AI behavior.
