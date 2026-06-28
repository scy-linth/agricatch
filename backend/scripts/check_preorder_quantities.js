const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPreorderQuantities() {
  console.log('=== PREORDER QUANTITY CHECK ===\n');

  try {
    // Check preorder products with invalid reserved quantities
    const invalidReserved = await pool.query(`
      SELECT p.id, p.name, p.reserved_quantity, p.max_preorder_quantity, p.stock_quantity
      FROM products p
      WHERE p.is_preorder = true
        AND (p.reserved_quantity < 0 
             OR p.reserved_quantity IS NULL 
             OR p.max_preorder_quantity < 0 
             OR p.max_preorder_quantity IS NULL
             OR p.reserved_quantity > p.max_preorder_quantity)
      ORDER BY p.id
      LIMIT 50
    `);

    if (invalidReserved.rows.length > 0) {
      console.log(`1. Preorder products with invalid reserved quantities: ${invalidReserved.rows.length}`);
      invalidReserved.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): reserved=${row.reserved_quantity}, max=${row.max_preorder_quantity}, stock=${row.stock_quantity}`);
      });
    } else {
      console.log('1. Preorder products with invalid reserved quantities: 0');
    }

    // Check preorder products with NULL stock
    const nullStock = await pool.query(`
      SELECT p.id, p.name, p.stock_quantity, p.reserved_quantity
      FROM products p
      WHERE p.is_preorder = true
        AND p.stock_quantity IS NULL
      ORDER BY p.id
      LIMIT 50
    `);

    if (nullStock.rows.length > 0) {
      console.log(`2. Preorder products with NULL stock: ${nullStock.rows.length}`);
      nullStock.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): stock=${row.stock_quantity}, reserved=${row.reserved_quantity}`);
      });
    } else {
      console.log('2. Preorder products with NULL stock: 0');
    }

    // Check preorder products where reserved > stock (should be 0 for preorders)
    const reservedExceedsStock = await pool.query(`
      SELECT p.id, p.name, p.stock_quantity, p.reserved_quantity
      FROM products p
      WHERE p.is_preorder = true
        AND p.stock_quantity IS NOT NULL
        AND p.reserved_quantity > p.stock_quantity
      ORDER BY p.id
      LIMIT 50
    `);

    if (reservedExceedsStock.rows.length > 0) {
      console.log(`3. Preorder products where reserved > stock: ${reservedExceedsStock.rows.length}`);
      reservedExceedsStock.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): stock=${row.stock_quantity}, reserved=${row.reserved_quantity}`);
      });
    } else {
      console.log('3. Preorder products where reserved > stock: 0');
    }

    const totalIssues = invalidReserved.rows.length + nullStock.rows.length + reservedExceedsStock.rows.length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total preorder quantity issues: ${totalIssues}`);
    if (totalIssues > 0) {
      console.log('✗ Preorder quantity issues detected - review above issues');
    } else {
      console.log('✓ No preorder quantity issues found');
    }

  } catch (error) {
    console.error('Error checking preorder quantities:', error);
  } finally {
    await pool.end();
  }
}

checkPreorderQuantities();
