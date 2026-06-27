const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkAndFixProduct() {
  try {
    // Check the product we created
    const result = await pool.query(
      "SELECT id, name, is_preorder, is_available, status FROM products WHERE name = 'Pechay' AND is_preorder = true ORDER BY created_at DESC LIMIT 1"
    );
    
    if (result.rows.length === 0) {
      console.log('No Pechay pre-order found');
      process.exit(0);
    }
    
    const product = result.rows[0];
    console.log('Product found:', product);
    
    // Update status to 'active' if it's 'approved'
    if (product.status === 'approved') {
      await pool.query(
        "UPDATE products SET status = 'active' WHERE id = $1",
        [product.id]
      );
      console.log('Updated status from approved to active');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndFixProduct();
