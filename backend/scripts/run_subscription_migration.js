const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Use Supabase credentials from .env (production database)
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found in .env file');
  process.exit(1);
}

// Remove sslmode from connection string and use ssl object instead
const cleanUrl = dbUrl.split('?')[0];

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database');
    
    // Check what tables exist
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Existing tables:', tablesRes.rows.map(r => r.table_name).join(', '));
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', 'add_farmer_subscriptions.sql');
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
