/**
 * Automated test script to verify that admin role cannot see login.success audit logs
 * Only superadmin should be able to see login.success and login.failed logs
 * 
 * This script automatically logs in as admin and superadmin to get tokens
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

// Test credentials - adjust these to match your test users
const ADMIN_CREDENTIALS = {
  email: 'admin@agricatch.com',
  password: 'admin123'
};

const SUPERADMIN_CREDENTIALS = {
  email: 'superadmin@agricatch.com',
  password: 'superadmin123'
};

async function login(credentials) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.token;
}

async function testAuditLogFilter() {
  console.log('=== Testing Audit Log Filter for Admin Role ===\n');
  console.log(`API Base: ${API_BASE}\n`);

  try {
    // Login as admin
    console.log('1. Logging in as admin...');
    let adminToken;
    try {
      adminToken = await login(ADMIN_CREDENTIALS);
      console.log('   ✅ Admin login successful\n');
    } catch (err) {
      console.error(`   ❌ Admin login failed: ${err.message}`);
      console.log('   Make sure admin user exists with credentials:');
      console.log(`   Email: ${ADMIN_CREDENTIALS.email}`);
      console.log(`   Password: ${ADMIN_CREDENTIALS.password}\n`);
      return;
    }

    // Test admin role should NOT see login.success logs
    console.log('2. Testing admin role (should NOT see login.success logs)...');
    const adminRes = await fetch(`${API_BASE}/admin/logs`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!adminRes.ok) {
      console.error(`   ❌ Failed: ${adminRes.status} ${adminRes.statusText}`);
      const errorText = await adminRes.text();
      console.error(`   ${errorText}\n`);
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
      console.log('   The filter in backend/routes/admin.js is not working correctly\n');
    } else {
      console.log('\n   ✅ PASS: Admin role cannot see login.success/login.failed logs');
      console.log('   The filter is working correctly\n');
    }

    // Login as superadmin
    console.log('3. Logging in as superadmin...');
    let superadminToken;
    try {
      superadminToken = await login(SUPERADMIN_CREDENTIALS);
      console.log('   ✅ Superadmin login successful\n');
    } catch (err) {
      console.error(`   ❌ Superadmin login failed: ${err.message}`);
      console.log('   Make sure superadmin user exists with credentials:');
      console.log(`   Email: ${SUPERADMIN_CREDENTIALS.email}`);
      console.log(`   Password: ${SUPERADMIN_CREDENTIALS.password}\n`);
      console.log('   Skipping superadmin test...\n');
      return;
    }

    // Test superadmin role SHOULD see login.success logs
    console.log('4. Testing superadmin role (should see login.success logs)...');
    const superRes = await fetch(`${API_BASE}/admin/logs`, {
      headers: {
        'Authorization': `Bearer ${superadminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!superRes.ok) {
      console.error(`   ❌ Failed: ${superRes.status} ${superRes.statusText}`);
      const errorText = await superRes.text();
      console.error(`   ${errorText}\n`);
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
      console.log('   Superadmin has full access to all audit logs\n');
    } else {
      console.log('\n   ⚠️  INFO: No login logs in database to verify superadmin access');
      console.log('   This is expected if no login events have occurred recently\n');
    }

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

testAuditLogFilter();
