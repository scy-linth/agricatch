// Endpoint Validation Script
// Tests the actual endpoints used by the frontend

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
let results = [];

function logResult(status, category, test, message, details = {}) {
  results.push({ status, category, test, message, details });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`[${icon}] ${category} - ${test}: ${message}`);
  if (Object.keys(details).length > 0) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
}

async function login(role) {
  const account = TEST_ACCOUNTS[role];
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password: account.password })
    });
    const data = await response.json();
    if (response.ok && data.token) {
      tokens[role] = data.token;
      logResult('pass', 'Authentication', `${role} login`, 'Successfully logged in', { userId: data.user?.id });
      return data.token;
    } else {
      logResult('fail', 'Authentication', `${role} login`, 'Login failed', { error: data.message });
      return null;
    }
  } catch (error) {
    logResult('fail', 'Authentication', `${role} login`, 'Request failed', { error: error.message });
    return null;
  }
}

async function testEndpoint(role, endpoint, method = 'GET', expectedStatus = 200) {
  try {
    const headers = { 'Authorization': `Bearer ${tokens[role]}` };
    const response = await fetch(`${BASE_URL}${endpoint}`, { method, headers });
    
    if (response.status === expectedStatus) {
      logResult('pass', 'API', `${method} ${endpoint}`, 'Request successful', { status: response.status });
      return { success: true, status: response.status, data: await response.json().catch(() => null) };
    } else {
      logResult('fail', 'API', `${method} ${endpoint}`, 'Unexpected status', { 
        expected: expectedStatus, 
        actual: response.status 
      });
      return { success: false, status: response.status };
    }
  } catch (error) {
    logResult('fail', 'API', `${method} ${endpoint}`, 'Request failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

async function testExcelEndpoint(role, endpoint, expectedStatus = 200) {
  try {
    const headers = { 'Authorization': `Bearer ${tokens[role]}` };
    const response = await fetch(`${BASE_URL}${endpoint}`, { method: 'GET', headers });
    
    if (response.status === expectedStatus) {
      const contentType = response.headers.get('Content-Type');
      const contentDisposition = response.headers.get('Content-Disposition');
      const buffer = await response.arrayBuffer();
      
      logResult('pass', 'Excel Export', endpoint, 'Excel file returned', { 
        status: response.status,
        contentType,
        contentDisposition,
        size: buffer.byteLength
      });
      return { success: true, status: response.status, size: buffer.byteLength };
    } else {
      logResult('fail', 'Excel Export', endpoint, 'Unexpected status', { 
        expected: expectedStatus, 
        actual: response.status 
      });
      return { success: false, status: response.status };
    }
  } catch (error) {
    logResult('fail', 'Excel Export', endpoint, 'Request failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('=== ENDPOINT VALIDATION ===\n');
  
  // Test 1: Admin Users Export
  console.log('--- TEST 1: Admin Users Export ---');
  await login('admin');
  if (tokens.admin) {
    // Frontend calls: /api/admin/users/export.xlsx
    await testExcelEndpoint('admin', '/api/admin/users/export.xlsx', 200);
  }
  
  // Test 2: Farmer Orders Export
  console.log('\n--- TEST 2: Farmer Orders Export ---');
  await login('farmer');
  if (tokens.farmer) {
    // Frontend calls: /api/farmers/me/orders/export.xlsx
    await testExcelEndpoint('farmer', '/api/farmers/me/orders/export.xlsx', 200);
  }
  
  // Test 3: Farmer Dashboard Endpoints
  console.log('\n--- TEST 3: Farmer Dashboard Endpoints ---');
  if (tokens.farmer) {
    // Frontend calls: /api/farmers/me/stats
    await testEndpoint('farmer', '/api/farmers/me/stats', 'GET', 200);
    
    // Frontend calls: /api/farmers/me/metrics
    await testEndpoint('farmer', '/api/farmers/me/metrics', 'GET', 200);
  }
  
  // Generate Report
  console.log('\n=== VALIDATION REPORT ===');
  const pass = results.filter(r => r.status === 'pass').length;
  const fail = results.filter(r => r.status === 'fail').length;
  const warn = results.filter(r => r.status === 'warn').length;
  const info = results.filter(r => r.status === 'info').length;
  
  console.log(`Total: ${results.length}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  console.log(`WARN: ${warn}`);
  console.log(`INFO: ${info}`);
  
  const report = {
    validationDate: new Date().toISOString(),
    summary: { total: results.length, pass, fail, warn, info },
    results
  };
  
  fs.writeFileSync('ENDPOINT_VALIDATION_REPORT.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to: ENDPOINT_VALIDATION_REPORT.json');
}

main().catch(console.error);
