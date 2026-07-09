// Backfill delivered_at for existing delivered orders
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration: backfill delivered_at for delivered orders...\n');
    
    await client.query('BEGIN');
    
    // Check current state
    const checkResult = await client.query(`
      SELECT 
        COUNT(*) as total_delivered_orders,
        COUNT(delivered_at) as orders_with_delivered_at,
        COUNT(*) - COUNT(delivered_at) as orders_still_missing_delivered_at
      FROM orders 
      WHERE status = 'delivered'
    `);
    
    console.log('Before migration:');
    console.log(`  Total delivered orders: ${checkResult.rows[0].total_delivered_orders}`);
    console.log(`  Orders with delivered_at: ${checkResult.rows[0].orders_with_delivered_at}`);
    console.log(`  Orders missing delivered_at: ${checkResult.rows[0].orders_still_missing_delivered_at}\n`);
    
    // Update orders table: backfill delivered_at using updated_at for delivered orders with null delivered_at
    const updateOrdersResult = await client.query(`
      UPDATE orders
      SET delivered_at = COALESCE(
        (SELECT created_at FROM order_status_history 
         WHERE order_id = orders.id AND status = 'delivered' 
         ORDER BY created_at DESC LIMIT 1),
        updated_at,
        created_at
      )
      WHERE status = 'delivered' 
        AND delivered_at IS NULL
      RETURNING id
    `);
    
    console.log(`✓ Updated ${updateOrdersResult.rowCount} orders with delivered_at`);
    
    // Update order_items table: backfill delivered_at using the parent order's delivered_at
    const updateItemsResult = await client.query(`
      UPDATE order_items oi
      SET delivered_at = (
        SELECT delivered_at FROM orders o 
        WHERE o.id = oi.order_id 
        LIMIT 1
      )
      WHERE oi.delivered_at IS NULL
        AND EXISTS (
          SELECT 1 FROM orders o 
          WHERE o.id = oi.order_id AND o.status = 'delivered'
        )
      RETURNING id
    `);
    
    console.log(`✓ Updated ${updateItemsResult.rowCount} order_items with delivered_at`);
    
    await client.query('COMMIT');
    
    // Verify the backfill
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_delivered_orders,
        COUNT(delivered_at) as orders_with_delivered_at,
        COUNT(*) - COUNT(delivered_at) as orders_still_missing_delivered_at
      FROM orders 
      WHERE status = 'delivered'
    `);
    
    console.log('\nAfter migration:');
    console.log(`  Total delivered orders: ${verifyResult.rows[0].total_delivered_orders}`);
    console.log(`  Orders with delivered_at: ${verifyResult.rows[0].orders_with_delivered_at}`);
    console.log(`  Orders missing delivered_at: ${verifyResult.rows[0].orders_still_missing_delivered_at}`);
    
    console.log('\n✓ Migration complete!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
