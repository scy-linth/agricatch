require('dotenv').config();
const { pool } = require('../utils/db');

async function checkSoldCount() {
  try {
    // Check Ampalaya product sold counts
    const result = await pool.query(`
      SELECT p.id, p.name, p.sales_count, 
             COALESCE(s.sold_qty, 0)::int AS sold_qty
      FROM products p
      LEFT JOIN (
        SELECT product_id, COALESCE(SUM(quantity), 0)::int AS sold_qty
        FROM orders
        WHERE status = 'delivered'
        GROUP BY product_id
      ) s ON s.product_id = p.id
      WHERE p.name ILIKE '%Ampalaya%'
      LIMIT 5
    `);
    
    console.log('Ampalaya products sold count comparison:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSoldCount();
