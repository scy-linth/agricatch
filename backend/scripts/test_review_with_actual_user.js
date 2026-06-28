const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testReviewWithActualUser() {
  try {
    console.log('=== BUG 1 INVESTIGATION: Actual User Test ===\n');
    
    // Get testcustomer's delivered orders
    const userResult = await pool.query(
      `SELECT id, username FROM users WHERE username = 'testcustomer'`
    );
    
    if (!userResult.rows.length) {
      console.log('testcustomer not found.');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`User: ${user.username} (ID: ${user.id})\n`);
    
    // Get delivered orders for this user
    const orderResult = await pool.query(
      `
        SELECT o.id, o.product_id, o.status, 
               o.delivered_at, o.updated_at, o.created_at,
               p.name as product_name
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        WHERE o.user_id = $1 AND o.status = 'delivered'
        ORDER BY o.delivered_at DESC NULLS LAST, o.updated_at DESC
        LIMIT 3
      `,
      [user.id]
    );
    
    if (!orderResult.rows.length) {
      console.log('No delivered orders found for testcustomer.');
      return;
    }
    
    for (const order of orderResult.rows) {
      console.log(`\n=== Order ${order.id}: ${order.product_name} ===`);
      console.log(`Product ID: ${order.product_id}`);
      console.log(`delivered_at: ${order.delivered_at}`);
      console.log(`updated_at: ${order.updated_at}`);
      console.log(`created_at: ${order.created_at}`);
      
      // Call getRatingEligibility with actual user ID and product ID
      const eligibility = await getRatingEligibility(user.id, order.product_id);
      console.log(`\ngetRatingEligibility Result:`);
      console.log(JSON.stringify(eligibility, null, 2));
      
      // Check if there's a review already
      const reviewResult = await pool.query(
        `SELECT id, rating, comment FROM reviews WHERE user_id = $1 AND product_id = $2`,
        [user.id, order.product_id]
      );
      
      console.log(`\nExisting review: ${reviewResult.rows.length > 0 ? 'Yes' : 'No'}`);
      if (reviewResult.rows.length) {
        console.log(JSON.stringify(reviewResult.rows[0], null, 2));
      }
    }
    
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

testReviewWithActualUser();
