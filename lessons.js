import { db, passwordOk } from './_db.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(b) {
  const room = String(b.room || '').trim();
  const class_name = String(b.class_name || '').trim();
  const day = Number(b.day);
  const start_time = String(b.start_time || '');
  const end_time = String(b.end_time || '');
  if (!room) return 'Room is required';
  if (!class_name) return 'Class is required';
  if (!(day >= 1 && day <= 5)) return 'Day must be 1-5 (Mon-Fri)';
  if (!TIME.test(start_time) || !TIME.test(end_time)) return 'Times must be HH:MM';
  if (start_time >= end_time) return 'End time must be after start time';
  return null;
}

export default async function handler(req, res) {
  try {
    const sql = await db();

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM lessons ORDER BY room, day, start_time`;
      return res.status(200).json(rows);
    }

    // everything below modifies data -> password needed
    if (!passwordOk(req)) return res.status(401).json({ error: 'Wrong or missing password' });

    if (req.method === 'POST' || req.method === 'PUT') {
      const b = req.body || {};
      const err = validate(b);
      if (err) return res.status(400).json({ error: err });

      const room = b.room.trim();
      const id = req.method === 'PUT' ? Number(b.id) : 0;

      const clash = await sql`
        SELECT id, class_name, start_time, end_time FROM lessons
        WHERE room = ${room} AND day = ${Number(b.day)}
          AND start_time < ${b.end_time} AND end_time > ${b.start_time}
          AND id <> ${id}`;
      if (clash.length) {
        const c = clash[0];
        return res.status(409).json({
          error: `Clashes with "${c.class_name}" (${c.start_time}-${c.end_time}) in that room`,
        });
      }

      if (req.method === 'POST') {
        const [row] = await sql`
          INSERT INTO lessons (room, day, start_time, end_time, class_name, teacher, notes)
          VALUES (${room}, ${Number(b.day)}, ${b.start_time}, ${b.end_time},
                  ${b.class_name.trim()}, ${b.teacher || ''}, ${b.notes || ''})
          RETURNING *`;
        return res.status(201).json(row);
      }

      const [row] = await sql`
        UPDATE lessons SET room=${room}, day=${Number(b.day)}, start_time=${b.start_time},
          end_time=${b.end_time}, class_name=${b.class_name.trim()},
          teacher=${b.teacher || ''}, notes=${b.notes || ''}, updated_at=now()
        WHERE id=${id} RETURNING *`;
      return row ? res.status(200).json(row) : res.status(404).json({ error: 'Not found' });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      await sql`DELETE FROM lessons WHERE id=${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
