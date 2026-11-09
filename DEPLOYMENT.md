# Deployment

## Local development

1. Create `server/.env` from `server/.env.example`. Gemini variables are optional while manual descriptions are enabled.
2. Set `VITE_API_URL=http://localhost:5000` in `client/.env`.
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
  - `CLIENT_ORIGIN`: exact deployed Vercel origin, for example `https://your-app.vercel.app`. Multiple approved origins may be comma-separated.

## Vercel frontend

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable:
  - `VITE_API_URL`: the public Render backend URL, without a trailing slash.

Vite variables are public by design and must never contain the Gemini API key.

## Storage model

`POST /api/reports/submit` validates the report payload in memory for the current session and does not persist activities or uploaded images. Export endpoints process data in memory and return the generated file. AI routes remain available for a future Gemini mode but are not called by the manual-description frontend. AI and report routes have per-IP in-memory rate limits; rate-limit state is per Render instance and is not distributed.
