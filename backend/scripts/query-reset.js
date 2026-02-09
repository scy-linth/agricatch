require('dotenv').config();
const { Pool } = require('pg');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/query-reset.js <email>');
  process.exit(2);
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agriculture_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

(async () => {
  try {
    const res = await pool.query(
      `SELECT id, email, used, attempts, sent_count, created_at, expires_at, request_ip, user_agent FROM password_resets WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [String(email).toLowerCase()]
    );
    if (res.rows.length === 0) {
      console.log('No password_reset record found for', email);
    } else {
      console.log('Latest password_reset record:');
      console.log(res.rows[0]);
    }
  } catch (err) {
    console.error('DB error:', err.message || err);
  } finally {
    await pool.end();
  }
})();
