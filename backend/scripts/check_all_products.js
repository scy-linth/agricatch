require('dotenv').config();
const { pool } = require('../utils/db');

async function checkAllProducts() {
  try {
    const result = await pool.query(`
      SELECT id, name, location, city, province 
      FROM products 
      ORDER BY id
    `);
    
    console.log(`Total products: ${result.rows.length}`);
    console.log('Products without city/province:');
    result.rows.forEach(row => {
      const hasLocation = row.location && row.location.trim() !== '';
      const hasCity = row.city && row.city.trim() !== '';
      const hasProvince = row.province && row.province.trim() !== '';
      
      if (!hasCity && !hasProvince) {
        console.log(`  Product ${row.id} (${row.name}): location="${row.location}"`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllProducts();
