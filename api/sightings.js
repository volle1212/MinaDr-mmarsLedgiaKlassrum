import { db, passwordOk, normRoom } from './_db.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const txt = (v, n = 200) => String(v ?? '').trim().slice(0, n);

// Reservklocka om klienten inte skickar någon tid (skolans tidszon)
function stockholmNow() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', hour12: false });
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

// Veckodag (0 = söndag) för ett kalenderdatum, oberoende av serverns tidszon
function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.getUTCDay();
}

export default async function handler(req, res) {
  try {
    const sql = await db();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM sightings
        ORDER BY seen_date DESC, seen_time DESC, id DESC
        LIMIT 5000`;
      return res.status(200).json(rows);
    }

    if (!passwordOk(req)) return res.status(401).json({ error: 'Fel eller saknat lösenord' });

    if (req.method === 'POST') {
      const b = req.body || {};
      const now = stockholmNow();
      const seen_date = txt(b.seen_date) || now.date;
      const seen_time = txt(b.seen_time) || now.time;
      if (!DATE.test(seen_date) || weekday(seen_date) === null) return res.status(400).json({ error: 'Ogiltigt datum' });
      if (!TIME.test(seen_time)) return res.status(400).json({ error: 'Tid måste anges som TT:MM' });

      // kind: 'lesson' (lektion pågår, standard) eller 'free' (salen är tom). Inga fält är obligatoriska.
      const kind = b.kind === 'free' ? 'free' : 'lesson';
      if (b.kind !== undefined && b.kind !== 'lesson' && b.kind !== 'free') return res.status(400).json({ error: 'Ogiltig typ' });
      const [row] = await sql`
        INSERT INTO sightings (seen_date, seen_time, day, room, kind, teacher, class_name, notes)
        VALUES (${seen_date}, ${seen_time}, ${weekday(seen_date)}, ${normRoom(b.room)}, ${kind},
                ${kind === 'free' ? '' : txt(b.teacher)}, ${kind === 'free' ? '' : txt(b.class_name)}, ${txt(b.notes, 500)})
        RETURNING *`;
      return res.status(201).json(row);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      await sql`DELETE FROM sightings WHERE id=${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Metoden stöds inte' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}