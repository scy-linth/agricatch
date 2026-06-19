const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration: add_verification_document_url.sql');
    
    // Add document_url field
    await client.query(`
      ALTER TABLE verification_requests 
      ADD COLUMN IF NOT EXISTS document_url TEXT
    `);
    console.log('✓ Added document_url column');
    
    // Add index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_requests_document_url 
      ON verification_requests(document_url) 
      WHERE document_url IS NOT NULL
    `);
    console.log('✓ Created index on document_url');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
