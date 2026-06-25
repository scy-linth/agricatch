require('dotenv').config();
const { pool } = require('../utils/db');

async function updateInvalidLocations() {
  try {
    // Update products with invalid location data to use the location field as-is
    // This will show the full address (even if it's garbage) instead of "your local area"
    const result = await pool.query(`
      UPDATE products 
      SET province = location
      WHERE (city IS NULL OR city = '') 
        AND (province IS NULL OR province = '')
        AND location IS NOT NULL 
        AND location != ''
        AND location != 'asdasd'
        AND location != 'Laoagaa'
      RETURNING id, name, location, province
    `);
    
    console.log(`Updated ${result.rows.length} products`);
    result.rows.forEach(row => {
      console.log(`Product ${row.id} (${row.name}): ${row.location} -> province: ${row.province}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

updateInvalidLocations();
