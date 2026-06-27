const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkHarvestDate() {
  try {
    console.log('Checking harvest date for product 54 (Banana)...\n');
    
    const result = await pool.query(`
      SELECT id, name, harvest_date, harvest_adjustment_count, 
             last_harvest_adjustment_at, farmer_id
      FROM products
      WHERE id = 54
    `);
    
    if (result.rows.length === 0) {
      console.log('Product 54 not found');
    } else {
      const product = result.rows[0];
      console.log('Product:', product.name);
      console.log('ID:', product.id);
      console.log('Harvest Date:', product.harvest_date);
      console.log('Adjustment Count:', product.harvest_adjustment_count);
      console.log('Last Adjustment:', product.last_harvest_adjustment_at);
      console.log('Farmer ID:', product.farmer_id);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkHarvestDate();
