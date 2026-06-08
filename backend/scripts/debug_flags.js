// Debug script to check feature flags directly
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function checkFlags() {
  try {
    const result = await pool.query('SELECT key, name, enabled FROM feature_flags ORDER BY key');
    console.log('Feature flags in database:');
    for (const row of result.rows) {
      console.log(`  ${row.key}: ${row.enabled} (${row.name})`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFlags();
