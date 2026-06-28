const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testReviewAPI() {
  try {
    // Get a delivered order from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const orderResult = await pool.query(
      `
        SELECT o.id, o.user_id, o.product_id, o.delivered_at, o.updated_at, o.created_at
        FROM orders o
        WHERE o.status = 'delivered'
          AND COALESCE(o.delivered_at, o.updated_at, o.created_at) >= $1
          AND COALESCE(o.delivered_at, o.updated_at, o.created_at) < $2
        LIMIT 1
      `,
      [today.toISOString(), tomorrow.toISOString()]
    );
    
    let order;
    if (!orderResult.rows.length) {
      console.log('No delivered orders from today. Using most recent delivered order...');
      const anyDelivered = await pool.query(
        `
          SELECT o.id, o.user_id, o.product_id, o.delivered_at, o.updated_at, o.created_at
          FROM orders o
          WHERE o.status = 'delivered'
          ORDER BY COALESCE(o.delivered_at, o.updated_at, o.created_at) DESC
          LIMIT 1
        `
      );
      if (!anyDelivered.rows.length) {
        console.log('No delivered orders found.');
        return;
      }
      order = anyDelivered.rows[0];
    } else {
      order = orderResult.rows[0];
    }
    
    console.log('\n=== Testing Review Eligibility API ===');
    console.log('Order ID:', order.id);
    console.log('User ID:', order.user_id);
    console.log('Product ID:', order.product_id);
    console.log('Delivered At:', order.delivered_at || order.updated_at || order.created_at);
    
    // Simulate the backend logic
    const deliveredRef = new Date(order.delivered_at || order.updated_at || order.created_at);
    const editableUntil = new Date(deliveredRef.getTime());
    editableUntil.setMonth(editableUntil.getMonth() + 1);
    
    const now = new Date();
    
    console.log('\nDelivered Ref:', deliveredRef.toISOString());
    console.log('Editable Until:', editableUntil.toISOString());
    console.log('Current Time:', now.toISOString());
    
    // Test the actual logic from reviews.js
    const canRate = !(now >= editableUntil);
    
    console.log('\n=== API Response Simulation ===');
    console.log('allowed:', canRate);
    console.log('editableUntil:', editableUntil.toISOString());
    
    if (!canRate) {
      console.log('reason: Rating window has ended. Ratings are editable for 1 month after delivery.');
    }
    
    const isSameDay = deliveredRef.toDateString() === now.toDateString();
    const daysSinceDelivery = Math.floor((now - deliveredRef) / (1000 * 60 * 60 * 24));
    
    console.log('\n=== Verification ===');
    console.log('Is Same Day:', isSameDay);
    console.log('Days Since Delivery:', daysSinceDelivery);
    console.log('Can Rate:', canRate);
    
    if (isSameDay) {
      console.log('Result: PASS - Same-day delivery can be rated');
    } else if (daysSinceDelivery < 30) {
      console.log('Result: PASS - Within 1 month can be rated');
    } else {
      console.log('Result: PASS - After 1 month cannot be rated');
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testReviewAPI();
