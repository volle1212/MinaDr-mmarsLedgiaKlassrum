import { neon } from '@neondatabase/serverless';

let sql;
let ready;

export async function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!sql) sql = neon(url);
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        room TEXT NOT NULL,
        day INT NOT NULL,              -- 1 = Monday ... 5 = Friday
        start_time TEXT NOT NULL,      -- 'HH:MM'
        end_time TEXT NOT NULL,        -- 'HH:MM'
        class_name TEXT NOT NULL,
        teacher TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT now()
      )`;
  }
  await ready;
  return sql;
}

export function passwordOk(req) {
  const pw = process.env.EDIT_PASSWORD;
  return !!pw && req.headers['x-password'] === pw;
}
