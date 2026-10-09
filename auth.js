import { passwordOk } from './_db.js';

export default function handler(req, res) {
  if (!process.env.EDIT_PASSWORD) {
    return res.status(500).json({ error: 'EDIT_PASSWORD env var is not set on the server' });
  }
  return passwordOk(req)
    ? res.status(200).json({ ok: true })
    : res.status(401).json({ error: 'Wrong password' });
}
