const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function assignProductToCorrectFarmer() {
  try {
    // Update the Pechay product to belong to farmer_id 42 (the logged-in farmer)
    const result = await pool.query(
      "UPDATE products SET farmer_id = 42 WHERE name = 'Pechay' AND is_preorder = true RETURNING id"
    );
    
    if (result.rows.length === 0) {
      console.log('No Pechay pre-order found');
      process.exit(1);
    }
    
    console.log('Product updated. Now belongs to farmer_id 42. Product ID:', result.rows[0].id);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

assignProductToCorrectFarmer();
