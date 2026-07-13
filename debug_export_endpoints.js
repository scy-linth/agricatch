// Debug Export Endpoints - Root Cause Analysis
// Tests the exact request flow for export endpoints

const fs = require('fs');
const path = require('path');

// Use native fetch (Node.js 18+)
if (!global.fetch) {
  console.error('This script requires Node.js 18+ with native fetch support');
  process.exit(1);
}

const BASE_URL = 'http://localhost:3000';
const TEST_ACCOUNTS = {
  admin: { email: 'testadmin@test.com', password: 'NewPassword123', role: 'admin', id: 43 },
  farmer: { email: 'testfarmer@test.com', password: 'Test123456', role: 'farmer', id: 42 }
};

let tokens = {};

async function login(role) {
  const account = TEST_ACCOUNTS[role];
  console.log(`\n=== LOGIN: ${role.toUpperCase()} ===`);
  console.log(`Email: ${account.email}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    
    console.log(`Login Response Status: ${response.status}`);
    
    const data = await response.json();
    console.log(`Login Response Data:`, JSON.stringify(data, null, 2));
    
    if (response.ok && data.token) {
      tokens[role] = data.token;
      console.log(`✅ Login successful. Token obtained.`);
      console.log(`User ID: ${data.user?.id}, Role: ${data.user?.role}`);
      return data.token;
    } else {
      console.log(`❌ Login failed: ${data.message}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Login request failed: ${error.message}`);
    return null;
  }
}

async function testExportEndpoint(role, endpoint, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING: ${description}`);
  console.log(`{'='.repeat(60)}`);
  console.log(`Role: ${role}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Token: ${tokens[role] ? 'Present' : 'Missing'}`);
  
  if (!tokens[role]) {
    console.log(`❌ Cannot test - no token available`);
    return;
  }
  
  console.log(`\n--- STEP 1: Frontend Request ---`);
  console.log(`Method: GET`);
  console.log(`URL: ${BASE_URL}${endpoint}`);
  console.log(`Headers: Authorization: Bearer ${tokens[role].substring(0, 20)}...`);
  
  console.log(`\n--- STEP 2: Network Request ---`);
  console.log(`Sending request...`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${tokens[role]}`,
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });
    const endTime = Date.now();
    
    console.log(`Response received in ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Status Code: ${response.status}`);
    
    console.log(`\n--- STEP 3: Response Headers ---`);
    response.headers.forEach((value, name) => {
      console.log(`${name}: ${value}`);
    });
    
    console.log(`\n--- STEP 4: Response Body ---`);
    const contentType = response.headers.get('Content-Type');
    console.log(`Content-Type: ${contentType}`);
    
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      console.log(`Response Body (JSON):`, JSON.stringify(json, null, 2));
    } else if (contentType && contentType.includes('excel')) {
      const buffer = await response.arrayBuffer();
      console.log(`Response Body: Excel file (${buffer.byteLength} bytes)`);
    } else {
      const text = await response.text();
      console.log(`Response Body (Text):`, text.substring(0, 500));
    }
    
    console.log(`\n--- ANALYSIS ---`);
    if (response.status === 404) {
      console.log(`❌ 404 Not Found`);
      console.log(`Possible causes:`);
      console.log(`1. Route not registered in Express router`);
      console.log(`2. Route mounted at wrong path`);
      console.log(`3. Conflicting route matched instead`);
      console.log(`4. Middleware blocking before route handler`);
    } else if (response.status === 401) {
      console.log(`❌ 401 Unauthorized`);
      console.log(`Possible causes:`);
      console.log(`1. Missing or invalid token`);
      console.log(`2. Token expired`);
    } else if (response.status === 403) {
      console.log(`❌ 403 Forbidden`);
      console.log(`Possible causes:`);
      console.log(`1. Insufficient permissions`);
      console.log(`2. Role not allowed`);
    } else if (response.status === 200) {
      console.log(`✅ 200 OK - Endpoint working`);
    } else {
      console.log(`⚠️ Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    console.log(`Error stack:`, error.stack);
  }
}

async function testRouteVariations(role, basePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING ROUTE VARIATIONS`);
  console.log(`{'='.repeat(60)}`);
  
  const variations = [
    basePath,
    basePath.replace('/api/', ''),
    basePath.replace('/api', ''),
  ];
  
  for (const variation of variations) {
    console.log(`\nTesting variation: ${variation}`);
    try {
      const response = await fetch(`${BASE_URL}${variation}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokens[role]}` }
      });
      console.log(`  Status: ${response.status}`);
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('EXPORT ENDPOINTS ROOT CAUSE ANALYSIS');
  console.log('='.repeat(60));
  
  // Test 1: Admin Users Export
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST 1: ADMIN USERS EXPORT');
  console.log('='.repeat(60));
  
  await login('admin');
  if (tokens.admin) {
    await testExportEndpoint('admin', '/api/admin/users/export.xlsx', 'Admin Users Export');
    await testRouteVariations('admin', '/api/admin/users/export.xlsx');
  }
  
  // Test 2: Farmer Orders Export
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST 2: FARMER ORDERS EXPORT');
  console.log('='.repeat(60));
  
  await login('farmer');
  if (tokens.farmer) {
    await testExportEndpoint('farmer', '/api/farmers/me/orders/export.xlsx', 'Farmer Orders Export');
    await testRouteVariations('farmer', '/api/farmers/me/orders/export.xlsx');
  }
  
  // Test 3: Compare with working endpoints
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST 3: COMPARISON WITH WORKING ENDPOINTS');
  console.log('='.repeat(60));
  
  if (tokens.admin) {
    await testExportEndpoint('admin', '/api/admin/orders/export.xlsx', 'Admin Orders Export (Working)');
  }
  
  if (tokens.farmer) {
    await testExportEndpoint('farmer', '/api/farmers/me/stats', 'Farmer Stats (Working)');
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
