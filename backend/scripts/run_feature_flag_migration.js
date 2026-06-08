// Quick script to remove unused feature flags
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    console.log('Removing unused feature flags...');
    const result = await pool.query(`
      DELETE FROM feature_flags
      WHERE key IN ('guest_cart', 'product_reviews', 'farmer_chat', 'otp_verification')
    `);
    console.log(`✓ Removed ${result.rowCount} unused feature flags`);
    console.log('Remaining flags: price_drop_alerts, platform_announce');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
