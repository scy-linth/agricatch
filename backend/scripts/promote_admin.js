// Promote a user to admin directly in PostgreSQL.
// Usage:
//   node backend/scripts/promote_admin.js admin@agricatch.ph
// Defaults to admin@agricatch.ph if omitted.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

async function main() {
  const email = process.argv[2] || 'admin@agricatch.ph';
  const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
    ? { rejectUnauthorized: false }
    : false;

  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'agri_fishery_marketplace',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    ssl: pgSsl,
  });

  try {
    const before = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [email]);
    console.log('Before:', before.rows[0] || null);

    const updated = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
      [email]
    );

    console.log('After:', updated.rows[0] || null);

    if (updated.rows.length === 0) {
      process.exitCode = 2;
      console.error('User not found for email:', email);
    } else {
      console.log('✅ Role updated to admin.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Failed to promote admin:', err.message);
  process.exitCode = 1;
});

