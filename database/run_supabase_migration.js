// Run a single SQL migration against Supabase
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  user: process.env.SUPABASE_DB_USER || 'postgres',
  host: process.env.SUPABASE_DB_HOST,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  port: process.env.SUPABASE_DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const migrationName = process.argv[2] || 'add_reviews_product_id_index.sql';
  const migrationFile = path.join(__dirname, 'migrations', migrationName);

  if (!fs.existsSync(migrationFile)) {
    console.error(`✗ Migration file not found: ${migrationFile}`);
    console.log('Usage: node run_supabase_migration.js [migration-file.sql]');
    process.exit(1);
  }

  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log(`Running migration: ${migrationName}`);
    console.log(`Connecting to: ${process.env.SUPABASE_DB_HOST}`);
    await pool.query(sql);

    console.log('✓ Migration completed successfully!');
    console.log(`Applied: ${migrationName}`);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    if (error.code === '42701') {
      console.error('Note: Column already exists. This is okay - migration may have been run before.');
    } else if (error.code === '42P07') {
      console.error('Note: Relation already exists. This is okay - migration may have been run before.');
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
