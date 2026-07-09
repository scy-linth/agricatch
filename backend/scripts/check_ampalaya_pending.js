const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAmpalayaPending() {
  try {
    const email = 'dhelhilis@gmail.com';
    console.log(`Checking Ampalaya pending orders for farmer: ${email}\n`);

    // Get user info
    const userResult = await pool.query(`
      SELECT id, email, full_name, role
      FROM users
      WHERE email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      console.log('User not found');
      await pool.end();
      return;
    }

    const user = userResult.rows[0];
    console.log(`User ID: ${user.id}`);
    console.log(`Name: ${user.full_name}`);
    console.log(`Role: ${user.role}\n`);

    // Get all Ampalaya orders for this farmer
    const ordersResult = await pool.query(`
      SELECT 
        o.id as order_id,
        o.user_id as customer_id,
        u.full_name as customer_name,
        u.email as customer_email,
        o.product_id,
        o.quantity,
        o.total_amount,
        o.status,
        o.is_preorder,
        o.created_at,
        p.name as product_name,
        p.unit,
        p.price as unit_price
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE p.farmer_id = $1
        AND p.name ILIKE '%ampalaya%'
        AND COALESCE(o.is_disabled, false) = false
      ORDER BY o.created_at DESC
    `, [user.id]);

    console.log(`Total Ampalaya Orders: ${ordersResult.rows.length}\n`);

    // Group by status
    const statusGroups = {};
    for (const order of ordersResult.rows) {
      if (!statusGroups[order.status]) {
        statusGroups[order.status] = [];
      }
      statusGroups[order.status].push(order);
    }

    console.log('Orders by Status:');
    console.log('=================\n');

    for (const [status, orders] of Object.entries(statusGroups)) {
      const totalQty = orders.reduce((sum, o) => sum + o.quantity, 0);
      const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
      console.log(`${status.toUpperCase()}: ${orders.length} orders, ${totalQty} total qty, ₱${totalAmount}`);
    }

    // Show pending orders in detail
    if (statusGroups['pending']) {
      console.log('\n=== PENDING ORDERS DETAIL ===');
      for (const order of statusGroups['pending']) {
        console.log(`Order #${order.order_id}:`);
        console.log(`  Customer: ${order.customer_name} (${order.customer_email})`);
        console.log(`  Quantity: ${order.quantity} ${order.unit}`);
        console.log(`  Total: ₱${order.total_amount}`);
        console.log(`  Created: ${order.created_at}`);
        console.log('');
      }
    }

    // Check if they're from the same customer
    const customerGroups = {};
    for (const order of ordersResult.rows) {
      const key = `${order.customer_email}`;
      if (!customerGroups[key]) {
        customerGroups[key] = {
          customer_name: order.customer_name,
          orders: [],
          total_quantity: 0
        };
      }
      customerGroups[key].orders.push(order);
      customerGroups[key].total_quantity += order.quantity;
    }

    console.log('\n=== ORDERS BY CUSTOMER ===');
    for (const [email, group] of Object.entries(customerGroups)) {
      console.log(`Customer: ${group.customer_name} (${email})`);
      console.log(`  Total Orders: ${group.orders.length}`);
      console.log(`  Total Quantity: ${group.total_quantity}`);
      
      const pending = group.orders.filter(o => o.status === 'pending');
      if (pending.length > 0) {
        console.log(`  Pending Orders: ${pending.length}`);
      }
      console.log('');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkAmpalayaPending();
