// Simple script to run database migrations
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', 'add_shop_columns.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: add_shop_columns.sql');
    await pool.query(sql);
    
    console.log('✓ Migration completed successfully!');
    console.log('Added columns: shop_description, shop_banner_url, shop_avatar_url');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    if (error.code === '42703') {
      console.error('Note: Some columns may already exist. This is okay.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
