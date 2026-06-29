const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkProduct12Eligibility() {
  try {
    console.log('=== Product 12 (Brown rice) Review Eligibility Check ===\n');
    
    // Get product 12 info
    const productResult = await pool.query(
      `SELECT id, name, farmer_id FROM products WHERE id = 12`
    );
    
    if (!productResult.rows.length) {
      console.log('Product 12 not found');
      return;
    }
    
    const product = productResult.rows[0];
    console.log(`Product: ${product.name} (ID: ${product.id})\n`);
    
    // Get all orders for product 12
    const orderResult = await pool.query(
      `
        SELECT o.id, o.user_id, o.status, 
               o.delivered_at, o.updated_at, o.created_at,
               u.username
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.product_id = 12
        ORDER BY o.created_at DESC
      `
    );
    
    console.log(`Total orders for product 12: ${orderResult.rows.length}\n`);
    
    for (const order of orderResult.rows) {
      const deliveredRef = new Date(order.delivered_at || order.updated_at || order.created_at);
      const editableUntil = new Date(deliveredRef.getTime());
      editableUntil.setMonth(editableUntil.getMonth() + 1);
      
      const now = new Date();
      const allowed = order.status === 'delivered' && !(now >= editableUntil);
      
      const daysSinceDelivery = Math.floor((now - deliveredRef) / (1000 * 60 * 60 * 24));
      
      console.log(`Order ${order.id} - ${order.username}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  delivered_at: ${order.delivered_at}`);
      console.log(`  Days since delivery: ${daysSinceDelivery}`);
      console.log(`  Can rate: ${allowed}`);
      console.log(`  Reason: ${order.status !== 'delivered' ? 'Order not delivered' : (now >= editableUntil ? 'Rating window expired (1 month)' : 'Within rating window')}`);
      console.log(`  editableUntil: ${editableUntil.toISOString()}`);
      console.log();
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkProduct12Eligibility();
