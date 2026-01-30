Deploy checklist — AgriCatch

Overview
- This document lists the minimal steps to deploy backend (Render) and frontend (Netlify) and verify CORS/login issues are resolved.

1) Prepare
- Make sure `main` branch contains latest changes (you already merged):

```bash
git checkout main
git pull origin main
```

2) Backend (Render) — env vars and redeploy
- Open Render dashboard, select the service that serves `https://api.agricatch.store`.
- Set environment variables (use dashboard secrets; do NOT commit these to git):
  - `FRONTEND_URL` = `https://agricatch.store,https://www.agricatch.store,https://agricatch.onrender.com,https://api.agricatch.store`
  - (Optional for quick debug) `PERMISSIVE_CORS` = `true`
  - (Optional) `ENABLE_INGEST` = `false`
- Redeploy the service from Render UI.

Notes:
- `PERMISSIVE_CORS=true` will temporarily allow all origins (echo origin). Use only for short debugging. After verification, unset/disable it and rely on `FRONTEND_URL`.

3) Frontend (Netlify) — deploy updated frontend
- If Netlify is configured to auto-deploy from GitHub `main`, pushing `main` triggers a deploy automatically. Otherwise deploy manually.
- Manual Netlify CLI deploy (example):

```bash
# build frontend (if applicable)
# from repo root
cd frontend
# If using a simple static build step, run it; otherwise skip
# Then deploy via Netlify CLI (if installed):
netlify deploy --prod --dir=. # or point to your build output directory
```

4) Verify from browser + curl
- From your browser, open your frontend URL (e.g. `https://agricatch.store`). Try login and watch DevTools Network/Console for CORS or 403 errors.

- Use curl to verify the server returns CORS header for the page origin:

```bash
curl -I -H "Origin: https://agricatch.onrender.com" https://api.agricatch.store/api/test-db
```

Expected response headers include:
- `Access-Control-Allow-Origin: https://agricatch.onrender.com` (or `*` if permissive)
- `Access-Control-Allow-Credentials: true` (if credentials used)

5) Post-check cleanup (important)
- If you enabled `PERMISSIVE_CORS`, unset it in Render (remove the env var or set to `false`) and ensure `FRONTEND_URL` contains the frontend origins.
- Keep `ENABLE_INGEST=false` in production to silence local debug posts.

6) If problems persist
- Copy and paste the failed request/response from DevTools (Request URL, Origin header, Response headers, response body if any). I'll analyze the exact rejection cause.

7) Security reminder
- Never commit secrets or environment values into git. Set them through Render/Netlify dashboards.

If you'd like, I can also:
- Add this checklist as a PR (already merged to `main`), or
- Revert `PERMISSIVE_CORS` logic to only auto-enable in non-production automatically (I can patch code if you want).


---
Generated: Jan 28, 2026
