const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUserOrdersDetail() {
  try {
    const email = 'dhelhilis@gmail.com';
    console.log(`Checking orders for user: ${email}\n`);

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

    // Get all orders for this user
    const ordersResult = await pool.query(`
      SELECT 
        o.id as order_id,
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
      WHERE o.user_id = $1
        AND COALESCE(o.is_disabled, false) = false
      ORDER BY o.created_at DESC
    `, [user.id]);

    console.log(`Total Orders: ${ordersResult.rows.length}\n`);

    // Group by product to see if they're individual orders or grouped
    const productGroups = {};
    for (const order of ordersResult.rows) {
      if (!productGroups[order.product_name]) {
        productGroups[order.product_name] = {
          product_id: order.product_id,
          unit: order.unit,
          unit_price: order.unit_price,
          orders: [],
          total_quantity: 0,
          total_amount: 0
        };
      }
      productGroups[order.product_name].orders.push(order);
      productGroups[order.product_name].total_quantity += order.quantity;
      productGroups[order.product_name].total_amount += order.total_amount;
    }

    console.log('Orders by Product:');
    console.log('==================\n');

    for (const [productName, group] of Object.entries(productGroups)) {
      console.log(`Product: ${productName} (${group.unit})`);
      console.log(`Unit Price: ₱${group.unit_price}`);
      console.log(`Total Orders: ${group.orders.length}`);
      console.log(`Total Quantity: ${group.total_quantity}`);
      console.log(`Total Amount: ₱${group.total_amount}`);
      console.log('\nIndividual Orders:');
      
      for (const order of group.orders) {
        console.log(`  Order #${order.order_id}: Qty ${order.quantity} | ₱${order.total_amount} | ${order.status} | ${order.created_at}`);
      }
      console.log('---\n');
    }

    // Specifically check for ampalaya
    if (productGroups['Ampalaya']) {
      console.log('\n=== AMPALAYA SUMMARY ===');
      const ampalaya = productGroups['Ampalaya'];
      console.log(`Total Ampalaya Orders: ${ampalaya.orders.length}`);
      console.log(`Total Ampalaya Quantity: ${ampalaya.total_quantity}`);
      console.log(`Total Amount: ₱${ampalaya.total_amount}`);
      
      const pendingOrders = ampalaya.orders.filter(o => o.status === 'pending');
      if (pendingOrders.length > 0) {
        console.log(`\nPending Ampalaya Orders: ${pendingOrders.length}`);
        for (const order of pendingOrders) {
          console.log(`  Order #${order.order_id}: Qty ${order.quantity} | ${order.created_at}`);
        }
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkUserOrdersDetail();
