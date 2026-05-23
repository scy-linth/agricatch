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
    const email = process.env.SUPERADMIN_EMAIL || 'scy@linth';
    const username = process.env.SUPERADMIN_USERNAME || 'scy_linth';
    const password = process.env.SUPERADMIN_PASSWORD || '1234';
    const bcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

    if (!email) throw new Error('SUPERADMIN_EMAIL is required');

    const hash = (process.env.ALLOW_PLAINTEXT_PASSWORDS === 'true' || (process.env.DEV_PLAINTEXT_PASSWORDS === 'true' && process.env.NODE_ENV !== 'production'))
      ? password
      : await bcrypt.hash(password, bcryptRounds);

    // Determine whether DB has password_hash or password column
    const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const cols = new Set(colRes.rows.map(r => r.column_name));
    const useHash = cols.has('password_hash');
    const usePlain = cols.has('password');

    if (!useHash && !usePlain) {
      throw new Error('No password column found in users table (expected password_hash or password)');
    }

    if (useHash) {
      const sql = `
        INSERT INTO users (username, email, role, password_hash, created_at)
        VALUES ($1, $2, 'super_admin', $3, NOW())
        ON CONFLICT (email) DO UPDATE
        SET username = EXCLUDED.username,
            role = 'super_admin',
            password_hash = EXCLUDED.password_hash;
      `;
      await pool.query(sql, [username, email, hash]);
    } else {
      // Fallback to legacy 'password' column
      const sql = `
        INSERT INTO users (username, email, role, password, created_at)
        VALUES ($1, $2, 'super_admin', $3, NOW())
        ON CONFLICT (email) DO UPDATE
        SET username = EXCLUDED.username,
            role = 'super_admin',
            password = EXCLUDED.password;
      `;
      await pool.query(sql, [username, email, hash]);
    }
    console.log(`Super-admin ensured: ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create super-admin:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
}

main();
