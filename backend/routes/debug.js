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

module.exports = router;
