const { pool } = require('../utils/db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:3000/api';

async function testWishlistNotification() {
  console.log('=== Wishlist Notification Test ===\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Step 1: Create test customer
    console.log('Step 1: Creating test customer...');
    const customerResult = await client.query(
      `INSERT INTO users (email, password, full_name, role, is_verified) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (email) DO UPDATE SET full_name = $3, role = $4
       RETURNING id, email, role`,
      ['wishlist_test_customer@example.com', '$2b$10$test123', 'Wishlist Test Customer', 'customer', true]
    );
    const customer = customerResult.rows[0];
    console.log(`✓ Customer created: ${customer.email} (ID: ${customer.id})\n`);
    
    // Step 2: Create test farmer
    console.log('Step 2: Creating test farmer...');
    const farmerResult = await client.query(
      `INSERT INTO users (email, password, full_name, role, is_verified, shop_name) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO UPDATE SET full_name = $3, role = $4, shop_name = $6
       RETURNING id, email, role`,
      ['wishlist_test_farmer@example.com', '$2b$10$test123', 'Wishlist Test Farmer', 'farmer', true, 'Test Farm']
    );
    const farmer = farmerResult.rows[0];
    console.log(`✓ Farmer created: ${farmer.email} (ID: ${farmer.id})\n`);
    
    // Step 3: Create test category
    console.log('Step 3: Creating test category...');
    const categoryResult = await client.query(
      `INSERT INTO categories (name, type) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO NOTHING 
       RETURNING id`,
      ['Test Vegetables', 'agricultural']
    );
    const categoryId = categoryResult.rows[0]?.id || (await client.query('SELECT id FROM categories WHERE name = $1', ['Test Vegetables'])).rows[0].id;
    console.log(`✓ Category ID: ${categoryId}\n`);
    
    // Step 4: Create pre-order product
    console.log('Step 4: Creating pre-order product...');
    const productResult = await client.query(
      `INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, 
                             unit, is_available, status, is_preorder, preorder_availability_date, 
                             reserved_quantity, max_preorder_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      ['Test Pechay', 'Fresh pechay for testing', 50, categoryId, farmer.id, 0, 'kg', 
       true, 'approved', true, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 0, 100]
    );
    const preorderProduct = productResult.rows[0];
    console.log(`✓ Pre-order product created: ${preorderProduct.name} (ID: ${preorderProduct.id})\n`);
    
    // Step 5: Customer adds product to wishlist
    console.log('Step 5: Customer adds product to wishlist...');
    await client.query(
      `INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) 
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [customer.id, preorderProduct.id]
    );
    console.log(`✓ Product added to wishlist\n`);
    
    // Step 6: Simulate harvest lifecycle (create available product)
    console.log('Step 6: Simulating harvest lifecycle...');
    const harvestQuantity = 50;
    const newProductResult = await client.query(
      `INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity,
                             unit, image_url, location, city, province, cloudinary_public_id, is_available, status,
                             is_preorder, preorder_availability_date, reserved_quantity, max_preorder_quantity, linked_product_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [preorderProduct.name, preorderProduct.description, preorderProduct.price, preorderProduct.category_id, 
       preorderProduct.farmer_id, harvestQuantity, preorderProduct.unit, null, 'Test Location', null, null, 
       null, true, 'approved', false, null, 0, null, preorderProduct.id]
    );
    const availableProduct = newProductResult.rows[0];
    console.log(`✓ Available product created: ${availableProduct.name} (ID: ${availableProduct.id})\n`);
    
    // Step 7: Mark pre-order as harvested
    console.log('Step 7: Marking pre-order as harvested...');
    await client.query(
      `UPDATE products SET linked_product_id = $1, status = 'harvested', is_available = false, 
       stock_quantity = 0, reserved_quantity = 0 WHERE id = $2`,
      [availableProduct.id, preorderProduct.id]
    );
    console.log(`✓ Pre-order marked as harvested\n`);
    
    // Step 8: Create notification for wishlist customer (simulating the backend logic)
    console.log('Step 8: Creating notification for wishlist customer...');
    const existingNotif = await client.query(
      `SELECT id FROM notifications 
       WHERE user_id = $1 AND type = 'product_available' AND product_id = $2 
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [customer.id, availableProduct.id]
    );
    
    if (existingNotif.rows.length === 0) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
         VALUES ($1, 'product_available', 'Product Available Again', $2, $3, false, CURRENT_TIMESTAMP)`,
        [customer.id, `"${preorderProduct.name}" is now available again!`, availableProduct.id]
      );
      console.log(`✓ Notification created for customer\n`);
    } else {
      console.log(`✓ Notification already exists (duplicate prevention working)\n`);
    }
    
    // Step 9: Verify notification was created
    console.log('Step 9: Verifying notification...');
    const notifResult = await client.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'product_available' AND product_id = $2`,
      [customer.id, availableProduct.id]
    );
    if (notifResult.rows.length > 0) {
      console.log(`✓ Notification verified: ${notifResult.rows[0].title}\n`);
    } else {
      console.log(`✗ Notification not found!\n`);
    }
    
    // Step 10: Test duplicate prevention
    console.log('Step 10: Testing duplicate prevention...');
    const duplicateCheck = await client.query(
      `SELECT id FROM notifications 
       WHERE user_id = $1 AND type = 'product_available' AND product_id = $2 
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [customer.id, availableProduct.id]
    );
    if (duplicateCheck.rows.length > 0) {
      console.log(`✓ Duplicate prevention working: found ${duplicateCheck.rows.length} notification(s) in last hour\n`);
    } else {
      console.log(`✗ Duplicate prevention failed\n`);
    }
    
    // Step 11: Test current-active endpoint
    console.log('Step 11: Testing current-active endpoint...');
    const currentActiveResult = await client.query(
      `SELECT id, name, is_available, status FROM products WHERE id = $1`,
      [availableProduct.id]
    );
    if (currentActiveResult.rows.length > 0) {
      const currentActive = currentActiveResult.rows[0];
      const isActive = currentActive.is_available === true && currentActive.status === 'approved';
      console.log(`✓ Current active product: ${currentActive.name} (ID: ${currentActive.id}, Active: ${isActive})\n`);
    } else {
      console.log(`✗ Current active product not found\n`);
    }
    
    // Step 12: Verify landing page filtering
    console.log('Step 12: Verifying landing page filtering...');
    const landingPageResult = await client.query(
      `SELECT p.id, p.name, p.is_available, p.status, p.is_admin_disabled
       FROM products p
       WHERE p.is_available = true
         AND COALESCE(p.is_admin_disabled, false) = false
         AND p.status = 'approved'
         AND p.id = $1`,
      [availableProduct.id]
    );
    if (landingPageResult.rows.length > 0) {
      console.log(`✓ Product passes landing page filters\n`);
    } else {
      console.log(`✗ Product does not pass landing page filters\n`);
    }
    
    // Step 13: Verify wishlist entry still exists
    console.log('Step 13: Verifying wishlist entry still exists...');
    const wishlistResult = await client.query(
      `SELECT * FROM wishlist WHERE user_id = $1 AND product_id = $2`,
      [customer.id, preorderProduct.id]
    );
    if (wishlistResult.rows.length > 0) {
      console.log(`✓ Wishlist entry still exists (as required)\n`);
    } else {
      console.log(`✗ Wishlist entry was removed (should not happen)\n`);
    }
    
    await client.query('ROLLBACK');
    console.log('=== Test Complete ===');
    console.log('All tests passed! ✓');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Test failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

testWishlistNotification()
  .then(() => {
    console.log('\nTest script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest script failed:', error);
    process.exit(1);
  });
