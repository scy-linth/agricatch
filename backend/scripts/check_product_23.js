// Check product 23 details
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkProduct() {
  try {
    console.log('Checking product #23...\n');
    
    const result = await pool.query(`
      SELECT p.*, c.name as category_name, u.shop_name, u.full_name, u.role
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.id = 23
    `);
    
    if (result.rows.length === 0) {
      console.log('Product #23 not found');
    } else {
      const p = result.rows[0];
      console.log('Product #23 found:');
      console.log(`  Name: ${p.name}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  is_available: ${p.is_available}`);
      console.log(`  is_admin_disabled: ${p.is_admin_disabled}`);
      console.log(`  rejection_reason: ${p.rejection_reason || 'NULL'}`);
      console.log(`  Farmer: ${p.shop_name || p.full_name}`);
      console.log(`  Farmer Role: ${p.role}`);
      console.log(`  Category: ${p.category_name}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkProduct();
