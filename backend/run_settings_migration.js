// Run settings table migration
require('dotenv').config();
const { pool } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../database/migrations/add_settings_table.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error('Migration file not found:', migrationFile);
    process.exit(1);
  }

  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Running migration: add_settings_table.sql');
    await pool.query(sql);

    console.log('✓ Migration completed successfully!');
    console.log('Added: settings table with use_default_delivery_address setting');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.error('Note: Table already exists. This is okay - migration may have been run before.');
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
