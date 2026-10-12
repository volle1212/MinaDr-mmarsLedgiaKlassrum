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

- `GET /api/lessons`, `GET /api/sightings` – anyone can read.
- `POST/PUT/DELETE` on both – need header `x-password` matching `EDIT_PASSWORD`.
- `lessons` = exact lessons (room, weekday, start, end). Double-bookings are rejected with a 409.
- `sightings` = "I saw this just now" observations. No field is required; empty time = now.
- Room names: `A` + three digits, first digit = floor (`207` is normalised to `A207`).

## How sightings become a schedule (all in `public/index.html`, see `CFG`)

- Sighting 08:00-11:30 -> guessed morning lesson 08:30-11:20 (assumed to have started ~08:00-09:30, ended before lunch).
- From 12:10 (lunch starts 11:30, earliest lesson 40 min later) -> guessed afternoon lesson 12:20-15:10.
- Between 11:30 and 12:10 (lunch), before 08:00 or long after the afternoon lesson -> stored as a single point, no length guessed.
- Estimates are computed in the browser from the raw sightings and never stored, so changing `CFG` re-interprets all existing data.
- Sightings in the same room + weekday whose windows overlap are merged; the window grows to cover all of them.
- Exact lessons always win: a guess that overlaps an exact lesson is hidden.
- The schedule is assumed to repeat every week (no A/B weeks yet).

## Room status and "Snart lediga"

- Three states per room at a chosen weekday/time: **busy** (a lesson or fresh sighting covers it), **free**
  (we know something about the room during that half-day and no lesson covers the time, or someone saw it empty
  in the last 45 min) and **unknown** (nothing known about the room that half-day).
- Half-days are split at the earliest possible afternoon start (`CFG.pm.from`, 12:10); lunch belongs to the morning.
- A free room only stays "free" as long as we know something: if nothing is known about the afternoon, a room whose
  morning lesson ended is shown as "Ledig till 12:10 · Därefter okänd" - never "free for the rest of the day".
- "Snart lediga" lists rooms whose current lesson ends within 10/20/30/60 min, sorted by time left. Back-to-back
  lessons in the same room count as one. Guessed end times are flagged. "Ledig minst" filters on how long the
  room stays free afterwards (until the next known lesson, or until 12:10 if the afternoon is unknown).

## Registering empty rooms

- `sightings.kind` is `lesson` (default, a lesson is going on) or `free` (the room is empty). Older rows and older
  clients are treated as `lesson`; the column is added automatically (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- A `free` sighting during a lesson block (08:00-11:30 / 12:10-15:40) marks that room + weekday + half-day as
  *registered free* in the weekly schedule. Per room/weekday/half-day the **most recent** sighting wins, whether
  it says lesson or free. Exact lessons always win. Free sightings during lunch only count live.
- Live (viewing "now"): a "free" sighting from the last 45 min makes the room free even if the schedule says
  there is a lesson (the schedule is shown as a note); a lesson sighting counts for 30 min.

## Teachers

- No separate table: teachers are the names written in the *teacher* field of lessons and sightings.
- Several teachers in one field: separate with comma, `&` or `och` ("Henrik, Natalie").
- Names are matched ignoring case and extra spaces. "Natalie" and "Natalie Svensson" are two different names
  (but searching "natalie" finds both) - keep spelling consistent; the field autocompletes existing names.
- The **Lärare** tab shows where each teacher is right now (or at a chosen time), next lesson, last sighting today,
  and a weekly schedule when you tap the name.

## Known rough edges / next steps

- Password is shared and stored in the browser's localStorage (fine for a POC).
- No bulk import (CSV would be a great next addition).
- No week A/B rotation, no per-date exceptions (substitutions, cancellations).
- "Right now" uses the viewer's device clock.