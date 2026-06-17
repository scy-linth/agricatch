// Run migration to add rejection_reason column
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    console.log('Running migration: add rejection_reason column...\n');
    
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `);
    
    console.log('✓ Column added successfully');
    
    await pool.query(`
      COMMENT ON COLUMN products.rejection_reason IS 'Reason provided by admin when rejecting a product'
    `);
    
    console.log('✓ Comment added successfully');
    
    console.log('\nMigration complete!');
    
  } catch (error) {
    console.error('Error running migration:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
