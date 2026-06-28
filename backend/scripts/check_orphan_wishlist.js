const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkOrphanWishlist() {
  console.log('=== ORPHAN WISHLIST CHECK ===\n');

  try {
    // Check wishlist items with non-existent products
    const orphanProducts = await pool.query(`
      SELECT w.id, w.user_id, w.product_id, w.created_at
      FROM wishlist w
      LEFT JOIN products p ON w.product_id = p.id
      WHERE p.id IS NULL
      ORDER BY w.created_at DESC
      LIMIT 50
    `);

    if (orphanProducts.rows.length > 0) {
      console.log(`1. Wishlist items with non-existent products: ${orphanProducts.rows.length}`);
      orphanProducts.rows.forEach(row => {
        console.log(`   - Wishlist item ${row.id} for user ${row.user_id}: product_id=${row.product_id}`);
      });
    } else {
      console.log('1. Wishlist items with non-existent products: 0');
    }

    // Check wishlist items with non-existent users
    const orphanUsers = await pool.query(`
      SELECT w.id, w.user_id, w.product_id, w.created_at
      FROM wishlist w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE u.id IS NULL
      ORDER BY w.created_at DESC
      LIMIT 50
    `);

    if (orphanUsers.rows.length > 0) {
      console.log(`2. Wishlist items with non-existent users: ${orphanUsers.rows.length}`);
      orphanUsers.rows.forEach(row => {
        console.log(`   - Wishlist item ${row.id}: user_id=${row.user_id}, product_id=${row.product_id}`);
      });
    } else {
      console.log('2. Wishlist items with non-existent users: 0');
    }

    // Check wishlist items referencing disabled products
    const disabledProducts = await pool.query(`
      SELECT w.id, w.user_id, w.product_id, p.name, p.is_admin_disabled
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE p.is_admin_disabled = true
      ORDER BY w.created_at DESC
      LIMIT 50
    `);

    if (disabledProducts.rows.length > 0) {
      console.log(`3. Wishlist items referencing disabled products: ${disabledProducts.rows.length}`);
      disabledProducts.rows.forEach(row => {
        console.log(`   - Wishlist item ${row.id} for user ${row.user_id}: ${row.name} (disabled)`);
      });
    } else {
      console.log('3. Wishlist items referencing disabled products: 0');
    }

    const totalIssues = orphanProducts.rows.length + orphanUsers.rows.length + disabledProducts.rows.length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total orphan wishlist issues: ${totalIssues}`);
    if (totalIssues > 0) {
      console.log('✗ Orphan wishlist records detected - review above issues');
    } else {
      console.log('✓ No orphan wishlist records found');
    }

  } catch (error) {
    console.error('Error checking orphan wishlist:', error);
  } finally {
    await pool.end();
  }
}

checkOrphanWishlist();
