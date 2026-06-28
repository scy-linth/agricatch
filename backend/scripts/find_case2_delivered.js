const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function findCase2DeliveredOrder() {
  try {
    // Find DELIVERED orders with products that are not available but have linked available products
    const res = await pool.query(`
      SELECT o.id as order_id, o.status, o.product_id, p.name, p.is_available, p.linked_product_id, 
             p2.id as linked_id, p2.name as linked_name, p2.is_available as linked_available, p2.status as linked_status
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN products p2 ON p.linked_product_id = p2.id
      WHERE o.status = 'delivered'
      AND p.is_available = false 
      AND p.linked_product_id IS NOT NULL
      AND p2.is_available = true
      AND p2.status = 'approved'
      LIMIT 5
    `);
    
    console.log('Delivered Orders for Case 2 testing:');
    if (res.rows.length === 0) {
      console.log('No delivered orders found with unavailable products that have available linked products.');
      console.log('\nLet me check for any delivered orders with linked products:');
      const deliveredRes = await pool.query(`
        SELECT o.id as order_id, o.status, o.product_id, p.name, p.is_available, p.linked_product_id
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status = 'delivered'
        AND p.linked_product_id IS NOT NULL
        LIMIT 5
      `);
      console.log('Delivered orders with linked products:');
      deliveredRes.rows.forEach(row => {
        console.log(`Order #${row.order_id}: Product ${row.product_id} (${row.name}, available: ${row.is_available}) -> Linked to ${row.linked_product_id}`);
      });
    } else {
      res.rows.forEach(row => {
        console.log(`Order #${row.order_id}: Product ${row.product_id} (${row.name}, available: ${row.is_available}) -> Linked to ${row.linked_id} (${row.linked_name}, available: ${row.linked_available})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findCase2DeliveredOrder();
