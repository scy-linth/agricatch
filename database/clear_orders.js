// Script to clear all orders from the database
// Run with: node database/clear_orders.js

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { Pool } = require('pg');

const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: pgSsl,
});

async function clearAllOrders() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🗑️  Starting to clear all orders...\n');

    // Step 1: Delete from tables that reference orders
    console.log('Deleting order items...');
    const orderItemsResult = await client.query('DELETE FROM order_items RETURNING id');
    console.log(`   ✓ Deleted ${orderItemsResult.rowCount} order items`);

    console.log('Deleting order-related notifications...');
    const notificationsResult = await client.query('DELETE FROM notifications WHERE order_id IS NOT NULL RETURNING id');
    console.log(`   ✓ Deleted ${notificationsResult.rowCount} notifications`);

    // Refunds table removed - no refunds to delete

    // Step 2: Handle self-referencing replacement_order_id (if column exists)
    // Check if column exists first to avoid transaction abort
    console.log('Checking for replacement_order_id column...');
    try {
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'replacement_order_id'
      `);
      
      if (columnCheck.rows.length > 0) {
        console.log('Clearing replacement order references...');
        const replacementResult = await client.query('UPDATE orders SET replacement_order_id = NULL WHERE replacement_order_id IS NOT NULL RETURNING id');
        console.log(`   ✓ Cleared ${replacementResult.rowCount} replacement order references`);
      } else {
        console.log('   ⚠ Column replacement_order_id does not exist - skipping');
      }
    } catch (error) {
      console.log('   ⚠ Could not check for replacement_order_id column - skipping');
    }

    // Step 3: Delete all orders
    console.log('Deleting all orders...');
    const ordersResult = await client.query('DELETE FROM orders RETURNING id, status');
    console.log(`   ✓ Deleted ${ordersResult.rowCount} orders`);
    
    // Show breakdown by status
    if (ordersResult.rows.length > 0) {
      const statusCounts = {};
      ordersResult.rows.forEach(row => {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      });
      console.log('\n   Status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     - ${status}: ${count}`);
      });
    }

    // Step 4: Reset sequences
    console.log('\nResetting sequences...');
    await client.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE order_items_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE notifications_id_seq RESTART WITH 1');
    console.log('   ✓ Sequences reset');

    await client.query('COMMIT');

    // Verify deletion
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM orders');
    const remainingOrders = verifyResult.rows[0].count;

    console.log('\n✅ All orders have been deleted successfully!');
    console.log(`   Remaining orders: ${remainingOrders}\n`);

    console.log('\n📱 IMPORTANT: Clear Browser Cache Now!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Option 1: Open this file in your browser:');
    console.log('   file:///' + require('path').join(__dirname, '../frontend/clear_cache.html').replace(/\\/g, '/'));
    console.log('\nOption 2: Open browser console (F12) and run:');
    console.log('   localStorage.clear();');
    console.log('   sessionStorage.clear();');
    console.log('   location.reload();');
    console.log('\nOption 3: Hard refresh all pages:');
    console.log('   Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing orders:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearAllOrders()
  .then(() => {
    console.log('Database refresh completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to clear orders:', error);
    process.exit(1);
  });
