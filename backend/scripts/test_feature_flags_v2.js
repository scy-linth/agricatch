// Test script for feature flags - v2 (checks specific messages)
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
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) {}
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
  
  await setFlag('allow_registrations', false);
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
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || 'none'}`);
  const disabledWorks = res1.status === 403 && res1.data?.message?.includes('currently disabled');
  
  await setFlag('allow_registrations', true);
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
  console.log(`  Enabled: status=${res2.status}, message=${res2.data?.message || 'none'}`);
  const enabledWorks = res2.status !== 403 || !res2.data?.message?.includes('currently disabled');
  
  return disabledWorks && enabledWorks;
}

async function testMaintenanceMode() {
  console.log('\n=== Testing maintenance_mode ===');
  
  await setFlag('maintenance_mode', false);
  const res1 = await testRequest(`${BASE_URL}/api/products`);
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || 'none'}`);
  const disabledWorks = res1.status === 200;
  
  await setFlag('maintenance_mode', true);
  const res2 = await testRequest(`${BASE_URL}/api/products`);
  console.log(`  Enabled: status=${res2.status}, message=${res2.data?.message || 'none'}`);
  const enabledWorks = res2.status === 503 && res2.data?.message?.includes('maintenance');
  
  await setFlag('maintenance_mode', false);
  
  return disabledWorks && enabledWorks;
}

async function testPlatformAnnounce() {
  console.log('\n=== Testing platform_announce ===');
  
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
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || 'none'}`);
  const disabledWorks = res1.status === 403 && res1.data?.message?.includes('currently disabled');
  
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
  console.log(`  Enabled (invalid auth): status=${res2.status}, message=${res2.data?.message || 'none'}`);
  const enabledWorks = res2.status !== 403 || !res2.data?.message?.includes('currently disabled');
  
  await setFlag('platform_announce', false);
  
  return disabledWorks && enabledWorks;
}

async function testPriceDropAlerts() {
  console.log('\n=== Testing price_drop_alerts ===');
  
  await setFlag('price_drop_alerts', false);
  const res1 = await testRequest(`${BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({ productId: 1 })
  });
  console.log(`  Disabled: status=${res1.status}, message=${res1.data?.message || 'none'}`);
  const disabledWorks = res1.status === 403 && res1.data?.message?.includes('currently disabled');
  
  await setFlag('price_drop_alerts', true);
  const res2 = await testRequest(`${BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({ productId: 1 })
  });
  console.log(`  Enabled (invalid auth): status=${res2.status}, message=${res2.data?.message || 'none'}`);
  const enabledWorks = res2.status !== 403 || !res2.data?.message?.includes('currently disabled');
  
  await setFlag('price_drop_alerts', true);
  
  return disabledWorks && enabledWorks;
}

async function runTests() {
  console.log('Starting Feature Flags Test v2...');
  console.log('==================================');
  
  try {
    const results = {
      allow_registrations: await testAllowRegistrations(),
      maintenance_mode: await testMaintenanceMode(),
      platform_announce: await testPlatformAnnounce(),
      price_drop_alerts: await testPriceDropAlerts()
    };
    
    console.log('\n==================================');
    console.log('TEST RESULTS:');
    console.log('==================================');
    let allPassed = true;
    for (const [flag, passed] of Object.entries(results)) {
      console.log(`  ${flag}: ${passed ? 'PASS' : 'FAIL'}`);
      if (!passed) allPassed = false;
    }
    console.log('==================================');
    console.log(allPassed ? 'All tests PASSED!' : 'Some tests FAILED!');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pool.end();
  }
}

runTests();
