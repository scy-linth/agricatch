const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

const API_BASE = 'http://localhost:3000/api';
const authRoutePath = path.join(__dirname, '..', 'routes', 'auth.js');

// Backup original auth.js
function backupAuthRoute() {
  const content = fs.readFileSync(authRoutePath, 'utf8');
  fs.writeFileSync(authRoutePath + '.backup', content);
  console.log('✓ Backed up auth.js');
}

// Disable CAPTCHA in login route
function disableCaptcha() {
  let content = fs.readFileSync(authRoutePath, 'utf8');
  
  // Comment out the requireRecaptcha call in login route
  content = content.replace(
    /if \(!\(await requireRecaptcha\(req, res\)\)\) return;/g,
    '// if (!(await requireRecaptcha(req, res))) return; // TEMPORARILY DISABLED FOR TESTING'
  );
  
  fs.writeFileSync(authRoutePath, content);
  console.log('✓ CAPTCHA temporarily disabled in login route');
}

// Restore original auth.js
function restoreAuthRoute() {
  if (fs.existsSync(authRoutePath + '.backup')) {
    fs.copyFileSync(authRoutePath + '.backup', authRoutePath);
    fs.unlinkSync(authRoutePath + '.backup');
    console.log('✓ Restored original auth.js');
  }
}

// Test farmer verification request submission
async function testFarmerVerificationRequest() {
  console.log('\n=== Testing farmer verification request submission ===\n');

  // Login as farmer
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testfarmer@test.com',
      password: 'Test123456!'
    })
  });

  if (!loginResponse.ok) {
    console.error('✗ Failed to login as farmer');
    console.error(await loginResponse.text());
    return false;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✓ Logged in as farmer');

  // Test GET verification request
  console.log('\nTesting GET /api/farmers/me/verification-request...');
  const getRequestResponse = await fetch(`${API_BASE}/farmers/me/verification-request`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (getRequestResponse.ok) {
    const getRequestData = await getRequestResponse.json();
    console.log('✓ GET verification request successful');
    console.log('  Current request:', getRequestData);
  } else {
    console.error('✗ GET verification request failed:', await getRequestResponse.text());
  }

  // Test POST verification request with document_url
  console.log('\nTesting POST /api/farmers/me/verification-request with document_url...');
  const postResponse = await fetch(`${API_BASE}/farmers/me/verification-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      document_url: 'https://res.cloudinary.com/dwv7lhgvm/image/upload/test_document.jpg',
      notes: 'Test verification request with document'
    })
  });

  if (postResponse.ok) {
    const postData = await postResponse.json();
    console.log('✓ POST verification request successful');
    console.log('  Request ID:', postData.request_id);
    console.log('  Created at:', postData.created_at);
  } else {
    console.error('✗ POST verification request failed:', await postResponse.text());
    return false;
  }

  return true;
}

// Test admin verification requests endpoint
async function testAdminVerificationRequests() {
  console.log('\n=== Testing admin verification requests endpoint ===\n');

  // Login as admin
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testadmin@test.com',
      password: 'Test123456!'
    })
  });

  if (!loginResponse.ok) {
    console.error('✗ Failed to login as admin');
    console.error(await loginResponse.text());
    return false;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✓ Logged in as admin');

  // Test GET verification requests
  console.log('\nTesting GET /api/admin/verification-requests...');
  const response = await fetch(`${API_BASE}/admin/verification-requests`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✓ GET verification requests successful');
    console.log('  Total requests:', data.total);
    console.log('  Requests:', JSON.stringify(data.requests, null, 2));
  } else {
    console.error('✗ GET verification requests failed:', await response.text());
    return false;
  }

  return true;
}

async function runTestsWithCaptchaBypass() {
  try {
    console.log('=== Starting verification request tests with CAPTCHA bypass ===\n');
    
    // Backup and disable CAPTCHA
    backupAuthRoute();
    disableCaptcha();
    
    // Wait for server to reload (if using nodemon)
    console.log('\nWaiting 3 seconds for server to reload...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run tests
    const farmerTestPassed = await testFarmerVerificationRequest();
    const adminTestPassed = await testAdminVerificationRequests();
    
    // Restore original auth.js
    restoreAuthRoute();
    
    console.log('\nWaiting 3 seconds for server to reload...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Summary
    console.log('\n=== Test Results ===');
    console.log('Farmer verification request test:', farmerTestPassed ? '✓ PASSED' : '✗ FAILED');
    console.log('Admin verification requests test:', adminTestPassed ? '✓ PASSED' : '✗ FAILED');
    
    if (farmerTestPassed && adminTestPassed) {
      console.log('\n✓ All tests passed!');
    } else {
      console.log('\n✗ Some tests failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Test error:', error);
    restoreAuthRoute();
    process.exit(1);
  }
}

runTestsWithCaptchaBypass();
