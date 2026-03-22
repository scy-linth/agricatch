const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('pg');

const sqlPath = path.join(__dirname, 'remove_refunds.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('Migration file not found:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

if (process.env.CONFIRM_REMOVE_REFUNDS !== 'true') {
  console.error('Abort: destructive migration. Set CONFIRM_REMOVE_REFUNDS=true in environment to run this script.');
  console.error('Example: CONFIRM_REMOVE_REFUNDS=true node database/run_remove_refunds.js');
  process.exit(1);
}

const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: Number(process.env.DB_PORT || 5432),
  ssl: pgSsl,
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Applying migration from', sqlPath);
    console.log('--- SQL START ---');
    console.log(sql);
    console.log('--- SQL END ---');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed, rolling back:', err.message || err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
