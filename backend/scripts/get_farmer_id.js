// Get farmer ID for Theressa Shop
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function getFarmerId() {
  try {
    console.log('Getting farmer ID for Theressa Shop...\n');
    
    const result = await pool.query(`
      SELECT id, shop_name, full_name, role
      FROM users
      WHERE shop_name = 'Theressa Shop' OR full_name LIKE '%Theressa%'
    `);
    
    if (result.rows.length === 0) {
      console.log('Farmer not found');
    } else {
      result.rows.forEach(u => {
        console.log(`ID: ${u.id}, Shop: ${u.shop_name}, Name: ${u.full_name}, Role: ${u.role}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

getFarmerId();
