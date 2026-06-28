const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testProduct101() {
  try {
    const res = await pool.query(`
      SELECT id, name, is_available, is_admin_disabled, status, linked_product_id, expiry_date
      FROM products WHERE id = 101
    `);
    
    const product = res.rows[0];
    console.log('Product 101 details:');
    console.log(product);
    
    const isOriginalActive = product.is_available === true
      && product.is_admin_disabled === false
      && product.status === 'approved'
      && (product.expiry_date === null || product.expiry_date >= new Date());
    
    console.log('\nIs Original Active calculation:');
    console.log(`is_available: ${product.is_available} === true: ${product.is_available === true}`);
    console.log(`is_admin_disabled: ${product.is_admin_disabled} === false: ${product.is_admin_disabled === false}`);
    console.log(`status: ${product.status} === 'approved': ${product.status === 'approved'}`);
    console.log(`expiry_date: ${product.expiry_date}, now: ${new Date()}`);
    console.log(`expiry check: ${product.expiry_date === null || product.expiry_date >= new Date()}`);
    console.log(`\nFinal isOriginalActive: ${isOriginalActive}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testProduct101();
