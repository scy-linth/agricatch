const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkOrder150() {
  try {
    const res = await pool.query(`
      SELECT id, status, product_id FROM orders WHERE id = 150
    `);
    
    console.log('Order #150 details:');
    console.log(res.rows[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkOrder150();
