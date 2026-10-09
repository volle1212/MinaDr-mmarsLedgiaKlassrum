# Classroom Tracker (proof of concept)

Static frontend (`public/`) + Vercel serverless functions (`api/`) + Neon Postgres.
No build step, no framework.

## Deploy to Vercel

1. Push this folder to a GitHub repo (or run `npx vercel` in this folder).
2. Import the repo in Vercel (Framework preset: **Other**; leave build settings empty).
3. In the Vercel project: **Storage → Create Database → Neon (Postgres)** → connect it to the project.
   This adds `DATABASE_URL` automatically.
4. **Settings → Environment Variables**: add `EDIT_PASSWORD` (the shared password).
5. Redeploy. Tables are created automatically on the first request.

## Local dev

```
npm i -g vercel
npm install
vercel link && vercel env pull .env.local   # pulls DATABASE_URL + EDIT_PASSWORD
vercel dev
```

## How it works

- `GET /api/lessons` – anyone can read.
- `POST/PUT/DELETE /api/lessons` – need header `x-password` matching `EDIT_PASSWORD`.
- Double-bookings (same room, day, overlapping time) are rejected with a 409.
- Weekdays only (Mon–Fri), times stored as `HH:MM`.

## Known rough edges / next steps

- Password is shared and stored in the browser's localStorage (fine for a POC).
- No bulk import (CSV would be a great next addition).
- No week A/B rotation, no per-date exceptions (substitutions, cancellations).
- "Right now" uses the viewer's device clock.
