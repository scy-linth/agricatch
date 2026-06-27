const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkLinkedProducts() {
  try {
    // Check Pechay products
    const result = await pool.query(
      "SELECT id, name, is_preorder, is_available, status, linked_product_id FROM products WHERE name = 'Pechay' ORDER BY created_at DESC"
    );
    
    console.log('Pechay products:');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}, Name: ${row.name}, Pre-order: ${row.is_preorder}, Available: ${row.is_available}, Status: ${row.status}, Linked ID: ${row.linked_product_id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLinkedProducts();
