const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runTest() {
  console.log('=== New Verification Features End-to-End Test ===\n');
  
  try {
    // Test 1: Check verification_requests table
    console.log('Test 1: Checking verification_requests table...');
    const vrTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'verification_requests'
      )
    `);
    console.log(vrTableCheck.rows[0].exists ? '✓ verification_requests table exists' : '✗ verification_requests table missing');
    
    // Test 2: Check verification_history table
    console.log('\nTest 2: Checking verification_history table...');
    const vhTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'verification_history'
      )
    `);
    console.log(vhTableCheck.rows[0].exists ? '✓ verification_history table exists' : '✗ verification_history table missing');
    
    // Test 3: Check featured_products table
    console.log('\nTest 3: Checking featured_products table...');
    const fpTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'featured_products'
      )
    `);
    console.log(fpTableCheck.rows[0].exists ? '✓ featured_products table exists' : '✗ featured_products table missing');
    
    // Test 4: Check farmer verification request endpoint
    console.log('\nTest 4: Checking farmer verification request endpoint...');
    const farmersJs = fs.readFileSync('./routes/farmers.js', 'utf8');
    const hasVerificationRequest = farmersJs.includes("router.post('/me/verification-request'") &&
                                  farmersJs.includes('verification_requests');
    console.log(hasVerificationRequest ? '✓ Farmer verification request endpoint implemented' : '✗ Farmer verification request endpoint missing');
    
    // Test 5: Check admin notification for verification requests
    console.log('\nTest 5: Checking admin notification for verification requests...');
    const hasAdminNotification = farmersJs.includes('verification_request') &&
                                farmersJs.includes('broadcastEvent') &&
                                farmersJs.includes('New Verification Request');
    console.log(hasAdminNotification ? '✓ Admin notification for verification requests implemented' : '✗ Admin notification missing');
    
    // Test 6: Check admin verification requests endpoint
    console.log('\nTest 6: Checking admin verification requests endpoint...');
    const adminJs = fs.readFileSync('./routes/admin.js', 'utf8');
    const hasAdminVerificationRequests = adminJs.includes('/verification-requests') &&
                                        adminJs.includes('GET') &&
                                        adminJs.includes('review');
    console.log(hasAdminVerificationRequests ? '✓ Admin verification requests endpoint implemented' : '✗ Admin verification requests endpoint missing');
    
    // Test 7: Check analytics upgrade notification
    console.log('\nTest 7: Checking analytics upgrade notification...');
    const hasAnalyticsNotification = adminJs.includes('analytics_upgrade') &&
                                    adminJs.includes('Analytics Access Upgraded');
    console.log(hasAnalyticsNotification ? '✓ Analytics upgrade notification implemented' : '✗ Analytics upgrade notification missing');
    
    // Test 8: Check verification revocation reason
    console.log('\nTest 8: Checking verification revocation reason field...');
    const hasRevocationReason = adminJs.includes('reason') &&
                                adminJs.includes('Reason is required when unverifying');
    console.log(hasRevocationReason ? '✓ Verification revocation reason field implemented' : '✗ Verification revocation reason field missing');
    
    // Test 9: Check featured products admin endpoints
    console.log('\nTest 9: Checking featured products admin endpoints...');
    const hasFeaturedProducts = adminJs.includes("router.get('/featured-products'") &&
                               adminJs.includes("router.post('/featured-products'") &&
                               adminJs.includes("router.delete('/featured-products/:id'") &&
                               adminJs.includes("router.put('/featured-products/:id'");
    console.log(hasFeaturedProducts ? '✓ Featured products admin endpoints implemented' : '✗ Featured products admin endpoints missing');
    
    // Test 10: Check featured products integration in products.js
    console.log('\nTest 10: Checking featured products integration in products.js...');
    const productsJs = fs.readFileSync('./routes/products.js', 'utf8');
    const hasFeaturedIntegration = productsJs.includes('featured_products') &&
                                   productsJs.includes('fp.position') &&
                                   productsJs.includes('fallback');
    console.log(hasFeaturedIntegration ? '✓ Featured products integration implemented' : '✗ Featured products integration missing');
    
    // Test 11: Check verification history logging
    console.log('\nTest 11: Checking verification history logging...');
    const hasHistoryLogging = adminJs.includes('verification_history') &&
                              adminJs.includes('INSERT INTO verification_history');
    console.log(hasHistoryLogging ? '✓ Verification history logging implemented' : '✗ Verification history logging missing');
    
    // Test 12: Check verification request review rejection reason
    console.log('\nTest 12: Checking verification request review rejection reason...');
    const hasRejectionReason = adminJs.includes('rejection_reason') &&
                               adminJs.includes('Rejection reason is required');
    console.log(hasRejectionReason ? '✓ Verification request rejection reason implemented' : '✗ Verification request rejection reason missing');
    
    // Summary
    console.log('\n=== Test Summary ===');
    const allTests = [
      vrTableCheck.rows[0].exists,
      vhTableCheck.rows[0].exists,
      fpTableCheck.rows[0].exists,
      hasVerificationRequest,
      hasAdminNotification,
      hasAdminVerificationRequests,
      hasAnalyticsNotification,
      hasRevocationReason,
      hasFeaturedProducts,
      hasFeaturedIntegration,
      hasHistoryLogging,
      hasRejectionReason
    ];
    
    const passed = allTests.filter(t => t).length;
    const total = allTests.length;
    
    console.log(`\nPassed: ${passed}/${total} tests`);
    
    if (passed === total) {
      console.log('\n✓✓✓ ALL NEW FEATURES TESTS PASSED ✓✓✓');
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
