// Runtime Express Routing Trace
// Tests endpoints and monitors backend server logs for middleware execution

const fs = require('fs');
const path = require('path');

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
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      tokens[role] = data.token;
      console.log(`✅ Login successful. User ID: ${data.user?.id}, Role: ${data.user?.role}`);
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

async function testEndpointWithTrace(role, endpoint, description) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TESTING: ${description}`);
  console.log(`{'='.repeat(70)}`);
  console.log(`Request: GET ${BASE_URL}${endpoint}`);
  console.log(`Role: ${role}`);
  console.log(`\n⚠️  MONITOR BACKEND SERVER CONSOLE FOR MIDDLEWARE LOGS`);
  console.log(`⚠️  Look for [requireRole] logs to prove middleware execution`);
  console.log(`\nSending request...`);
  
  if (!tokens[role]) {
    console.log(`❌ Cannot test - no token available`);
    return;
  }
  
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
    
    console.log(`\nResponse received in ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const contentType = response.headers.get('Content-Type');
    console.log(`Content-Type: ${contentType}`);
    
    if (response.status === 404) {
      console.log(`\n❌ 404 Not Found`);
      console.log(`\nANALYSIS:`);
      console.log(`If [requireRole] logs appeared in backend console:`);
      console.log(`  → Request reached middleware`);
      console.log(`  → Route was matched`);
      console.log(`  → Middleware may have blocked it`);
      console.log(`\nIf NO [requireRole] logs appeared in backend console:`);
      console.log(`  → Request NEVER reached middleware`);
      console.log(`  → Route was NOT matched`);
      console.log(`  → Express fell through to 404 handler`);
    } else if (response.status === 200) {
      console.log(`\n✅ 200 OK - Endpoint working`);
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('RUNTIME EXPRESS ROUTING TRACE');
  console.log('='.repeat(70));
  console.log('\n⚠️  INSTRUCTIONS:');
  console.log('1. Watch the backend server console window');
  console.log('2. Look for [requireRole] log messages');
  console.log('3. These logs prove whether middleware executed');
  console.log('4. No logs = route never matched');
  
  // Test 1: Admin Users Export
  await login('admin');
  if (tokens.admin) {
    await testEndpointWithTrace('admin', '/api/admin/users/export.xlsx', 'Admin Users Export');
  }
  
  // Test 2: Farmer Orders Export
  await login('farmer');
  if (tokens.farmer) {
    await testEndpointWithTrace('farmer', '/api/farmers/me/orders/export.xlsx', 'Farmer Orders Export');
  }
  
  // Test 3: Working endpoint for comparison
  if (tokens.admin) {
    await testEndpointWithTrace('admin', '/api/admin/orders/export.xlsx', 'Admin Orders Export (Working)');
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('TRACE COMPLETE');
  console.log('='.repeat(70));
  console.log('\nCHECK BACKEND SERVER CONSOLE FOR [requireRole] LOGS');
  console.log('Analyze whether middleware executed for each request');
}

main().catch(console.error);
