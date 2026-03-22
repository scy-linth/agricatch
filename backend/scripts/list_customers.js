const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    const q = `SELECT id, email, username, full_name, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT 1000`;
    const res = await pool.query(q, ['customer']);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
