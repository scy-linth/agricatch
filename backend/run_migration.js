// Simple script to run database migrations from backend directory
require('dotenv').config();
const { pool } = require('./utils/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationName = process.argv[2] || 'add_user_flagging.sql';
  const migrationFile = path.join(__dirname, '../database/migrations', migrationName);

  if (!fs.existsSync(migrationFile)) {
    console.error(`✗ Migration file not found: ${migrationFile}`);
    console.log('Usage: node run_migration.js [migration-file.sql]');
    console.log('Available migrations:');
    const migrationsDir = path.join(__dirname, '../database/migrations');
    fs.readdirSync(migrationsDir).forEach(file => {
      if (file.endsWith('.sql')) {
        console.log(`  - ${file}`);
      }
    });
    process.exit(1);
  }

  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log(`Running migration: ${migrationName}`);
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
