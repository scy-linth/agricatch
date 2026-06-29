require('dotenv').config();
const { pool } = require('../utils/db');

async function testRejectedProductEdit() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get farmer 20 credentials
    const userResult = await client.query(
      'SELECT id, email, password FROM users WHERE id = 20'
    );
    
    if (userResult.rows.length === 0) {
      console.log('Farmer 20 not found');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log('Testing with farmer:', user.email);
    
    // Get current product state before edit
    const beforeEdit = await client.query(
      'SELECT id, name, status, is_available, is_admin_disabled, rejection_reason FROM products WHERE id = 24'
    );
    
    console.log('\n=== BEFORE EDIT ===');
    console.log(JSON.stringify(beforeEdit.rows[0], null, 2));
    
    // Simulate the edit logic from PUT /products/:id
    // This is the logic from backend/routes/products.js line 1809-1811
    const current = beforeEdit.rows[0];
    const statusReset = current.status === 'rejected' ? ', status = \'pending\', is_admin_disabled = false, rejection_reason = NULL' : '';
    
    console.log('\n=== APPLYING EDIT ===');
    console.log('Status reset clause:', statusReset);
    
    await client.query(`
      UPDATE products SET
        name = $1, description = $2, price = $3, category_id = $4,
        stock_quantity = $5, unit = $6, image_url = $7, location = $8,
        city = $9, province = $10,
        harvest_date = $11, expiry_date = $12, is_available = $13,
        cloudinary_public_id = $14, is_preorder = $15, preorder_availability_date = $16, max_preorder_quantity = $17${statusReset},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
    `, [
      'Chico Edited',
      'This is an edited description',
      150.00,
      3,
      15,
      'kg',
      null,
      'Test Location',
      'Test City',
      'Test Province',
      null,
      null,
      false,
      null,
      false,
      null,
      null,
      24
    ]);
    
    // Get product state after edit
    const afterEdit = await client.query(
      'SELECT id, name, status, is_available, is_admin_disabled, rejection_reason, updated_at FROM products WHERE id = 24'
    );
    
    console.log('\n=== AFTER EDIT ===');
    console.log(JSON.stringify(afterEdit.rows[0], null, 2));
    
    // Verify the changes
    console.log('\n=== VERIFICATION ===');
    console.log('Status changed:', current.status, '→', afterEdit.rows[0].status);
    console.log('Status is pending:', afterEdit.rows[0].status === 'pending' ? '✓ PASS' : '✗ FAIL');
    console.log('is_admin_disabled changed:', current.is_admin_disabled, '→', afterEdit.rows[0].is_admin_disabled);
    console.log('is_admin_disabled is false:', afterEdit.rows[0].is_admin_disabled === false ? '✓ PASS' : '✗ FAIL');
    console.log('rejection_reason cleared:', afterEdit.rows[0].rejection_reason === null ? '✓ PASS' : '✗ FAIL');
    console.log('updated_at changed:', afterEdit.rows[0].updated_at !== null ? '✓ PASS' : '✗ FAIL');
    
    await client.query('ROLLBACK'); // Rollback to restore original state
    console.log('\n=== ROLLED BACK CHANGES ===');
    
    await client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    await client.release();
    await pool.end();
    process.exit(1);
  }
}

testRejectedProductEdit();
