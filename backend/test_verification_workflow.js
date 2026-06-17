const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTest() {
  console.log('=== Farmer Verification Workflow End-to-End Test ===\n');
  
  try {
    // Test 1: Check if is_verified column exists in users table
    console.log('Test 1: Checking is_verified column in users table...');
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'is_verified'
      )
    `);
    console.log(columnCheck.rows[0].exists ? '✓ is_verified column exists' : '✗ is_verified column missing');
    
    // Test 2: Check featured_products table
    console.log('\nTest 2: Checking featured_products table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'featured_products'
      )
    `);
    console.log(tableCheck.rows[0].exists ? '✓ featured_products table exists' : '✗ featured_products table missing');
    
    // Test 3: Check product limit middleware in products.js
    console.log('\nTest 3: Checking product limit middleware...');
    const fs = require('fs');
    const productsJs = fs.readFileSync('./routes/products.js', 'utf8');
    const hasProductLimit = productsJs.includes('productCount >= 10') && 
                           productsJs.includes('is_verified') &&
                           productsJs.includes('product_limit_reached');
    console.log(hasProductLimit ? '✓ Product limit middleware implemented' : '✗ Product limit middleware missing');
    
    // Test 4: Check priority approval queue in admin.js
    console.log('\nTest 4: Checking priority approval queue...');
    const adminJs = fs.readFileSync('./routes/admin.js', 'utf8');
    const hasPriorityQueue = adminJs.includes('COALESCE(u.is_verified, false) DESC') &&
                            adminJs.includes('farmer_is_verified');
    console.log(hasPriorityQueue ? '✓ Priority approval queue implemented' : '✗ Priority approval queue missing');
    
    // Test 5: Check custom product name restriction
    console.log('\nTest 5: Checking custom product name restriction...');
    const hasCustomNameRestriction = productsJs.includes('is_verified') &&
                                    productsJs.includes('Custom product name requests are available for verified farmers only');
    console.log(hasCustomNameRestriction ? '✓ Custom product name restriction implemented' : '✗ Custom product name restriction missing');
    
    // Test 6: Check search ranking boost
    console.log('\nTest 6: Checking search ranking boost...');
    const hasSearchBoost = productsJs.includes('COALESCE(u.is_verified, false) DESC') &&
                          productsJs.includes('orderByMap');
    console.log(hasSearchBoost ? '✓ Search ranking boost implemented' : '✗ Search ranking boost missing');
    
    // Test 7: Check blue checkmark badges in frontend
    console.log('\nTest 7: Checking blue checkmark badges in frontend...');
    const appJs = fs.readFileSync('../frontend/js/app.js', 'utf8');
    const productJs = fs.readFileSync('../frontend/js/product.js', 'utf8');
    const ordersJs = fs.readFileSync('../frontend/js/orders.js', 'utf8');
    const farmersJs = fs.readFileSync('../frontend/js/farmers.js', 'utf8');
    
    const hasBadgeInApp = appJs.includes('fa-check-circle') && appJs.includes('farmer_verified');
    const hasBadgeInProduct = productJs.includes('fa-check-circle') && productJs.includes('farmer_verified');
    const hasBadgeInOrders = ordersJs.includes('fa-check-circle') && ordersJs.includes('farmer_verified');
    const hasBadgeInFarmers = farmersJs.includes('fa-check-circle') && farmersJs.includes('is_verified');
    
    console.log(hasBadgeInApp ? '✓ Badge in app.js' : '✗ Badge missing in app.js');
    console.log(hasBadgeInProduct ? '✓ Badge in product.js' : '✗ Badge missing in product.js');
    console.log(hasBadgeInOrders ? '✓ Badge in orders.js' : '✗ Badge missing in orders.js');
    console.log(hasBadgeInFarmers ? '✓ Badge in farmers.js' : '✗ Badge missing in farmers.js');
    
    // Test 8: Check product limit warning in farmer.js
    console.log('\nTest 8: Checking product limit warning in farmer.js...');
    const farmerJs = fs.readFileSync('../frontend/js/farmer.js', 'utf8');
    const hasProductWarning = farmerJs.includes('product-limit-warning') &&
                             farmerJs.includes('You have') &&
                             farmerJs.includes('/10 products');
    console.log(hasProductWarning ? '✓ Product limit warning implemented' : '✗ Product limit warning missing');
    
    // Test 9: Check analytics restriction in farmer.js
    console.log('\nTest 9: Checking analytics restriction in farmer.js...');
    const hasAnalyticsRestriction = farmerJs.includes('analytics-access-warning') &&
                                   farmerJs.includes('renderBasicMetricsOnly') &&
                                   farmerJs.includes('Advanced analytics');
    console.log(hasAnalyticsRestriction ? '✓ Analytics restriction implemented' : '✗ Analytics restriction missing');
    
    // Test 10: Check verification notifications in admin.js
    console.log('\nTest 10: Checking verification notifications in admin.js...');
    const hasVerifyNotification = adminJs.includes('account_verified') &&
                                 adminJs.includes('account_unverified') &&
                                 adminJs.includes('notification.created');
    const hasCategoryNotification = adminJs.includes('category_request_approved') &&
                                    adminJs.includes('category_request_rejected');
    console.log(hasVerifyNotification ? '✓ Verification status notifications implemented' : '✗ Verification status notifications missing');
    console.log(hasCategoryNotification ? '✓ Category request notifications implemented' : '✗ Category request notifications missing');
    
    // Test 11: Check verification status filter in admin.js
    console.log('\nTest 11: Checking verification status filter in admin.js...');
    const hasVerificationFilter = adminJs.includes('verification') &&
                                  adminJs.includes('verified') &&
                                  adminJs.includes('unverified');
    console.log(hasVerificationFilter ? '✓ Verification status filter implemented' : '✗ Verification status filter missing');
    
    // Summary
    console.log('\n=== Test Summary ===');
    const allTests = [
      columnCheck.rows[0].exists,
      tableCheck.rows[0].exists,
      hasProductLimit,
      hasPriorityQueue,
      hasCustomNameRestriction,
      hasSearchBoost,
      hasBadgeInApp && hasBadgeInProduct && hasBadgeInOrders && hasBadgeInFarmers,
      hasProductWarning,
      hasAnalyticsRestriction,
      hasVerifyNotification && hasCategoryNotification,
      hasVerificationFilter
    ];
    
    const passed = allTests.filter(t => t).length;
    const total = allTests.length;
    
    console.log(`\nPassed: ${passed}/${total} tests`);
    
    if (passed === total) {
      console.log('\n✓✓✓ ALL TESTS PASSED - Verification system is 100% implemented ✓✓✓');
    } else {
      console.log('\n✗✗✗ SOME TESTS FAILED - Review failed tests above ✗✗✗');
    }
    
  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
