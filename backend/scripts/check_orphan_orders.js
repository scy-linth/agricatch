const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkOrphanOrders() {
  console.log('=== ORPHAN ORDER CHECK ===\n');

  try {
    // Check orders with non-existent products
    const orphanProducts = await pool.query(`
      SELECT o.id, o.user_id, o.product_id, o.created_at
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE p.id IS NULL
      ORDER BY o.created_at DESC
      LIMIT 50
    `);

    if (orphanProducts.rows.length > 0) {
      console.log(`1. Orders with non-existent products: ${orphanProducts.rows.length}`);
      orphanProducts.rows.forEach(row => {
        console.log(`   - Order ${row.id} for user ${row.user_id}: product_id=${row.product_id}`);
      });
    } else {
      console.log('1. Orders with non-existent products: 0');
    }

    // Check orders with non-existent users
    const orphanUsers = await pool.query(`
      SELECT o.id, o.user_id, o.product_id, o.created_at
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE u.id IS NULL
      ORDER BY o.created_at DESC
      LIMIT 50
    `);

    if (orphanUsers.rows.length > 0) {
      console.log(`2. Orders with non-existent users: ${orphanUsers.rows.length}`);
      orphanUsers.rows.forEach(row => {
        console.log(`   - Order ${row.id}: user_id=${row.user_id}, product_id=${row.product_id}`);
      });
    } else {
      console.log('2. Orders with non-existent users: 0');
    }

    // Check orders referencing disabled products
    const disabledProducts = await pool.query(`
      SELECT o.id, o.user_id, o.product_id, p.name, p.is_admin_disabled
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.is_admin_disabled = true
      ORDER BY o.created_at DESC
      LIMIT 50
    `);

    if (disabledProducts.rows.length > 0) {
      console.log(`3. Orders referencing disabled products: ${disabledProducts.rows.length}`);
      disabledProducts.rows.forEach(row => {
        console.log(`   - Order ${row.id} for user ${row.user_id}: ${row.name} (disabled)`);
      });
    } else {
      console.log('3. Orders referencing disabled products: 0');
    }

    // Check orders with invalid quantities
    const invalidQuantities = await pool.query(`
      SELECT o.id, o.user_id, o.product_id, o.quantity, p.name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.quantity <= 0 OR o.quantity IS NULL
      ORDER BY o.created_at DESC
      LIMIT 50
    `);

    if (invalidQuantities.rows.length > 0) {
      console.log(`4. Orders with invalid quantities: ${invalidQuantities.rows.length}`);
      invalidQuantities.rows.forEach(row => {
        console.log(`   - Order ${row.id} for user ${row.user_id}: ${row.name}, quantity=${row.quantity}`);
      });
    } else {
      console.log('4. Orders with invalid quantities: 0');
    }

    const totalIssues = orphanProducts.rows.length + orphanUsers.rows.length + disabledProducts.rows.length + invalidQuantities.rows.length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total orphan order issues: ${totalIssues}`);
    if (totalIssues > 0) {
      console.log('✗ Orphan order records detected - review above issues');
    } else {
      console.log('✓ No orphan order records found');
    }

  } catch (error) {
    console.error('Error checking orphan orders:', error);
  } finally {
    await pool.end();
  }
}

checkOrphanOrders();
