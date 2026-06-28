const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function traceReviewFlow() {
  try {
    console.log('=== BUG 1 INVESTIGATION: Complete Flow Trace ===\n');
    
    // Get testcustomer's order 286 (Fresh Carrots, delivered today)
    const orderResult = await pool.query(
      `
        SELECT o.id, o.user_id, o.product_id, o.status, 
               o.delivered_at, o.updated_at, o.created_at,
               p.name as product_name, u.username
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.id = 286
      `
    );
    
    if (!orderResult.rows.length) {
      console.log('Order 286 not found.');
      return;
    }
    
    const order = orderResult.rows[0];
    console.log('=== ORDER DETAILS ===');
    console.log(`Order ID: ${order.id}`);
    console.log(`User: ${order.username} (ID: ${order.user_id})`);
    console.log(`Product: ${order.product_name} (ID: ${order.product_id})`);
    console.log(`Status: ${order.status}`);
    console.log(`delivered_at: ${order.delivered_at}`);
    console.log(`updated_at: ${order.updated_at}`);
    console.log(`created_at: ${order.created_at}`);
    
    console.log('\n=== STEP 1: Frontend Button Display ===');
    const deliveredAtRaw = order.delivered_at;
    const isDelivered = order.status === 'delivered';
    const deliveredAt = deliveredAtRaw ? new Date(deliveredAtRaw) : null;
    const ratingDeadline = deliveredAt && !Number.isNaN(deliveredAt.getTime()) ? new Date(deliveredAt.getTime()) : null;
    if (ratingDeadline) ratingDeadline.setMonth(ratingDeadline.getMonth() + 1);
    const canRateNow = isDelivered && ratingDeadline && new Date() <= ratingDeadline;
    
    console.log(`deliveredAtRaw: ${deliveredAtRaw}`);
    console.log(`isDelivered: ${isDelivered}`);
    console.log(`deliveredAt: ${deliveredAt ? deliveredAt.toISOString() : 'null'}`);
    console.log(`ratingDeadline: ${ratingDeadline ? ratingDeadline.toISOString() : 'null'}`);
    console.log(`new Date() <= ratingDeadline: ${ratingDeadline ? new Date() <= ratingDeadline : 'N/A'}`);
    console.log(`canRateNow: ${canRateNow}`);
    console.log(`Button should show: ${canRateNow ? 'YES (Rate Product)' : 'NO (Rating Closed)'}`);
    
    console.log('\n=== STEP 2: API Request ===');
    console.log(`GET /api/products/${order.product_id}/reviews/eligibility`);
    console.log(`Headers: Authorization: Bearer <token>`);
    
    console.log('\n=== STEP 3: Backend getRatingEligibility ===');
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
      [order.user_id, order.product_id]
    );
    
    console.log(`Found delivered order: ${deliveredOrderResult.rows.length > 0 ? 'YES' : 'NO'}`);
    
    if (deliveredOrderResult.rows.length) {
      const deliveredRef = new Date(deliveredOrderResult.rows[0].delivered_ref);
      const editableUntil = new Date(deliveredRef.getTime());
      editableUntil.setMonth(editableUntil.getMonth() + 1);
      
      const now = new Date();
      
      console.log(`delivered_ref: ${deliveredRef.toISOString()}`);
      console.log(`editableUntil: ${editableUntil.toISOString()}`);
      console.log(`now: ${now.toISOString()}`);
      console.log(`now >= editableUntil: ${now >= editableUntil}`);
      console.log(`allowed: ${!(now >= editableUntil)}`);
    }
    
    console.log('\n=== STEP 4: API Response ===');
    const eligibility = await getRatingEligibility(order.user_id, order.product_id);
    console.log(`can_rate: ${eligibility.allowed}`);
    console.log(`reason: ${eligibility.reason || 'null'}`);
    console.log(`editable_until: ${eligibility.editableUntil ? eligibility.editableUntil.toISOString() : 'null'}`);
    
    console.log('\n=== STEP 5: Frontend Check ===');
    console.log(`eligibilityRes.ok: true (simulated)`);
    console.log(`eligibility?.can_rate: ${eligibility.allowed}`);
    console.log(`Should open modal: ${eligibility.allowed}`);
    
    console.log('\n=== STEP 6: Existing Review Check ===');
    const reviewResult = await pool.query(
      `SELECT id, rating, comment FROM reviews WHERE user_id = $1 AND product_id = $2`,
      [order.user_id, order.product_id]
    );
    console.log(`Existing review: ${reviewResult.rows.length > 0 ? 'YES' : 'NO'}`);
    if (reviewResult.rows.length) {
      console.log(`Review ID: ${reviewResult.rows[0].id}`);
      console.log(`Rating: ${reviewResult.rows[0].rating}`);
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

traceReviewFlow();
