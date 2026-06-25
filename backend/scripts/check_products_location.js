require('dotenv').config();
const { pool } = require('../utils/db');

async function checkProductsLocation() {
  try {
    const result = await pool.query(`
      SELECT id, name, location, city, province 
      FROM products 
      WHERE (city IS NULL OR city = '') 
        AND (province IS NULL OR province = '')
      ORDER BY id
    `);
    
    console.log(`Found ${result.rows.length} products without city/province`);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkProductsLocation();
