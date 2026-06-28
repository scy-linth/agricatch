const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkProductLifecycle() {
  console.log('=== PRODUCT LIFECYCLE CHECK ===\n');

  try {
    // Check Available Now products with 0 stock (should not be visible)
    const availableZeroStock = await pool.query(`
      SELECT p.id, p.name, p.stock_quantity, p.is_available, p.status, p.is_admin_disabled
      FROM products p
      WHERE p.is_available = true
        AND p.is_preorder = false
        AND p.is_admin_disabled = false
        AND (p.stock_quantity = 0 OR p.stock_quantity IS NULL)
      ORDER BY p.id
      LIMIT 50
    `);

    if (availableZeroStock.rows.length > 0) {
      console.log(`1. Available Now products with 0 stock (should not be visible): ${availableZeroStock.rows.length}`);
      availableZeroStock.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): stock=${row.stock_quantity}, status=${row.status}`);
      });
    } else {
      console.log('1. Available Now products with 0 stock: 0');
    }

    // Check pending products that are available (should not be visible)
    const pendingAvailable = await pool.query(`
      SELECT p.id, p.name, p.is_available, p.status, p.is_admin_disabled
      FROM products p
      WHERE p.status = 'pending'
        AND p.is_available = true
        AND p.is_admin_disabled = false
      ORDER BY p.id
      LIMIT 50
    `);

    if (pendingAvailable.rows.length > 0) {
      console.log(`2. Pending products marked as available (should not be visible): ${pendingAvailable.rows.length}`);
      pendingAvailable.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): is_available=${row.is_available}, status=${row.status}`);
      });
    } else {
      console.log('2. Pending products marked as available: 0');
    }

    // Check rejected products that are available (should not be visible)
    const rejectedAvailable = await pool.query(`
      SELECT p.id, p.name, p.is_available, p.status, p.is_admin_disabled
      FROM products p
      WHERE p.status = 'rejected'
        AND p.is_available = true
        AND p.is_admin_disabled = false
      ORDER BY p.id
      LIMIT 50
    `);

    if (rejectedAvailable.rows.length > 0) {
      console.log(`3. Rejected products marked as available (should not be visible): ${rejectedAvailable.rows.length}`);
      rejectedAvailable.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): is_available=${row.is_available}, status=${row.status}`);
      });
    } else {
      console.log('3. Rejected products marked as available: 0');
    }

    // Check disabled products that are available (should not be visible)
    const disabledAvailable = await pool.query(`
      SELECT p.id, p.name, p.is_available, p.status, p.is_admin_disabled
      FROM products p
      WHERE p.is_admin_disabled = true
        AND p.is_available = true
      ORDER BY p.id
      LIMIT 50
    `);

    if (disabledAvailable.rows.length > 0) {
      console.log(`4. Disabled products marked as available (should not be visible): ${disabledAvailable.rows.length}`);
      disabledAvailable.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): is_available=${row.is_available}, is_admin_disabled=${row.is_admin_disabled}`);
      });
    } else {
      console.log('4. Disabled products marked as available: 0');
    }

    // Check products with NULL status
    const nullStatus = await pool.query(`
      SELECT p.id, p.name, p.status, p.is_available
      FROM products p
      WHERE p.status IS NULL
      ORDER BY p.id
      LIMIT 50
    `);

    if (nullStatus.rows.length > 0) {
      console.log(`5. Products with NULL status: ${nullStatus.rows.length}`);
      nullStatus.rows.forEach(row => {
        console.log(`   - Product ${row.id} (${row.name}): status=${row.status}, is_available=${row.is_available}`);
      });
    } else {
      console.log('5. Products with NULL status: 0');
    }

    const totalIssues = availableZeroStock.rows.length + pendingAvailable.rows.length + rejectedAvailable.rows.length + disabledAvailable.rows.length + nullStatus.rows.length;
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total product lifecycle issues: ${totalIssues}`);
    if (totalIssues > 0) {
      console.log('✗ Product lifecycle issues detected - review above issues');
    } else {
      console.log('✓ No product lifecycle issues found');
    }

  } catch (error) {
    console.error('Error checking product lifecycle:', error);
  } finally {
    await pool.end();
  }
}

checkProductLifecycle();
