const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAllDeliveredOrders() {
  try {
    console.log('=== BUG 1 INVESTIGATION: All Delivered Orders ===\n');
    
    // Get all delivered orders
    const orderResult = await pool.query(
      `
        SELECT o.id, o.user_id, o.product_id, o.status, 
               o.delivered_at, o.updated_at, o.created_at,
               p.name as product_name, u.username
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.status = 'delivered'
        ORDER BY o.delivered_at DESC NULLS LAST, o.updated_at DESC
      `
    );
    
    console.log(`Total delivered orders: ${orderResult.rows.length}\n`);
    
    for (const order of orderResult.rows) {
      const deliveredRef = new Date(order.delivered_at || order.updated_at || order.created_at);
      const editableUntil = new Date(deliveredRef.getTime());
      editableUntil.setMonth(editableUntil.getMonth() + 1);
      
      const now = new Date();
      const allowed = !(now >= editableUntil);
      
      const daysSinceDelivery = Math.floor((now - deliveredRef) / (1000 * 60 * 60 * 24));
      
      console.log(`Order ${order.id} - ${order.product_name} (${order.username})`);
      console.log(`  delivered_at: ${order.delivered_at}`);
      console.log(`  Days since delivery: ${daysSinceDelivery}`);
      console.log(`  Backend allowed: ${allowed}`);
      console.log(`  editableUntil: ${editableUntil.toISOString()}`);
      console.log();
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkAllDeliveredOrders();
