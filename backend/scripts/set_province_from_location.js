require('dotenv').config();
const { pool } = require('../utils/db');

async function setProvinceFromLocation() {
  try {
    // Set province = location for all products without city/province
    // This will show the location (even if garbage) instead of "your local area"
    const result = await pool.query(`
      UPDATE products 
      SET province = location
      WHERE (city IS NULL OR city = '') 
        AND (province IS NULL OR province = '')
        AND location IS NOT NULL 
        AND location != ''
      RETURNING id, name, location, province
    `);
    
    console.log(`Updated ${result.rows.length} products`);
    result.rows.forEach(row => {
      console.log(`Product ${row.id} (${row.name}): province set to "${row.province}"`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

setProvinceFromLocation();
