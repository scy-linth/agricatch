// Test the exact UPDATE query that would be executed
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testUpdate() {
  try {
    console.log('Testing UPDATE query for product 23...\n');
    
    // Get current state
    const current = await pool.query('SELECT * FROM products WHERE id = 23');
    if (current.rows.length === 0) {
      console.log('Product 23 not found');
      return;
    }
    
    const product = current.rows[0];
    console.log('Current state:');
    console.log(`  Status: ${product.status}`);
    console.log(`  is_available: ${product.is_available}`);
    console.log(`  is_admin_disabled: ${product.is_admin_disabled}`);
    console.log(`  rejection_reason: ${product.rejection_reason || 'NULL'}`);
    
    // Simulate the status reset logic (updated to not include is_available)
    const statusReset = product.status === 'rejected' ? ', status = \'pending\', is_admin_disabled = false, rejection_reason = NULL' : '';
    console.log(`\nStatus reset clause: "${statusReset}"`);
    
    // Test the UPDATE
    console.log('\nExecuting UPDATE query...');
    await pool.query(`
      UPDATE products SET
        name = $1, description = $2, price = $3, category_id = $4,
        stock_quantity = $5, unit = $6, image_url = $7, location = $8,
        harvest_date = $9, expiry_date = $10, is_available = $11,
        cloudinary_public_id = $12${statusReset},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
    `, [
      product.name,
      product.description,
      product.price,
      product.category_id,
      product.stock_quantity,
      product.unit,
      product.image_url,
      product.location,
      product.harvest_date,
      product.expiry_date,
      product.is_available,
      product.cloudinary_public_id,
      23
    ]);
    
    console.log('✓ UPDATE successful!');
    
    // Check new state
    const updated = await pool.query('SELECT status, is_available, is_admin_disabled, rejection_reason FROM products WHERE id = 23');
    const newProduct = updated.rows[0];
    console.log('\nNew state:');
    console.log(`  Status: ${newProduct.status}`);
    console.log(`  is_available: ${newProduct.is_available}`);
    console.log(`  is_admin_disabled: ${newProduct.is_admin_disabled}`);
    console.log(`  rejection_reason: ${newProduct.rejection_reason || 'NULL'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testUpdate();
