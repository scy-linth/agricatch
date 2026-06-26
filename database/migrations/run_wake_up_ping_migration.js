// Run wake-up ping flag migration
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('render') 
    ? { rejectUnauthorized: false } 
    : false
});

async function runMigration() {
  try {
    const sql = `
INSERT INTO feature_flags (key, name, description, enabled)
VALUES ('enable_wake_up_ping', 'Enable Wake-Up Ping', 'When enabled, the Render cron job will ping the health endpoint every 5 minutes to keep the free tier service awake. When disabled, the service may sleep after inactivity.', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled;
    `;

    console.log('Running wake-up ping flag migration...');
    await pool.query(sql);
    console.log('✓ Migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.error('Note: Flag already exists. This is okay.');
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
