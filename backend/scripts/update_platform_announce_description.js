// Update platform_announce description in database
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function updateDescription() {
  try {
    console.log('Updating platform_announce description...');
    const result = await pool.query(`
      UPDATE feature_flags
      SET description = 'Show platform-wide announcements to all users'
      WHERE key = 'platform_announce'
    `);
    console.log(`✓ Updated ${result.rowCount} flag description`);
  } catch (error) {
    console.error('✗ Update failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateDescription();
