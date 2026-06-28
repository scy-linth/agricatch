require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    // Check testfarmer orders
    const res = await pool.query(`
      SELECT o.id, o.status, o.quantity, o.total_amount, o.created_at, o.updated_at,
             p.name AS product_name, p.farmer_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = (SELECT id FROM users WHERE username = 'testfarmer')
      ORDER BY o.created_at DESC
      LIMIT 20
    `);
    
    console.log('Testfarmer orders:');
    console.log('Total orders:', res.rows.length);
    console.log('');
    
    if (res.rows.length === 0) {
      console.log('No orders found for testfarmer');
    } else {
      res.rows.forEach(row => {
        console.log(`ID: ${row.id}, Status: ${row.status}, Qty: ${row.quantity}, Total: ${row.total_amount}, Created: ${row.created_at}`);
      });
    }
    
    // Check delivered orders specifically
    const deliveredRes = await pool.query(`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(quantity), 0)::int AS total_qty, COALESCE(SUM(total_amount), 0)::numeric AS total_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = (SELECT id FROM users WHERE username = 'testfarmer')
        AND o.status = 'delivered'
    `);
    
    console.log('');
    console.log('Delivered orders summary:');
    console.log('Count:', deliveredRes.rows[0].count);
    console.log('Total quantity:', deliveredRes.rows[0].total_qty);
    console.log('Total revenue:', deliveredRes.rows[0].total_revenue);
    
    // Check orders in last 30 days
    const recentRes = await pool.query(`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(quantity), 0)::int AS total_qty, COALESCE(SUM(total_amount), 0)::numeric AS total_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.farmer_id = (SELECT id FROM users WHERE username = 'testfarmer')
        AND o.status = 'delivered'
        AND o.created_at >= (CURRENT_DATE - INTERVAL '30 days')
    `);
    
    console.log('');
    console.log('Delivered orders in last 30 days:');
    console.log('Count:', recentRes.rows[0].count);
    console.log('Total quantity:', recentRes.rows[0].total_qty);
    console.log('Total revenue:', recentRes.rows[0].total_revenue);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
})();
