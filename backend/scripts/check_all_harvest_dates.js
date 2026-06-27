const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAllHarvestDates() {
  try {
    console.log('Checking all pre-order products for farmer 20...\n');
    
    const result = await pool.query(`
      SELECT id, name, harvest_date, is_preorder, farmer_id
      FROM products
      WHERE farmer_id = 20 AND is_preorder = true
      ORDER BY id
    `);
    
    console.log('Pre-order products:');
    result.rows.forEach(product => {
      console.log(`ID: ${product.id}, Name: ${product.name}, Harvest: ${product.harvest_date}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllHarvestDates();
