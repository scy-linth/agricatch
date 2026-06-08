// Simple HTTP test for feature flags
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

async function testPriceDropAlerts() {
  console.log('\n=== Test price_drop_alerts ===');
  
  const res1 = await testRequest(`${BASE_URL}/api/wishlist`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-token'
    },
    body: JSON.stringify({ productId: 1 })
  });
  console.log(`Current state: status=${res1.status}, message=${res1.data?.message || 'none'}`);
}

async function testMaintenanceMode() {
  console.log('\n=== Test maintenance_mode ===');
  
  const res1 = await testRequest(`${BASE_URL}/api/products`);
  console.log(`GET /api/products: status=${res1.status}, items=${res1.data?.items?.length || 'N/A'}`);
}

async function testAllowRegistrations() {
  console.log('\n=== Test allow_registrations ===');
  
  const res1 = await testRequest(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser999',
      email: 'test999@example.com',
      password: 'testpassword123',
      role: 'customer'
    })
  });
  console.log(`POST /api/auth/register: status=${res1.status}, message=${res1.data?.message || 'none'}`);
}

async function runTests() {
  await testMaintenanceMode();
  await testPriceDropAlerts();
  await testAllowRegistrations();
  console.log('\nDone.');
}

runTests().catch(console.error);
