require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const email = process.argv[2];
const password = process.argv[3] || 'Test1234!';
if (!email) {
  console.error('Usage: node scripts/create-test-user.js <email> [password]');
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
    const emailNorm = String(email).toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (existing.rows.length > 0) {
      console.log('User already exists with email', emailNorm, '- skipping creation');
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
    const res = await pool.query(
      'INSERT INTO users (username, email, password, full_name, role, created_at) VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) RETURNING id',
      [emailNorm.split('@')[0], emailNorm, hash, 'Test User', 'customer']
    );
    console.log('Created test user id', res.rows[0].id, 'email', emailNorm);
  } catch (err) {
    console.error('Error creating test user:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
