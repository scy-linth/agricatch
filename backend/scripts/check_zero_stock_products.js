/**
 * Check which products have 0 stock but are marked as available
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function checkZeroStock() {
  console.log('=== Checking Zero Stock Products ===\n');

  try {
    const result = await pool.query(
      `SELECT id, name, is_available, is_preorder, status, is_admin_disabled, stock_quantity
       FROM products
       WHERE stock_quantity = 0 
         AND is_available = true 
         AND status = 'approved' 
         AND is_admin_disabled = false`
    );

    if (result.rows.length === 0) {
      console.log('✓ No products with 0 stock marked as available');
    } else {
      console.log(`Found ${result.rows.length} product(s) with 0 stock:\n`);
      result.rows.forEach(prod => {
        console.log(`  - ID: ${prod.id}`);
        console.log(`    Name: ${prod.name}`);
        console.log(`    Available: ${prod.is_available}`);
        console.log(`    Pre-order: ${prod.is_preorder}`);
        console.log(`    Status: ${prod.status}`);
        console.log(`    Admin Disabled: ${prod.is_admin_disabled}`);
        console.log(`    Stock: ${prod.stock_quantity}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkZeroStock()
  .then(() => {
    console.log('✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Check failed:', error.message);
    process.exit(1);
  });
