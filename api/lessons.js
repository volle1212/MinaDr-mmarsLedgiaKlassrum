import { db, passwordOk, normRoom } from './_db.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(b) {
  if (!normRoom(b.room)) return 'Sal måste anges';
  const day = Number(b.day);
  if (!(day >= 1 && day <= 5)) return 'Dag måste vara måndag–fredag';
  if (!TIME.test(String(b.start_time || '')) || !TIME.test(String(b.end_time || ''))) {
    return 'Start och slut måste anges som TT:MM';
  }
  if (b.start_time >= b.end_time) return 'Sluttiden måste vara efter starttiden';
  return null;
}

const txt = (v, n = 200) => String(v ?? '').trim().slice(0, n);

export default async function handler(req, res) {
  try {
    const sql = await db();

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM lessons ORDER BY room, day, start_time`;
      return res.status(200).json(rows);
    }

    // allt nedan ändrar data -> lösenord krävs
    if (!passwordOk(req)) return res.status(401).json({ error: 'Fel eller saknat lösenord' });

    if (req.method === 'POST' || req.method === 'PUT') {
      const b = req.body || {};
      const err = validate(b);
      if (err) return res.status(400).json({ error: err });

      const room = normRoom(b.room);
      const day = Number(b.day);
      const class_name = txt(b.class_name);
      const teacher = txt(b.teacher);
      const notes = txt(b.notes, 500);
      const id = req.method === 'PUT' ? Number(b.id) : 0;

      const clash = await sql`
        SELECT id, class_name, start_time, end_time FROM lessons
        WHERE room = ${room} AND day = ${day}
          AND start_time < ${b.end_time} AND end_time > ${b.start_time}
          AND id <> ${id}`;
      if (clash.length) {
        const c = clash[0];
        return res.status(409).json({
          error: `Krockar med "${c.class_name || 'en annan lektion'}" (${c.start_time}–${c.end_time}) i samma sal`,
        });
      }

      if (req.method === 'POST') {
        const [row] = await sql`
          INSERT INTO lessons (room, day, start_time, end_time, class_name, teacher, notes)
          VALUES (${room}, ${day}, ${b.start_time}, ${b.end_time}, ${class_name}, ${teacher}, ${notes})
          RETURNING *`;
        return res.status(201).json(row);
      }

      const [row] = await sql`
        UPDATE lessons SET room=${room}, day=${day}, start_time=${b.start_time},
          end_time=${b.end_time}, class_name=${class_name},
          teacher=${teacher}, notes=${notes}, updated_at=now()
        WHERE id=${id} RETURNING *`;
      return row ? res.status(200).json(row) : res.status(404).json({ error: 'Hittades inte' });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      await sql`DELETE FROM lessons WHERE id=${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Metoden stöds inte' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
