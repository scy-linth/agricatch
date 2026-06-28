const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function repairDatabaseIntegrity() {
  console.log('=== DATABASE INTEGRITY REPAIR ===\n');

  const client = await pool.connect();
  let totalRepaired = 0;

  try {
    await client.query('BEGIN');

    // 1. Delete orphan cart items referencing disabled products
    console.log('1. Cleaning orphan cart items referencing disabled products...');
    const cartDeleteResult = await client.query(`
      DELETE FROM cart
      WHERE product_id IN (
        SELECT p.id FROM products p WHERE p.is_admin_disabled = true
      )
    `);
    console.log(`   - Deleted ${cartDeleteResult.rowCount} orphan cart items`);
    totalRepaired += cartDeleteResult.rowCount;

    // 2. Delete orphan notifications referencing non-existent orders
    console.log('2. Cleaning orphan notifications referencing non-existent orders...');
    const notifDeleteResult = await client.query(`
      DELETE FROM notifications
      WHERE order_id IS NOT NULL
        AND order_id NOT IN (SELECT id FROM orders)
    `);
    console.log(`   - Deleted ${notifDeleteResult.rowCount} orphan notifications`);
    totalRepaired += notifDeleteResult.rowCount;

    // 3. Fix NULL stock for preorder products (set to 0)
    console.log('3. Fixing NULL stock for preorder products...');
    const stockNullResult = await client.query(`
      UPDATE products
      SET stock_quantity = 0
      WHERE is_preorder = true AND stock_quantity IS NULL
    `);
    console.log(`   - Fixed ${stockNullResult.rowCount} products with NULL stock`);
    totalRepaired += stockNullResult.rowCount;

    // 4. Fix reserved > stock for Kangkong (set reserved to 0)
    console.log('4. Fixing reserved > stock for preorder products...');
    const reservedFixResult = await client.query(`
      UPDATE products
      SET reserved_quantity = 0
      WHERE is_preorder = true
        AND stock_quantity IS NOT NULL
        AND reserved_quantity > stock_quantity
    `);
    console.log(`   - Fixed ${reservedFixResult.rowCount} products with reserved > stock`);
    totalRepaired += reservedFixResult.rowCount;

    // 5. Fix available products with 0 stock (set is_available = false)
    console.log('5. Fixing available products with 0 stock...');
    const availableFixResult = await client.query(`
      UPDATE products
      SET is_available = false
      WHERE is_available = true
        AND is_preorder = false
        AND is_admin_disabled = false
        AND (stock_quantity = 0 OR stock_quantity IS NULL)
    `);
    console.log(`   - Fixed ${availableFixResult.rowCount} available products with 0 stock`);
    totalRepaired += availableFixResult.rowCount;

    await client.query('COMMIT');
    console.log(`\n=== REPAIR COMPLETE ===`);
    console.log(`Total records repaired: ${totalRepaired}`);
    console.log('✓ Database integrity repairs applied successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error repairing database:', error);
    console.log('✗ Repair failed - changes rolled back');
  } finally {
    client.release();
    await pool.end();
  }
}

repairDatabaseIntegrity();
