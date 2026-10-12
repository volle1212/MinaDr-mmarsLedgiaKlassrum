import { neon } from '@neondatabase/serverless';

let sql;
let ready;

export async function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL är inte satt på servern');
  if (!sql) sql = neon(url);
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS lessons (
          id SERIAL PRIMARY KEY,
          room TEXT NOT NULL,
          day INT NOT NULL,              -- 1 = måndag ... 5 = fredag
          start_time TEXT NOT NULL,      -- 'HH:MM'
          end_time TEXT NOT NULL,        -- 'HH:MM'
          class_name TEXT NOT NULL,
          teacher TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          updated_at TIMESTAMPTZ DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS sightings (
          id SERIAL PRIMARY KEY,
          seen_date TEXT NOT NULL,       -- 'YYYY-MM-DD'
          seen_time TEXT NOT NULL,       -- 'HH:MM'
          day INT NOT NULL,              -- 0 = söndag ... 6 = lördag
          room TEXT NOT NULL DEFAULT '',
          kind TEXT NOT NULL DEFAULT 'lesson',  -- 'lesson' = lektion pågår, 'free' = salen är tom
          teacher TEXT NOT NULL DEFAULT '',
          class_name TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT now()
        )`;
      // Äldre databaser saknar kind: lägg till, befintliga rader blir 'lesson'
      await sql`ALTER TABLE sightings ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'lesson'`;
    })();
    ready.catch(() => { ready = null; }); // försök igen vid nästa anrop om det misslyckades
  }
  await ready;
  return sql;
}

export function passwordOk(req) {
  const pw = process.env.EDIT_PASSWORD;
  return !!pw && req.headers['x-password'] === pw;
}

// "207" -> "A207", " a 207 " -> "A207". Salar börjar på A, första siffran = våning.
export function normRoom(s) {
  const r = String(s || '').toUpperCase().replace(/\s+/g, '');
  return /^\d{3}$/.test(r) ? 'A' + r : r;
}