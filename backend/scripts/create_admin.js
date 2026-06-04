const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB_URL = process.env.DATABASE_URL || '';
const pool = DB_URL ? new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } }) : new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT || 5432),
  ssl: (process.env.DB_SSL === 'true') ? { rejectUnauthorized: false } : false,
});

async function main() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@gmail.com';
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'adminadmin';
    const bcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

    if (!email) throw new Error('ADMIN_EMAIL is required');

    const hash = (process.env.ALLOW_PLAINTEXT_PASSWORDS === 'true' || (process.env.DEV_PLAINTEXT_PASSWORDS === 'true' && process.env.NODE_ENV !== 'production'))
      ? password
      : await bcrypt.hash(password, bcryptRounds);

    const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const cols = new Set(colRes.rows.map(r => r.column_name));
    const useHash = cols.has('password_hash');
    const usePlain = cols.has('password');
    const useUpdatedAt = cols.has('updated_at');

    if (!useHash && !usePlain) {
      throw new Error('No password column found in users table (expected password_hash or password)');
    }

    const existingRes = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username]
    );
    const existingId = existingRes.rows[0] ? existingRes.rows[0].id : null;

    if (useHash && usePlain) {
      if (existingId) {
        const sql = `
          UPDATE users
          SET username = $1,
              email = $2,
              role = 'staff',
              password = $3,
              password_hash = $4
              ${useUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''}
          WHERE id = $5;
        `;
        await pool.query(sql, [username, email, password, hash, existingId]);
      } else {
        const sql = `
          INSERT INTO users (username, email, role, password, password_hash, created_at)
          VALUES ($1, $2, 'staff', $3, $4, NOW());
        `;
        await pool.query(sql, [username, email, password, hash]);
      }
    } else if (useHash) {
      if (existingId) {
        const sql = `
          UPDATE users
          SET username = $1,
              email = $2,
              role = 'staff',
              password_hash = $3
              ${useUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''}
          WHERE id = $4;
        `;
        await pool.query(sql, [username, email, hash, existingId]);
      } else {
        const sql = `
          INSERT INTO users (username, email, role, password_hash, created_at)
          VALUES ($1, $2, 'staff', $3, NOW());
        `;
        await pool.query(sql, [username, email, hash]);
      }
    } else {
      if (existingId) {
        const sql = `
          UPDATE users
          SET username = $1,
              email = $2,
              role = 'staff',
              password = $3
              ${useUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''}
          WHERE id = $4;
        `;
        await pool.query(sql, [username, email, password, existingId]);
      } else {
        const sql = `
          INSERT INTO users (username, email, role, password, created_at)
          VALUES ($1, $2, 'staff', $3, NOW());
        `;
        await pool.query(sql, [username, email, password]);
      }
    }

    console.log(`Admin (staff) ensured: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
}

main();
