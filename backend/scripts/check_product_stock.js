require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkProductStock() {
  try {
    const result = await pool.query('SELECT id, name, stock_quantity, is_available, status FROM products WHERE id = $1', [98]);
    console.log('Product 98 details:');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkProductStock();
