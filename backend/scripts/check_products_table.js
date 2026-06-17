// Check if products table has all required columns
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTable() {
  try {
    console.log('Checking products table columns...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in products table:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check specifically for rejection_reason
    const rejectionCheck = result.rows.find(c => c.column_name === 'rejection_reason');
    if (rejectionCheck) {
      console.log('\n✓ rejection_reason column exists');
    } else {
      console.log('\n✗ rejection_reason column MISSING');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
