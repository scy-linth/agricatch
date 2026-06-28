const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkOrphanCart() {
  console.log('=== ORPHAN CART CHECK ===\n');

  try {
    // Check cart items with non-existent products
    const orphanProducts = await pool.query(`
      SELECT c.id, c.session_id, c.product_id
      FROM cart c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE p.id IS NULL
      LIMIT 50
    `);

    if (orphanProducts.rows.length > 0) {
      console.log(`1. Cart items with non-existent products: ${orphanProducts.rows.length}`);
      orphanProducts.rows.forEach(row => {
        console.log(`   - Cart item ${row.id} (${row.session_id}): product_id=${row.product_id}`);
      });
    } else {
      console.log('1. Cart items with non-existent products: 0');
    }

    // Check cart items referencing disabled products
    const disabledProducts = await pool.query(`
      SELECT c.id, c.session_id, c.product_id, p.name, p.is_admin_disabled
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE p.is_admin_disabled = true
      LIMIT 50
    `);

    if (disabledProducts.rows.length > 0) {
      console.log(`2. Cart items referencing disabled products: ${disabledProducts.rows.length}`);
      disabledProducts.rows.forEach(row => {
        console.log(`   - Cart item ${row.id} (${row.session_id}): ${row.name} (disabled)`);
      });
    } else {
      console.log('2. Cart items referencing disabled products: 0');
    }

    // Check cart items with invalid quantities
    const invalidQuantities = await pool.query(`
      SELECT c.id, c.session_id, c.product_id, c.quantity, p.name
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.quantity <= 0 OR c.quantity IS NULL
      LIMIT 50
    `);

    if (invalidQuantities.rows.length > 0) {
      console.log(`3. Cart items with invalid quantities: ${invalidQuantities.rows.length}`);
      invalidQuantities.rows.forEach(row => {
        console.log(`   - Cart item ${row.id} (${row.session_id}): ${row.name}, quantity=${row.quantity}`);
      });
    } else {
      console.log('3. Cart items with invalid quantities: 0');
    }

    const totalIssues = orphanProducts.rows.length + disabledProducts.rows.length + invalidQuantities.rows.length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total orphan cart issues: ${totalIssues}`);
    if (totalIssues > 0) {
      console.log('✗ Orphan cart records detected - review above issues');
    } else {
      console.log('✓ No orphan cart records found');
    }

  } catch (error) {
    console.error('Error checking orphan cart:', error);
  } finally {
    await pool.end();
  }
}

checkOrphanCart();
