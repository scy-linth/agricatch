const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

// Test farmer verification request submission
async function testFarmerVerificationRequest() {
  console.log('Testing farmer verification request submission...\n');

  // First, login as a farmer to get a token
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@test.testy',
      password: 'password123'
    })
  });

  if (!loginResponse.ok) {
    console.error('Failed to login as farmer');
    console.error(await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✓ Logged in as farmer');
  console.log('Token:', token.substring(0, 50) + '...\n');

  // Test GET verification request (should return null or existing request)
  console.log('Testing GET /api/farmers/me/verification-request...');
  const getRequestResponse = await fetch(`${API_BASE}/farmers/me/verification-request`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (getRequestResponse.ok) {
    const getRequestData = await getRequestResponse.json();
    console.log('✓ GET verification request response:', JSON.stringify(getRequestData, null, 2));
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
    console.log('✓ POST verification request successful:', JSON.stringify(postData, null, 2));
  } else {
    console.error('✗ POST verification request failed:', await postResponse.text());
  }

  // Test POST without document_url (optional)
  console.log('\nTesting POST /api/farmers/me/verification-request without document_url...');
  const postResponse2 = await fetch(`${API_BASE}/farmers/me/verification-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      notes: 'Test verification request without document'
    })
  });

  if (postResponse2.ok) {
    const postData2 = await postResponse2.json();
    console.log('✓ POST verification request (no doc) successful:', JSON.stringify(postData2, null, 2));
  } else {
    console.error('✗ POST verification request (no doc) failed:', await postResponse2.text());
  }
}

// Test admin verification requests endpoint
async function testAdminVerificationRequests() {
  console.log('\n\nTesting admin verification requests endpoint...\n');

  // Login as admin
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@agricatch.com',
      password: 'admin123'
    })
  });

  if (!loginResponse.ok) {
    console.error('Failed to login as admin');
    console.error(await loginResponse.text());
    return;
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
    console.log('Total:', data.total);
    console.log('Requests:', JSON.stringify(data.requests, null, 2));
  } else {
    console.error('✗ GET verification requests failed:', await response.text());
  }
}

async function runTests() {
  try {
    await testFarmerVerificationRequest();
    await testAdminVerificationRequests();
    console.log('\n\nAll tests completed!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTests();
