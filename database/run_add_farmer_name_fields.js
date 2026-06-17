require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'migrations', 'add_farmer_name_fields.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('Migration file not found:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : undefined;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agricatch',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: pgSsl
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
