const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testReviewAPIEndpoint() {
  try {
    console.log('=== BUG 1 INVESTIGATION: API Endpoint Test ===\n');
    
    // Get a delivered order
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
        LIMIT 1
      `
    );
    
    if (!orderResult.rows.length) {
      console.log('No delivered orders found.');
      return;
    }
    
    const order = orderResult.rows[0];
    console.log('Test Order:');
    console.log(`Order ID: ${order.id}`);
    console.log(`User: ${order.username} (ID: ${order.user_id})`);
    console.log(`Product: ${order.product_name} (ID: ${order.product_id})`);
    console.log(`Status: ${order.status}`);
    console.log(`delivered_at: ${order.delivered_at}\n`);
    
    // Generate a test token
    const token = jwt.sign(
      { id: order.user_id, username: order.username, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('=== Calling getRatingEligibility function directly ===');
    const eligibility = await getRatingEligibility(order.user_id, order.product_id);
    console.log('Result:', JSON.stringify(eligibility, null, 2));
    
    console.log('\n=== Simulating API response ===');
    const apiResponse = {
      can_rate: eligibility.allowed,
      reason: eligibility.reason || null,
      editable_until: eligibility.editableUntil ? eligibility.editableUntil.toISOString() : null
    };
    console.log('API Response:', JSON.stringify(apiResponse, null, 2));
    
    console.log('\n=== Frontend check ===');
    console.log(`eligibilityRes.ok: true (simulated)`);
    console.log(`eligibility?.can_rate: ${apiResponse.can_rate}`);
    console.log(`Should open modal: ${apiResponse.can_rate}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

async function getRatingEligibility(userId, productId) {
  const deliveredOrderResult = await pool.query(
    `
      SELECT COALESCE(delivered_at, updated_at, created_at) AS delivered_ref
      FROM orders
      WHERE user_id = $1
        AND product_id = $2
        AND status = 'delivered'
      ORDER BY COALESCE(delivered_at, updated_at, created_at) DESC
      LIMIT 1
    `,
    [userId, productId]
  );

  if (!deliveredOrderResult.rows.length) {
    return {
      allowed: false,
      reason: 'You can rate this product only after a delivered order.'
    };
  }

  const deliveredRef = new Date(deliveredOrderResult.rows[0].delivered_ref);
  const editableUntil = new Date(deliveredRef.getTime());
  editableUntil.setMonth(editableUntil.getMonth() + 1);

  if (Number.isNaN(editableUntil.getTime())) {
    return {
      allowed: false,
      reason: 'Unable to validate delivery date for rating eligibility.'
    };
  }

  const now = new Date();
  if (now >= editableUntil) {
    return {
      allowed: false,
      reason: 'Rating window has ended. Ratings are editable for 1 month after delivery.',
      editableUntil
    };
  }

  return {
    allowed: true,
    editableUntil
  };
}

testReviewAPIEndpoint();
