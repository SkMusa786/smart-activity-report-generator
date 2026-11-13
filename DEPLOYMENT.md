# Deployment

## Local development

1. Create `server/.env` from `server/.env.example`. Gemini variables are optional while manual descriptions are enabled.
2. Set `VITE_API_BASE_URL=http://localhost:5000` in `client/.env` for local development.
4. Start the API:

   ```powershell
   cd server
   npm install
   npm run dev
   ```

5. Start the Vite client in a second terminal:

   ```powershell
   cd client
   npm install
   npm run dev
   ```

## Render backend

- Build command: `npm install`
- Start command: `npm start`
- Node runtime: 22 or newer
- Root directory: `server`
- Environment variables:
  - `PORT` is supplied by Render.
  - `FRONTEND_URL`: exact deployed Vercel origin, for example `https://your-app.vercel.app`. Multiple approved origins may be comma-separated.

## Vercel frontend

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL`: the public Render backend URL, without a trailing slash.

In Vercel Project Settings > Environment Variables, set `VITE_API_BASE_URL` for **Production** and **Preview** to the actual Render service URL (for example `https://smart-activity-report-api.onrender.com`). Do not use `http://localhost:5000` in a deployed build. Vite embeds this value during `npm run build`, so redeploy after changing it.

In Render, set `FRONTEND_URL` to the exact Vercel origin, including `https://` and excluding a trailing slash. If you use both the production and preview frontend, provide both origins separated by a comma.

Verify deployment before testing exports:

1. Open `https://YOUR-RENDER-SERVICE.onrender.com/api/health` and confirm `{"success":true,"status":"ok"}`.
2. Open the deployed Vercel site and confirm the browser's network requests use the Render URL, not `localhost`.
3. If either environment variable changes, redeploy the affected service.

Disable Vercel Deployment Protection for the public production deployment, or configure an appropriate public access policy. If the deployment redirects to `vercel.com/login`, browsers cannot load the frontend bundle and export requests cannot run.

Vite variables are public by design and must never contain the Gemini API key.

## Storage model

`POST /api/reports/submit` validates the report payload in memory for the current session and does not persist activities or uploaded images. Export endpoints process data in memory and return the generated file. AI routes remain available for a future Gemini mode but are not called by the manual-description frontend. AI and report routes have per-IP in-memory rate limits; rate-limit state is per Render instance and is not distributed.
