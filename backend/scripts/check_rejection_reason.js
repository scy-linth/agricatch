// Check if rejection_reason column exists and if rejected products have reasons
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkRejectionReason() {
  try {
    console.log('Checking rejection_reason column...\n');
    
    // Check if column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'rejection_reason'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✓ rejection_reason column exists');
      console.log(`  Type: ${columnCheck.rows[0].data_type}`);
    } else {
      console.log('✗ rejection_reason column does NOT exist');
      console.log('  Run: ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;');
    }
    
    console.log('\nChecking rejected products...\n');
    
    // Check rejected products
    const rejectedProducts = await pool.query(`
      SELECT id, name, status, rejection_reason 
      FROM products 
      WHERE status = 'rejected' 
      LIMIT 5
    `);
    
    if (rejectedProducts.rows.length === 0) {
      console.log('No rejected products found');
    } else {
      console.log(`Found ${rejectedProducts.rows.length} rejected products:`);
      rejectedProducts.rows.forEach(p => {
        console.log(`  - Product #${p.id}: ${p.name}`);
        console.log(`    Status: ${p.status}`);
        console.log(`    Rejection Reason: ${p.rejection_reason || 'NULL'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRejectionReason();
