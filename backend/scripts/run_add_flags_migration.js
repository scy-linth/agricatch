// Quick script to add maintenance_mode and allow_registrations to feature_flags
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
    console.log('Adding maintenance_mode and allow_registrations to feature_flags...');
    const result = await pool.query(`
      INSERT INTO feature_flags (key, name, description, enabled)
      VALUES
        ('maintenance_mode', 'Maintenance Mode', 'When enabled, only super_admin can access the site', false),
        ('allow_registrations', 'Allow New Registrations', 'Allow customers and farmers to register new accounts', true)
      ON CONFLICT (key) DO NOTHING
    `);
    console.log(`✓ Added ${result.rowCount} feature flags`);
    console.log('All flags: price_drop_alerts, platform_announce, maintenance_mode, allow_registrations');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
