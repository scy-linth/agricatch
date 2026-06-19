// Run migration to add document_url column to verification_requests
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    console.log('Running migration: add document_url column to verification_requests...\n');
    
    await pool.query(`
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS document_url TEXT
    `);
    
    console.log('✓ document_url column added successfully');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_requests_document_url 
      ON verification_requests(document_url) 
      WHERE document_url IS NOT NULL
    `);
    
    console.log('✓ Index created successfully');
    
    console.log('\nMigration complete!');
    
  } catch (error) {
    console.error('Error running migration:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
