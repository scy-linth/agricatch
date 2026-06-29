require('dotenv').config();
const { pool } = require('../utils/db');

async function checkRejectedProducts() {
  try {
    const result = await pool.query(`
      SELECT id, name, farmer_id, status, is_available, is_admin_disabled, rejection_reason
      FROM products
      WHERE status = 'rejected'
      ORDER BY id
      LIMIT 10
    `);
    
    console.log('Rejected products found:', result.rows.length);
    if (result.rows.length > 0) {
      console.log(JSON.stringify(result.rows, null, 2));
    } else {
      console.log('No rejected products found. Creating one for testing...');
      
      // Create a test rejected product
      const testProduct = await pool.query(`
        INSERT INTO products (farmer_id, name, description, price, category_id, stock_quantity, unit, 
                              status, is_available, is_admin_disabled, rejection_reason, location, city, province)
        VALUES (1, 'Test Rejected Product', 'This is a test product for edit workflow', 100.00, 1, 10, 'kg',
                'rejected', false, true, 'Test rejection for edit workflow', 'Test Location', 'Test City', 'Test Province')
        RETURNING id, name, status
      `);
      
      console.log('Created test rejected product:', testProduct.rows[0]);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkRejectedProducts();
