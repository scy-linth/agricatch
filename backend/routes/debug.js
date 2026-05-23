const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');

// Returns non-sensitive DB information: host, port, and database name only.
// This endpoint is temporary and should be removed after verification.
router.get('/db-info', async (req, res) => {
  try {
    const envUrl = process.env.DATABASE_URL || '';
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        return res.json({ host: parsed.hostname, port: parsed.port || null, database: (parsed.pathname || '').replace(/^\//, '') });
      } catch (e) {
        // fall through to environment vars
      }
    }

    const host = process.env.DB_HOST || process.env.PGHOST || (pool && pool.options && pool.options.host) || null;
    const database = process.env.DB_NAME || process.env.PGDATABASE || (pool && pool.options && pool.options.database) || null;

    return res.json({ host, database });
  } catch (err) {
    return res.status(500).json({ error: 'failed to read db info' });
  }
});

// Temporary login check: verify email/username + password against DB
// Returns whether stored password is bcrypt/plaintext and if it matches.
router.post('/login-check', async (req, res) => {
  try {
    const identifier = String(req.body?.email || req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');
    if (!identifier || !password) return res.status(400).json({ message: 'email and password required' });

    const q = await pool.query(
      `SELECT id, username, email, password, password_hash, encrypted_password FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [identifier, identifier]
    );

    if (q.rows.length === 0) return res.status(404).json({ found: false });
    const user = q.rows[0];
    const stored = user.password_hash || user.password || user.encrypted_password || '';

    const isBcrypt = typeof stored === 'string' && stored.startsWith('$2');
    let matches = false;
    if (isBcrypt) {
      const bcrypt = require('bcryptjs');
      const hash = stored.startsWith('$2y$') ? `$2a$${stored.slice(4)}` : stored;
      try { matches = await bcrypt.compare(password, hash); } catch (e) { matches = false; }
    } else {
      matches = stored === password;
    }

    // Return non-sensitive info only
    return res.json({ found: true, id: user.id, username: user.username, email: user.email, storedType: isBcrypt ? 'bcrypt' : (stored ? 'other' : 'none'), passwordMatches: matches });
  } catch (e) {
    return res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;
