const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function investigateReviewBug() {
  try {
    console.log('=== BUG 1 INVESTIGATION: Review Validation ===\n');
    
    // Get a delivered order
    const orderResult = await pool.query(
      `
        SELECT o.id, o.user_id, o.product_id, o.status, 
               o.delivered_at, o.updated_at, o.created_at,
               p.name as product_name
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        WHERE o.status = 'delivered'
        ORDER BY o.delivered_at DESC NULLS LAST, o.updated_at DESC
        LIMIT 5
      `
    );
    
    if (!orderResult.rows.length) {
      console.log('No delivered orders found.');
      return;
    }
    
    console.log('=== DELIVERED ORDERS ===');
    for (const order of orderResult.rows) {
      console.log(`\nOrder ID: ${order.id}`);
      console.log(`Product: ${order.product_name}`);
      console.log(`Status: ${order.status}`);
      console.log(`delivered_at: ${order.delivered_at}`);
      console.log(`updated_at: ${order.updated_at}`);
      console.log(`created_at: ${order.created_at}`);
      
      // Simulate backend logic
      const deliveredRef = new Date(order.delivered_at || order.updated_at || order.created_at);
      const editableUntil = new Date(deliveredRef.getTime());
      editableUntil.setMonth(editableUntil.getMonth() + 1);
      
      const now = new Date();
      
      console.log(`\nBackend Calculation:`);
      console.log(`delivered_ref: ${deliveredRef.toISOString()}`);
      console.log(`editable_until: ${editableUntil.toISOString()}`);
      console.log(`now: ${now.toISOString()}`);
      console.log(`now >= editableUntil: ${now >= editableUntil}`);
      console.log(`allowed: ${!(now >= editableUntil)}`);
      
      // Simulate frontend logic
      const deliveredAtRaw = order.delivered_at;
      const isDelivered = order.status === 'delivered';
      const deliveredAt = deliveredAtRaw ? new Date(deliveredAtRaw) : null;
      const ratingDeadline = deliveredAt && !Number.isNaN(deliveredAt.getTime()) ? new Date(deliveredAt.getTime()) : null;
      if (ratingDeadline) ratingDeadline.setMonth(ratingDeadline.getMonth() + 1);
      const canRateNow = isDelivered && ratingDeadline && new Date() <= ratingDeadline;
      
      console.log(`\nFrontend Calculation:`);
      console.log(`deliveredAtRaw: ${deliveredAtRaw}`);
      console.log(`isDelivered: ${isDelivered}`);
      console.log(`deliveredAt: ${deliveredAt ? deliveredAt.toISOString() : 'null'}`);
      console.log(`ratingDeadline: ${ratingDeadline ? ratingDeadline.toISOString() : 'null'}`);
      console.log(`new Date() <= ratingDeadline: ${ratingDeadline ? new Date() <= ratingDeadline : 'N/A'}`);
      console.log(`canRateNow: ${canRateNow}`);
      
      console.log(`\n---`);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

investigateReviewBug();
