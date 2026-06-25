// Run address name fields migration
require('dotenv').config();
const { pool } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../database/migrations/add_address_name_fields.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error('Migration file not found:', migrationFile);
    process.exit(1);
  }

  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Running migration: add_address_name_fields.sql');
    await pool.query(sql);

    console.log('✓ Migration completed successfully!');
    console.log('Added: first_name, middle_name, last_name columns to user_addresses table');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    if (error.code === '42701') {
      console.error('Note: Column already exists. This is okay - migration may have been run before.');
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
