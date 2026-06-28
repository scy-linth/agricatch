/**
 * Add Pre-order Product to Customer Wishlist
 * 
 * This script adds a pre-order product to the test customer's wishlist
 * to enable testing of the harvest lifecycle notification feature.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function addPreorderToWishlist() {
  console.log('=== Adding Pre-order Product to Customer Wishlist ===\n');

  try {
    const customerEmail = 'testcustomer@test.com';
    const preOrderId = 102; // Test Linked Pre-order

    // Get customer ID
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [customerEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('✗ Test customer not found');
      return;
    }

    const customerId = userResult.rows[0].id;
    console.log(`✓ Customer found: ${customerEmail} (ID: ${customerId})\n`);

    // Check if product exists
    const productResult = await pool.query(
      'SELECT id, name, is_preorder, status FROM products WHERE id = $1',
      [preOrderId]
    );

    if (productResult.rows.length === 0) {
      console.log('✗ Pre-order product not found');
      return;
    }

    const product = productResult.rows[0];
    console.log(`✓ Product found: ${product.name} (ID: ${product.id}, Pre-order: ${product.is_preorder}, Status: ${product.status})\n`);

    // Check if already in wishlist
    const existingWishlist = await pool.query(
      'SELECT id FROM wishlist WHERE user_id = $1 AND product_id = $2',
      [customerId, preOrderId]
    );

    if (existingWishlist.rows.length > 0) {
      console.log('✗ Product already in customer wishlist');
      return;
    }

    // Add to wishlist
    await pool.query(
      'INSERT INTO wishlist (user_id, product_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
      [customerId, preOrderId]
    );

    console.log('✓ Successfully added pre-order product to customer wishlist\n');
    console.log('Setup complete for TEST 1: Harvest lifecycle notification creation');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addPreorderToWishlist()
  .then(() => {
    console.log('\n✓ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Script failed:', error.message);
    process.exit(1);
  });
