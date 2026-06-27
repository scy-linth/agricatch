const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTestPreorder() {
  try {
    // Get farmer_id for Test Farmer
    const farmerResult = await pool.query(
      "SELECT id, email FROM users WHERE role = 'farmer' LIMIT 1"
    );
    
    if (farmerResult.rows.length === 0) {
      console.error('Test Farmer not found');
      process.exit(1);
    }
    
    const farmerId = farmerResult.rows[0].id;
    console.log('Farmer ID:', farmerId);
    
    // Get category_id for Vegetables
    const categoryResult = await pool.query(
      "SELECT id FROM categories WHERE name = 'Vegetables' LIMIT 1"
    );
    
    if (categoryResult.rows.length === 0) {
      console.error('Vegetables category not found');
      process.exit(1);
    }
    
    const categoryId = categoryResult.rows[0].id;
    console.log('Category ID:', categoryId);
    
    // Insert a pre-order product for Pechay
    const insertResult = await pool.query(
      `INSERT INTO products (
        farmer_id, category_id, name, unit, price, 
        description, location, city, province,
        is_preorder, max_preorder_quantity, preorder_availability_date,
        stock_quantity, reserved_quantity, is_available, status,
        is_admin_disabled, created_at, updated_at
      ) VALUES (
        $1, $2, 'Pechay', 'kg', 30,
        'Fresh bok choy from local farm', '456 Farm Road, Abut, Quezon, Metro Manila', 'Quezon', 'Metro Manila',
        true, 50, '2026-02-15',
        0, 0, true, 'approved',
        false, NOW(), NOW()
      ) RETURNING id`,
      [farmerId, categoryId]
    );
    
    const productId = insertResult.rows[0].id;
    console.log('Pre-order product created with ID:', productId);
    
    console.log('Success! You can now harvest this product to create a linked Available product.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestPreorder();
