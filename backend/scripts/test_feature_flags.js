// Test script for feature flags
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

const BASE_URL = 'http://localhost:3000';

async function testRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

async function setFlag(key, enabled) {
  await pool.query(
    'UPDATE feature_flags SET enabled = $1 WHERE key = $2',
    [enabled, key]
  );
  console.log(`  Set ${key} = ${enabled}`);
}

async function testAllowRegistrations() {
  console.log('\n=== Testing allow_registrations ===');
  
  // Test with flag enabled (should allow registration attempt)
  await setFlag('allow_registrations', true);
  const res1 = await testRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser123',
      email: 'test123@example.com',
      password: 'testpassword123',
      role: 'customer'
    })
  });
  console.log(`  Enabled: status=${res1.status}, message=${res1.data?.message || res1.error}`);
  const enabledWorks = res1.status !== 403;
  
  // Test with flag disabled (should block)
  await setFlag('allow_registrations', false);
  const res2 = await testRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser456',
      email: 'test456@example.com',
      password: 'testpassword123',
      role: 'customer'
    })
  });
  console.log(`  Disabled: status=${res2.status}, message=${res2.data?.message || res2.error}`);
  const disabledWorks = res2.status === 403;
  
  // Reset
  await setFlag('allow_registrations', true);
  
  return enabledWorks && disabledWorks;
}

async function testMaintenanceMode() {
  console.log('\n=== Testing maintenance_mode ===');
  
  // Test with flag disabled (should allow access)
  await setFlag('maintenance_mode', false);
  const res1 = await testRequest(`${BASE_URL}/api/products`);
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || res1.error}`);
  const disabledWorks = res1.status === 200;
  
  // Test with flag enabled (should block non-super_admin)
  await setFlag('maintenance_mode', true);
  const res2 = await testRequest(`${BASE_URL}/api/products`);
  console.log(`  Enabled (no token): status=${res2.status}, message=${res2.data?.message || res2.error}`);
  const enabledWorks = res2.status === 503;
  
  // Reset
  await setFlag('maintenance_mode', false);
  
  return disabledWorks && enabledWorks;
}

async function testPlatformAnnounce() {
  console.log('\n=== Testing platform_announce ===');
  
  // Test with flag disabled (should block)
  await setFlag('platform_announce', false);
  const res1 = await testRequest(`${BASE_URL}/api/superadmin/announcements`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({
      title: 'Test',
      message: 'Test message'
    })
  });
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || res1.error}`);
  const disabledWorks = res1.status === 403;
  
  // Test with flag enabled (should pass middleware but fail auth)
  await setFlag('platform_announce', true);
  const res2 = await testRequest(`${BASE_URL}/api/superadmin/announcements`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({
      title: 'Test',
      message: 'Test message'
    })
  });
  console.log(`  Enabled (invalid auth): status=${res2.status}, message=${res2.data?.message || res2.error}`);
  const enabledWorks = res2.status !== 403; // Should be 401 or 403 from auth, not from feature flag
  
  // Reset
  await setFlag('platform_announce', false);
  
  return disabledWorks && enabledWorks;
}

async function testPriceDropAlerts() {
  console.log('\n=== Testing price_drop_alerts ===');
  
  // Test with flag disabled (should block)
  await setFlag('price_drop_alerts', false);
  const res1 = await testRequest(`${BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({ productId: 1 })
  });
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || res1.error}`);
  const disabledWorks = res1.status === 403;
  
  // Test with flag enabled (should pass middleware but fail auth)
  await setFlag('price_drop_alerts', true);
  const res2 = await testRequest(`${BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({ productId: 1 })
  });
  console.log(`  Enabled (invalid auth): status=${res2.status}, message=${res2.data?.message || res2.error}`);
  const enabledWorks = res2.status !== 403; // Should be 401 from auth, not from feature flag
  
  // Reset
  await setFlag('price_drop_alerts', true);
  
  return disabledWorks && enabledWorks;
}

async function runTests() {
  console.log('Starting Feature Flags Test...');
  console.log('============================');
  
  try {
    const results = {
      allow_registrations: await testAllowRegistrations(),
      maintenance_mode: await testMaintenanceMode(),
      platform_announce: await testPlatformAnnounce(),
      price_drop_alerts: await testPriceDropAlerts()
    };
    
    console.log('\n============================');
    console.log('TEST RESULTS:');
    console.log('============================');
    let allPassed = true;
    for (const [flag, passed] of Object.entries(results)) {
      console.log(`  ${flag}: ${passed ? 'PASS' : 'FAIL'}`);
      if (!passed) allPassed = false;
    }
    console.log('============================');
    console.log(allPassed ? 'All tests PASSED!' : 'Some tests FAILED!');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pool.end();
  }
}

runTests();
