/**
 * Test script to verify that admin role cannot see login.success audit logs via API
 * Only superadmin should be able to see login.success and login.failed logs
 * 
 * Usage: node test_audit_log_filter.js <admin_jwt_token> [superadmin_jwt_token]
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testAuditLogFilter(adminToken, superadminToken) {
  console.log('=== Testing Audit Log Filter for Admin Role ===\n');
  console.log(`API Base: ${API_BASE}\n`);

  if (!adminToken) {
    console.error('Error: Admin JWT token required');
    console.log('Usage: node test_audit_log_filter.js <admin_jwt_token> [superadmin_jwt_token]');
    process.exit(1);
  }

  try {
    // Test 1: Admin role should NOT see login.success logs
    console.log('1. Testing admin role (should NOT see login.success logs)...');
    const adminRes = await fetch(`${API_BASE}/api/admin/logs`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!adminRes.ok) {
      console.error(`   ❌ Failed: ${adminRes.status} ${adminRes.statusText}`);
      const errorText = await adminRes.text();
      console.error(`   ${errorText}`);
      return;
    }

    const adminData = await adminRes.json();
    const adminLogs = adminData.logs || [];
    const hasLoginSuccess = adminLogs.some(log => log.action === 'login.success');
    const hasLoginFailed = adminLogs.some(log => log.action === 'login.failed');

    console.log(`   Total logs returned to admin: ${adminLogs.length}`);
    console.log(`   Contains login.success: ${hasLoginSuccess ? '❌ YES (FAIL)' : '✅ NO (PASS)'}`);
    console.log(`   Contains login.failed: ${hasLoginFailed ? '❌ YES (FAIL)' : '✅ NO (PASS)'}`);

    if (hasLoginSuccess || hasLoginFailed) {
      console.log('\n   ❌ FAIL: Admin role can see security-sensitive login logs');
    } else {
      console.log('\n   ✅ PASS: Admin role cannot see login.success/login.failed logs');
    }

    // Test 2: Superadmin role SHOULD see login.success logs (if token provided)
    if (superadminToken) {
      console.log('\n2. Testing superadmin role (should see login.success logs)...');
      const superRes = await fetch(`${API_BASE}/api/admin/logs`, {
        headers: {
          'Authorization': `Bearer ${superadminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!superRes.ok) {
        console.error(`   ❌ Failed: ${superRes.status} ${superRes.statusText}`);
        const errorText = await superRes.text();
        console.error(`   ${errorText}`);
        return;
      }

      const superData = await superRes.json();
      const superLogs = superData.logs || [];
      const superHasLoginSuccess = superLogs.some(log => log.action === 'login.success');
      const superHasLoginFailed = superLogs.some(log => log.action === 'login.failed');

      console.log(`   Total logs returned to superadmin: ${superLogs.length}`);
      console.log(`   Contains login.success: ${superHasLoginSuccess ? '✅ YES (PASS)' : '⚠️  NO (no data)'}`);
      console.log(`   Contains login.failed: ${superHasLoginFailed ? '✅ YES (PASS)' : '⚠️  NO (no data)'}`);

      if (superHasLoginSuccess || superHasLoginFailed) {
        console.log('\n   ✅ PASS: Superadmin role can see security-sensitive login logs');
      } else {
        console.log('\n   ⚠️  INFO: No login logs in database to verify superadmin access');
      }
    }

    console.log('\n=== Test Complete ===');

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Get tokens from command line
const adminToken = process.argv[2];
const superadminToken = process.argv[3];

testAuditLogFilter(adminToken, superadminToken);
