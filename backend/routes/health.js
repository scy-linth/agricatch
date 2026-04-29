const express = require('express');
const { pool } = require('../utils/db');

const router = express.Router();

// Lightweight health check for Render / uptime pings.
// Returns 200 quickly; also attempts a minimal DB ping when possible.
router.get('/', async (req, res) => {
  const now = new Date().toISOString();
  const result = {
    status: 'ok',
    now,
    // These are set automatically by some CI/CD systems and by Render.
    // Helpful for confirming which deploy/commit is currently serving traffic.
    commit: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || null,
    service: process.env.RENDER_SERVICE_NAME || null,
    env: process.env.NODE_ENV || null,
  };

  try {
    // quick DB ping
    if (pool) {
      await pool.query('SELECT 1');
      result.db = 'ok';
    }
  } catch (err) {
    result.db = 'error';
    result.db_error = String(err.message || err);
  }

  res.json(result);
});

module.exports = router;
