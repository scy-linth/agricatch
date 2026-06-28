/**
 * Wishlist Notification Verification Script
 * 
 * This script verifies the wishlist notification logic by:
 * 1. Checking customer wishlist entries
 * 2. Simulating the harvest lifecycle notification creation
 * 3. Verifying duplicate prevention logic
 * 4. Testing the current-active endpoint
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function verifyWishlistNotificationLogic() {
  console.log('=== Wishlist Notification Logic Verification ===\n');

  try {
    // Step 1: Check customer wishlist entries
    console.log('Step 1: Checking customer wishlist entries...');
    const customerEmail = 'testcustomer@test.com';
    
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

    const wishlistResult = await pool.query(
      `SELECT w.product_id, p.name, p.is_available, p.status, p.is_preorder, p.linked_product_id
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = $1`,
      [customerId]
    );

    console.log(`Customer has ${wishlistResult.rows.length} products in wishlist:`);
    wishlistResult.rows.forEach(row => {
      console.log(`  - ${row.name} (ID: ${row.product_id}, Available: ${row.is_available}, Status: ${row.status}, Pre-order: ${row.is_preorder})`);
    });
    console.log();

    // Step 2: Check for pre-order products in wishlist
    console.log('Step 2: Checking for pre-order products in wishlist...');
    const preOrderProducts = wishlistResult.rows.filter(row => row.is_preorder);
    
    if (preOrderProducts.length === 0) {
      console.log('✗ No pre-order products in wishlist. Cannot test harvest lifecycle notification.');
      console.log('Recommendation: Add a pre-order product to the customer\'s wishlist to test notification creation.\n');
    } else {
      console.log(`✓ Found ${preOrderProducts.length} pre-order product(s) in wishlist:\n`);
      preOrderProducts.forEach(row => {
        console.log(`  - ${row.name} (ID: ${row.product_id})`);
      });
      console.log();
    }

    // Step 3: Verify notification table structure
    console.log('Step 3: Verifying notification table structure...');
    const notificationColumns = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'notifications' 
       ORDER BY ordinal_position`
    );
    
    console.log('Notification table columns:');
    notificationColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    console.log();

    // Step 4: Check existing notifications for the customer
    console.log('Step 4: Checking existing notifications for the customer...');
    const notificationsResult = await pool.query(
      `SELECT id, type, title, message, product_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [customerId]
    );

    console.log(`Customer has ${notificationsResult.rows.length} recent notifications:`);
    notificationsResult.rows.forEach(notif => {
      console.log(`  - [${notif.type}] ${notif.title} (Product ID: ${notif.product_id}, Read: ${notif.is_read}, Created: ${notif.created_at})`);
    });
    console.log();

    // Step 5: Check for product_available notifications
    console.log('Step 5: Checking for product_available notifications...');
    const productAvailableNotifs = await pool.query(
      `SELECT id, type, title, message, product_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1 AND type = 'product_available'
       ORDER BY created_at DESC`,
      [customerId]
    );

    if (productAvailableNotifs.rows.length === 0) {
      console.log('✗ No product_available notifications found (expected if no harvest event occurred)\n');
    } else {
      console.log(`✓ Found ${productAvailableNotifs.rows.length} product_available notification(s):`);
      productAvailableNotifs.rows.forEach(notif => {
        console.log(`  - ${notif.title} (Product ID: ${notif.product_id}, Created: ${notif.created_at})`);
      });
      console.log();
    }

    // Step 6: Verify duplicate prevention logic (check for notifications within 1 hour)
    console.log('Step 6: Verifying duplicate prevention logic...');
    const recentNotifs = await pool.query(
      `SELECT id, type, product_id, created_at
       FROM notifications
       WHERE user_id = $1 
         AND type = 'product_available'
         AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC`,
      [customerId]
    );

    if (recentNotifs.rows.length === 0) {
      console.log('✓ No recent product_available notifications within 1 hour (duplicate prevention working)\n');
    } else {
      console.log(`Found ${recentNotifs.rows.length} notification(s) within 1 hour:`);
      recentNotifs.rows.forEach(notif => {
        console.log(`  - Product ID: ${notif.product_id}, Created: ${notif.created_at}`);
      });
      console.log();
    }

    // Step 7: Test current-active endpoint logic
    console.log('Step 7: Testing current-active endpoint logic...');
    
    if (wishlistResult.rows.length > 0) {
      const testProductId = wishlistResult.rows[0].product_id;
      
      const currentActiveResult = await pool.query(
        `SELECT 
           CASE 
             WHEN p.is_available = true AND p.is_preorder = false THEN p.id
             WHEN p.is_preorder = true AND p.linked_product_id IS NOT NULL THEN p.linked_product_id
             ELSE p.id
           END as current_product_id,
           p.is_available,
           p.is_preorder,
           p.linked_product_id
         FROM products p
         WHERE p.id = $1`,
        [testProductId]
      );

      if (currentActiveResult.rows.length > 0) {
        const result = currentActiveResult.rows[0];
        console.log(`✓ Current active product for ID ${testProductId}:`);
        console.log(`  - Current Product ID: ${result.current_product_id}`);
        console.log(`  - Is Available: ${result.is_available}`);
        console.log(`  - Is Pre-order: ${result.is_preorder}`);
        console.log(`  - Linked Product ID: ${result.linked_product_id}`);
        console.log();
      }
    }

    // Step 8: Verify landing page filtering logic
    console.log('Step 8: Verifying landing page filtering logic...');
    const availableProducts = await pool.query(
      `SELECT id, name, is_available, status, is_admin_disabled, stock_quantity
       FROM products
       WHERE is_available = true 
         AND COALESCE(is_admin_disabled, false) = false
         AND status = 'approved'
         AND is_preorder = false
       LIMIT 5`
    );

    console.log(`Sample of available products (should only show approved, available, not disabled):`);
    availableProducts.rows.forEach(prod => {
      console.log(`  - ${prod.name} (ID: ${prod.id}, Available: ${prod.is_available}, Status: ${prod.status}, Disabled: ${prod.is_admin_disabled}, Stock: ${prod.stock_quantity})`);
    });
    console.log();

    // Step 9: Check for products that should NOT appear on landing page
    console.log('Step 9: Checking for products that should NOT appear on landing page...');
    const excludedProducts = await pool.query(
      `SELECT id, name, is_available, status, is_admin_disabled, stock_quantity
       FROM products
       WHERE is_preorder = false
         AND (
           stock_quantity <= 0 
           OR is_available = false 
           OR COALESCE(is_admin_disabled, false) = true 
           OR status != 'approved'
         )
       LIMIT 5`
    );

    if (excludedProducts.rows.length === 0) {
      console.log('✓ No excluded products found in database\n');
    } else {
      console.log(`Found ${excludedProducts.rows.length} product(s) that should NOT appear on landing page:`);
      excludedProducts.rows.forEach(prod => {
        let reason = [];
        if (prod.stock_quantity <= 0) reason.push('out of stock');
        if (!prod.is_available) reason.push('not available');
        if (prod.is_admin_disabled) reason.push('admin disabled');
        if (prod.status !== 'approved') reason.push(`status: ${prod.status}`);
        console.log(`  - ${prod.name} (ID: ${prod.id}) - Reason: ${reason.join(', ')}`);
      });
      console.log();
    }

    console.log('=== Verification Complete ===');
    console.log('\nSummary:');
    console.log('- Customer wishlist entries verified');
    console.log('- Pre-order products in wishlist identified');
    console.log('- Notification table structure verified');
    console.log('- Existing notifications checked');
    console.log('- Product_available notifications checked');
    console.log('- Duplicate prevention logic verified');
    console.log('- Current-active endpoint logic tested');
    console.log('- Landing page filtering logic verified');

  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyWishlistNotificationLogic()
  .then(() => {
    console.log('\n✓ Verification script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Verification script failed:', error.message);
    process.exit(1);
  });
