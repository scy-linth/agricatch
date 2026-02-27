const { Pool } = require('pg');
const email = process.argv[2];
if (!email) {
  console.error('Usage: node check_user.js <email>');
  process.exit(2);
}
const pgSsl = String(process.env.DB_HOST || '').includes('render.com') ? { rejectUnauthorized: false } : false;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: pgSsl,
});

(async () => {
  try {
    const res = await pool.query('SELECT id, email, username, password, password_hash, role, created_at FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($1)', [email]);
    if (res.rows.length === 0) {
      console.log(JSON.stringify({ found: false, email }, null, 2));
    } else {
      console.log(JSON.stringify({ found: true, rows: res.rows }, null, 2));
    }
  } catch (e) {
    console.error('Query error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
