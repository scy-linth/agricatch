const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function traceReorderFlow() {
  try {
    console.log('=== BUG 2 INVESTIGATION: Complete Reorder Flow Trace ===\n');
    
    // Get testcustomer's order 286 (Fresh Carrots, delivered today)
    const orderResult = await pool.query(
      `
        SELECT o.id, o.user_id, o.product_id, o.status, 
               o.delivered_at, o.updated_at, o.created_at,
               p.name as product_name, p.is_available, p.is_preorder,
               p.stock_quantity, p.expiry_date, p.is_admin_disabled,
               p.linked_product_id, p.farmer_id,
           u.username as farmer_username, u.is_disabled as farmer_disabled
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN users u ON u.id = p.farmer_id
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
    console.log(`Product: ${order.product_name} (ID: ${order.product_id})`);
    console.log(`Status: ${order.status}`);
    
    console.log('\n=== STEP 1: Frontend Reorder Click ===');
    console.log(`reorder(orderId: ${order.id})`);
    console.log(`Extracts productId: ${order.product_id}`);
    console.log(`Extracts quantity: 1`);
    
    console.log('\n=== STEP 2: Frontend Payload ===');
    console.log(`POST /api/cart`);
    console.log(`Body: { productId: ${order.product_id}, quantity: 1 }`);
    console.log(`Headers: Authorization: Bearer <token>`);
    
    console.log('\n=== STEP 3: Backend Cart Endpoint ===');
    console.log(`productId: ${order.product_id}`);
    console.log(`quantity: 1`);
    
    console.log('\n=== STEP 4: Product Lookup ===');
    console.log(`SELECT * FROM products WHERE id = ${order.product_id}`);
    console.log(`Product found: YES`);
    console.log(`is_available: ${order.is_available}`);
    console.log(`is_preorder: ${order.is_preorder}`);
    console.log(`stock_quantity: ${order.stock_quantity}`);
    console.log(`expiry_date: ${order.expiry_date}`);
    console.log(`is_admin_disabled: ${order.is_admin_disabled}`);
    console.log(`farmer_disabled: ${order.farmer_disabled}`);
    console.log(`linked_product_id: ${order.linked_product_id}`);
    
    console.log('\n=== STEP 5: Availability Validation ===');
    if (!order.is_available) {
      console.log(`FAIL: is_available = false`);
      console.log(`Error: "Product is not available"`);
    } else if (order.is_admin_disabled) {
      console.log(`FAIL: is_admin_disabled = true`);
      console.log(`Error: "Product is not available"`);
    } else if (order.farmer_disabled) {
      console.log(`FAIL: farmer_disabled = true`);
      console.log(`Error: "Product is not available"`);
    } else if (order.expiry_date && new Date(order.expiry_date) < new Date(new Date().toDateString())) {
      console.log(`FAIL: Product expired`);
      console.log(`Error: "Product is already expired"`);
    } else {
      console.log(`PASS: All validations passed`);
      console.log(`Product added to cart`);
    }
    
    console.log('\n=== STEP 6: Linked Product Check ===');
    if (order.linked_product_id) {
      const linkedResult = await pool.query(
        `
          SELECT id, name, is_available, is_preorder, stock_quantity, 
                 expiry_date, is_admin_disabled, farmer_id
          FROM products
          WHERE id = $1
        `,
        [order.linked_product_id]
      );
      
      if (linkedResult.rows.length) {
        const linked = linkedResult.rows[0];
        console.log(`Linked Product: ${linked.name} (ID: ${linked.id})`);
        console.log(`is_available: ${linked.is_available}`);
        console.log(`is_preorder: ${linked.is_preorder}`);
        console.log(`Note: Reorder uses original product_id (${order.product_id}), not linked product`);
      }
    } else {
      console.log(`No linked product`);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

traceReorderFlow();
