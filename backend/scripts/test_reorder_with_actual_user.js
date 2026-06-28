const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testReorderWithActualUser() {
  try {
    console.log('=== BUG 2 INVESTIGATION: Actual User Reorder Test ===\n');
    
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
               p.name as product_name, p.is_available, p.is_preorder,
               p.stock_quantity, p.expiry_date, p.is_admin_disabled,
               p.linked_product_id, p.farmer_id,
           u.username as farmer_username, u.is_disabled as farmer_disabled
        FROM orders o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN users u ON u.id = p.farmer_id
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
      console.log(`\nProduct Status:`);
      console.log(`is_available: ${order.is_available}`);
      console.log(`is_preorder: ${order.is_preorder}`);
      console.log(`stock_quantity: ${order.stock_quantity}`);
      console.log(`expiry_date: ${order.expiry_date}`);
      console.log(`is_admin_disabled: ${order.is_admin_disabled}`);
      console.log(`farmer_disabled: ${order.farmer_disabled}`);
      console.log(`linked_product_id: ${order.linked_product_id}`);
      
      // Simulate cart endpoint validation
      console.log(`\nCart Endpoint Validation (productId: ${order.product_id}):`);
      
      if (!order.is_available) {
        console.log(`FAIL: is_available = false`);
      } else if (order.is_admin_disabled) {
        console.log(`FAIL: is_admin_disabled = true`);
      } else if (order.farmer_disabled) {
        console.log(`FAIL: farmer_disabled = true`);
      } else if (order.expiry_date && new Date(order.expiry_date) < new Date(new Date().toDateString())) {
        console.log(`FAIL: Product expired`);
      } else {
        console.log(`PASS: Product is available for cart`);
      }
      
      // Check linked product if exists
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
          console.log(`\nLinked Product (${linked.name}, ID: ${linked.id}):`);
          console.log(`is_available: ${linked.is_available}`);
          console.log(`is_preorder: ${linked.is_preorder}`);
          console.log(`stock_quantity: ${linked.stock_quantity}`);
          console.log(`Note: Reorder uses original product_id (${order.product_id}), not linked product`);
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testReorderWithActualUser();
