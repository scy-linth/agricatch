const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkRecentOrders() {
  try {
    console.log('Checking recent orders...\n');

    // Get the 3 most recent orders
    const ordersResult = await pool.query(`
      SELECT id, user_id, product_id, quantity, total_amount, status, 
             is_preorder, delivery_address, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('Recent Orders:');
    console.log('===============');
    for (const order of ordersResult.rows) {
      console.log(`Order #${order.id}:`);
      console.log(`  Product ID: ${order.product_id}`);
      console.log(`  Quantity: ${order.quantity}`);
      console.log(`  Total: ₱${order.total_amount}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Is Pre-order: ${order.is_preorder}`);
      console.log(`  Delivery Address: ${order.delivery_address}`);
      console.log(`  Created At: ${order.created_at}`);
      console.log('');
    }

    // Check product stock and reserved quantities
    const productIds = ordersResult.rows.map(o => o.product_id);
    const productsResult = await pool.query(`
      SELECT id, name, stock_quantity, reserved_quantity, max_preorder_quantity
      FROM products
      WHERE id = ANY($1)
    `, [productIds]);

    console.log('\nProduct Stock Status:');
    console.log('=====================');
    for (const product of productsResult.rows) {
      console.log(`Product #${product.id} - ${product.name}:`);
      console.log(`  Stock Quantity: ${product.stock_quantity}`);
      console.log(`  Reserved Quantity: ${product.reserved_quantity}`);
      console.log(`  Max Pre-order Quantity: ${product.max_preorder_quantity}`);
      console.log('');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkRecentOrders();
