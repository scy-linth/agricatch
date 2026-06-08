// Remove max_order_quantity, max_products_per_farmer, platform_name from platform_settings
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
    console.log('Removing max_order_quantity, max_products_per_farmer, platform_name from platform_settings...');
    const result = await pool.query(`
      DELETE FROM platform_settings
      WHERE key IN ('max_order_quantity', 'max_products_per_farmer', 'platform_name')
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
