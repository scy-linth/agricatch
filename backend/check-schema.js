const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
  try {
    console.log('=== ORDERS TABLE COLUMNS ===');
    const ordersResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    ordersResult.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
    
    console.log('\n=== PRODUCTS TABLE COLUMNS ===');
    const productsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    productsResult.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
