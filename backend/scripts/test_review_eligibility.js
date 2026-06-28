const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testReviewEligibility() {
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
    
    if (!orderResult.rows.length) {
      console.log('No delivered orders found from today. Creating test scenario...');
      
      // Find any delivered order to test the logic
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
        console.log('No delivered orders found at all.');
        return;
      }
      
      const order = anyDelivered.rows[0];
      await testEligibility(order);
    } else {
      const order = orderResult.rows[0];
      console.log('Found delivered order from today:', order.id);
      await testEligibility(order);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

async function testEligibility(order) {
  const deliveredRef = new Date(order.delivered_at || order.updated_at || order.created_at);
  const editableUntil = new Date(deliveredRef.getTime());
  editableUntil.setMonth(editableUntil.getMonth() + 1);
  
  const now = new Date();
  
  console.log('\n=== Review Eligibility Test ===');
  console.log('Order ID:', order.id);
  console.log('User ID:', order.user_id);
  console.log('Product ID:', order.product_id);
  console.log('Delivered Ref:', deliveredRef.toISOString());
  console.log('Editable Until:', editableUntil.toISOString());
  console.log('Current Time:', now.toISOString());
  console.log('\nTime Difference (hours):', (editableUntil - now) / (1000 * 60 * 60));
  
  // Test the OLD logic (>)
  const oldLogic = now > editableUntil;
  console.log('\nOLD LOGIC (now > editableUntil):', oldLogic);
  console.log('OLD LOGIC - Can Rate:', !oldLogic);
  
  // Test the NEW logic (>=)
  const newLogic = now >= editableUntil;
  console.log('\nNEW LOGIC (now >= editableUntil):', newLogic);
  console.log('NEW LOGIC - Can Rate:', !newLogic);
  
  // Expected behavior
  const isSameDay = deliveredRef.toDateString() === now.toDateString();
  console.log('\nIs Same Day Delivery:', isSameDay);
  
  if (isSameDay) {
    console.log('Expected: Should be able to rate (same-day delivery)');
    console.log('Fix Status:', !newLogic ? 'PASS - Can rate same-day' : 'FAIL - Cannot rate same-day');
  } else {
    const daysSinceDelivery = Math.floor((now - deliveredRef) / (1000 * 60 * 60 * 24));
    console.log('Days Since Delivery:', daysSinceDelivery);
    
    if (daysSinceDelivery < 30) {
      console.log('Expected: Should be able to rate (within 1 month)');
      console.log('Fix Status:', !newLogic ? 'PASS - Can rate within window' : 'FAIL - Cannot rate within window');
    } else {
      console.log('Expected: Should NOT be able to rate (after 1 month)');
      console.log('Fix Status:', newLogic ? 'PASS - Cannot rate after window' : 'FAIL - Can rate after window');
    }
  }
}

testReviewEligibility();
