const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkOrphanReviews() {
  console.log('=== ORPHAN REVIEW CHECK ===\n');

  try {
    // Check reviews with non-existent products
    const orphanProducts = await pool.query(`
      SELECT r.id, r.user_id, r.product_id, r.created_at
      FROM reviews r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE p.id IS NULL
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    if (orphanProducts.rows.length > 0) {
      console.log(`1. Reviews with non-existent products: ${orphanProducts.rows.length}`);
      orphanProducts.rows.forEach(row => {
        console.log(`   - Review ${row.id} for user ${row.user_id}: product_id=${row.product_id}`);
      });
    } else {
      console.log('1. Reviews with non-existent products: 0');
    }

    // Check reviews with non-existent users
    const orphanUsers = await pool.query(`
      SELECT r.id, r.user_id, r.product_id, r.created_at
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE u.id IS NULL
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    if (orphanUsers.rows.length > 0) {
      console.log(`2. Reviews with non-existent users: ${orphanUsers.rows.length}`);
      orphanUsers.rows.forEach(row => {
        console.log(`   - Review ${row.id}: user_id=${row.user_id}, product_id=${row.product_id}`);
      });
    } else {
      console.log('2. Reviews with non-existent users: 0');
    }

    // Check reviews referencing disabled products
    const disabledProducts = await pool.query(`
      SELECT r.id, r.user_id, r.product_id, p.name, p.is_admin_disabled
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE p.is_admin_disabled = true
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    if (disabledProducts.rows.length > 0) {
      console.log(`3. Reviews referencing disabled products: ${disabledProducts.rows.length}`);
      disabledProducts.rows.forEach(row => {
        console.log(`   - Review ${row.id} for user ${row.user_id}: ${row.name} (disabled)`);
      });
    } else {
      console.log('3. Reviews referencing disabled products: 0');
    }

    const totalIssues = orphanProducts.rows.length + orphanUsers.rows.length + disabledProducts.rows.length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total orphan review issues: ${totalIssues}`);
    if (totalIssues > 0) {
      console.log('✗ Orphan review records detected - review above issues');
    } else {
      console.log('✓ No orphan review records found');
    }

  } catch (error) {
    console.error('Error checking orphan reviews:', error);
  } finally {
    await pool.end();
  }
}

checkOrphanReviews();
