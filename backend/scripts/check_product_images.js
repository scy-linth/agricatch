const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkProductImages() {
  try {
    const result = await pool.query(
      "SELECT id, name, is_preorder, is_available, status, linked_product_id, image_url FROM products WHERE farmer_id = 42 ORDER BY created_at DESC"
    );
    
    console.log('Farmer 42 products with image info:');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Name: ${row.name}, Pre-order: ${row.is_preorder}, Available: ${row.is_available}, Status: ${row.status}, Linked ID: ${row.linked_product_id}, Image: ${row.image_url ? row.image_url.substring(0, 50) : 'NULL'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProductImages();
