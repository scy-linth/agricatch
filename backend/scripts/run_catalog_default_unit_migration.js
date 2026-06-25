// Run migration to add default_unit column to product_name_catalog
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    console.log('Running migration: add default_unit column to product_name_catalog...\n');
    
    await pool.query(`
      ALTER TABLE product_name_catalog ADD COLUMN IF NOT EXISTS default_unit VARCHAR(20) DEFAULT 'kg'
    `);
    
    console.log('✓ Column added successfully');
    
    await pool.query(`
      COMMENT ON COLUMN product_name_catalog.default_unit IS 'Default unit for this product (e.g., kg, pieces, boxes)'
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
