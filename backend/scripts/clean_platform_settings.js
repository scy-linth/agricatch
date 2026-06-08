// Remove maintenance_mode and allow_new_registrations from platform_settings
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function cleanSettings() {
  try {
    console.log('Removing maintenance_mode and allow_new_registrations from platform_settings...');
    const result = await pool.query(`
      DELETE FROM platform_settings
      WHERE key IN ('maintenance_mode', 'allow_new_registrations')
    `);
    console.log(`✓ Removed ${result.rowCount} entries from platform_settings`);
  } catch (error) {
    console.error('✗ Cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanSettings();
