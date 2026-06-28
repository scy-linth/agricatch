const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function investigateReorderBug() {
  try {
    console.log('=== BUG 2 INVESTIGATION: Reorder Button ===\n');
    
    // Get a delivered order
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
        WHERE o.status = 'delivered'
        ORDER BY o.delivered_at DESC NULLS LAST, o.updated_at DESC
        LIMIT 5
      `
    );
    
    if (!orderResult.rows.length) {
      console.log('No delivered orders found.');
      return;
    }
    
    console.log('=== DELIVERED ORDERS FOR REORDER TEST ===');
    for (const order of orderResult.rows) {
      console.log(`\nOrder ID: ${order.id}`);
      console.log(`Product: ${order.product_name} (ID: ${order.product_id})`);
      console.log(`Status: ${order.status}`);
      console.log(`\nProduct Status:`);
      console.log(`is_available: ${order.is_available}`);
      console.log(`is_preorder: ${order.is_preorder}`);
      console.log(`stock_quantity: ${order.stock_quantity}`);
      console.log(`expiry_date: ${order.expiry_date}`);
      console.log(`is_admin_disabled: ${order.is_admin_disabled}`);
      console.log(`farmer_disabled: ${order.farmer_disabled}`);
      console.log(`linked_product_id: ${order.linked_product_id}`);
      
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
          console.log(`expiry_date: ${linked.expiry_date}`);
          console.log(`is_admin_disabled: ${linked.is_admin_disabled}`);
        }
      }
      
      // Simulate cart endpoint validation
      console.log(`\nCart Endpoint Validation:`);
      console.log(`Product exists: true`);
      console.log(`is_admin_disabled: ${order.is_admin_disabled} -> ${order.is_admin_disabled ? 'BLOCK' : 'PASS'}`);
      console.log(`farmer_disabled: ${order.farmer_disabled} -> ${order.farmer_disabled ? 'BLOCK' : 'PASS'}`);
      console.log(`is_available: ${order.is_available} -> ${!order.is_available ? 'BLOCK' : 'PASS'}`);
      
      if (order.expiry_date) {
        const isExpired = new Date(order.expiry_date) < new Date(new Date().toDateString());
        console.log(`expiry_date check: ${isExpired ? 'BLOCK (expired)' : 'PASS'}`);
      }
      
      console.log(`\n---`);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

investigateReorderBug();
