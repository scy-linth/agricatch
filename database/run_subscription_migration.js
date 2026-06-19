const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from backend .env
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

// Use DATABASE_URL directly from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_farmer_subscriptions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Created tables: farmer_subscriptions, payment_accounts');
    console.log('Seeded: default GCash account, platform settings');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('Tables already exist (no action needed)');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
