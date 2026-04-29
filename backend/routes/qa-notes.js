const express = require('express');
const { pool } = require('../utils/db');

const router = express.Router();

// TEMPORARY QA FEATURE (Notepad)
// This route is intended ONLY for QA/testing and should be removed once the website is fully functional.
const isEnabled = () => {
  const enabled = String(process.env.QA_NOTEPAD_ENABLED || '').toLowerCase() === 'true';
  // In non-production we keep it on by default for local dev/testing.
  if (process.env.NODE_ENV !== 'production') return true;
  return enabled;
};

let tableEnsured = false;
const ensureTable = async () => {
  if (tableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qa_notes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableEnsured = true;
};

const toApiNote = (row) => {
  return {
    id: String(row.id),
    text: String(row.text ?? ''),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
};

router.use(async (req, res, next) => {
  if (!isEnabled()) {
    // The frontend treats 404 as "API disabled/not deployed" and will fall back to local storage.
    return res.status(404).json({ error: 'QA notepad API is disabled' });
  }

  try {
    await ensureTable();
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to initialize QA notes storage' });
  }
});

// GET /api/qa-notes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, text, created_at, updated_at FROM qa_notes ORDER BY updated_at DESC, created_at DESC'
    );
    const notes = (result.rows || []).map(toApiNote);
    return res.json({ ok: true, notes });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to list notes' });
  }
});

// POST /api/qa-notes
// Body: { id: string, text: string }
router.post('/', async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  const text = typeof req.body?.text === 'string' ? req.body.text : '';

  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!text.trim()) return res.status(400).json({ error: 'Missing text' });

  try {
    const result = await pool.query(
      `
        INSERT INTO qa_notes (id, text, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET text = EXCLUDED.text,
            updated_at = NOW()
        RETURNING id, text, created_at, updated_at
      `,
      [id, text]
    );

    const note = result.rows?.[0] ? toApiNote(result.rows[0]) : null;
    return res.json({ ok: true, note });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/qa-notes/:id
// Body: { text: string }
router.put('/:id', async (req, res) => {
  const id = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
  const text = typeof req.body?.text === 'string' ? req.body.text : '';

  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (!text.trim()) return res.status(400).json({ error: 'Missing text' });

  try {
    const result = await pool.query(
      `
        UPDATE qa_notes
        SET text = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, text, created_at, updated_at
      `,
      [id, text]
    );

    if (!result.rows?.length) return res.status(404).json({ error: 'Note not found' });
    return res.json({ ok: true, note: toApiNote(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/qa-notes/:id
router.delete('/:id', async (req, res) => {
  const id = typeof req.params?.id === 'string' ? req.params.id.trim() : '';
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    await pool.query('DELETE FROM qa_notes WHERE id = $1', [id]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
