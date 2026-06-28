/**
 * Find Pre-order Products Script
 * 
 * This script finds pre-order products that can be used for testing
 * the wishlist notification feature.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function findPreorderProducts() {
  console.log('=== Finding Pre-order Products ===\n');

  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.price, p.stock_quantity, p.reserved_quantity, 
              p.max_preorder_quantity, p.preorder_availability_date, p.status,
              p.linked_product_id, u.username as farmer_name
       FROM products p
       JOIN users u ON p.farmer_id = u.id
       WHERE p.is_preorder = true
       ORDER BY p.id`
    );

    if (result.rows.length === 0) {
      console.log('✗ No pre-order products found in database');
      return;
    }

    console.log(`Found ${result.rows.length} pre-order product(s):\n`);
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`Price: ₱${row.price}`);
      console.log(`Stock: ${row.stock_quantity} kg`);
      console.log(`Reserved: ${row.reserved_quantity} kg`);
      console.log(`Max Pre-order: ${row.max_preorder_quantity} kg`);
      console.log(`Availability Date: ${row.preorder_availability_date}`);
      console.log(`Status: ${row.status}`);
      console.log(`Linked Product ID: ${row.linked_product_id}`);
      console.log(`Farmer: ${row.farmer_name}`);
      console.log('---');
    });

    // Check if any have linked available products
    console.log('\nPre-order products with linked available products:');
    const linkedResult = await pool.query(
      `SELECT p.id, p.name as preorder_name, 
              lp.id as linked_id, lp.name as linked_name, lp.is_available
       FROM products p
       LEFT JOIN products lp ON p.linked_product_id = lp.id
       WHERE p.is_preorder = true AND p.linked_product_id IS NOT NULL`
    );

    if (linkedResult.rows.length === 0) {
      console.log('✗ No pre-order products with linked available products');
    } else {
      linkedResult.rows.forEach(row => {
        console.log(`Pre-order: ${row.preorder_name} (ID: ${row.id}) -> Linked: ${row.linked_name} (ID: ${row.linked_id}, Available: ${row.is_available})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

findPreorderProducts()
  .then(() => {
    console.log('\n✓ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Script failed:', error.message);
    process.exit(1);
  });
