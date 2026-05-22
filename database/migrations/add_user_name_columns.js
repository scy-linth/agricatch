const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: String(process.env.DB_HOST || '').includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function addNameColumns() {
  try {
    console.log('Adding first_name, middle_name, last_name to users...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`);
    console.log('✅ Name columns added (if not existing)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to add name columns:', err);
    process.exit(1);
  }
}

addNameColumns();
