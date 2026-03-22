const path = require('path');
require(path.join(__dirname, '..', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", ['users']);
    const cols = new Set((colRes.rows || []).map(r => String(r.column_name).toLowerCase()));
    const want = ['id', 'email', 'username', 'role', 'created_at'];
    if (cols.has('password')) want.splice(3, 0, 'password');
    if (cols.has('password_hash')) want.splice( want.indexOf('role'), 0, 'password_hash');
    const q = `SELECT ${want.join(', ')} FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT 1000`;
    const res = await pool.query(q, ['customer']);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
