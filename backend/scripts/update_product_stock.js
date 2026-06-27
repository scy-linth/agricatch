require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateProductStock() {
  try {
    const result = await pool.query('UPDATE products SET stock_quantity = 20 WHERE id = $1 RETURNING id, name, stock_quantity', [98]);
    console.log('Product updated:');
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

updateProductStock();
