const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../utils/db');

(async () => {
  try {
    const email = 'scy@linth';
    const username = 'scy_linth';
    const password = '1234';

    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users'`
    );
    const cols = new Set((colRes.rows || []).map((r) => String(r.column_name || '').toLowerCase()));

    const fields = [];
    const values = [];
    let i = 1;
    const add = (name, value) => {
      if (!cols.has(name)) return;
      fields.push(name);
      values.push(value);
      i += 1;
    };

    add('username', username);
    add('email', email);
    add('password', password);
    add('password_hash', password);
    add('full_name', 'Super Administrator');
    add('phone', '+63 999 999 9999');
    add('address', 'Super Admin Office, Virtual');
    add('role', 'super_admin');
    add('user_type', 'super_admin');
    add('is_verified', true);

    if (!fields.length) throw new Error('users table columns not detected');

    const setClauses = fields.map((f, idx) => `${f} = $${idx + 1}`).join(', ');

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]);
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await pool.query(`UPDATE users SET ${setClauses}${cols.has('updated_at') ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = $${fields.length + 1}`, [...values, id]);
      console.log(JSON.stringify({ action: 'updated', id, email, username, role: 'super_admin' }));
    } else {
      const placeholders = fields.map((_, idx) => `$${idx + 1}`).join(', ');
      const inserted = await pool.query(`INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders}) RETURNING id`, values);
      console.log(JSON.stringify({ action: 'inserted', id: inserted.rows[0].id, email, username, role: 'super_admin' }));
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
