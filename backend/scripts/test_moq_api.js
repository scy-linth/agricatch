const http = require('http');

const API_BASE = 'http://localhost:3000/api';

async function makeRequest(path, method, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testMOQ() {
  console.log('=== MOQ API Testing ===\n');
  
  // Login first
  console.log('1. Logging in as testfarmer@test.com...');
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'testfarmer@test.com',
    password: 'Test123456'
  });
  
  if (loginRes.status !== 200) {
    console.log('❌ Login failed:', loginRes.data);
    return;
  }
  
  const token = loginRes.data.token;
  console.log('✅ Login successful\n');
  
  // Use vegetable category (ID 3 based on existing products)
  const vegetableCategoryId = 3;
  
  // Test 1: Valid MOQ
  console.log('2. Testing valid MOQ (5)...');
  const test1 = await makeRequest('/api/products', 'POST', {
    name: 'MOQ Test Product Valid',
    description: 'Testing valid MOQ',
    price: 50,
    category_id: vegetableCategoryId,
    unit: 'kg',
    location: 'Metro Manila',
    stock_quantity: 100,
    minimum_order_quantity: 5,
    is_preorder: 'false',
    is_available: 'true'
  }, token);
  console.log(`Status: ${test1.status}`);
  console.log('Response:', test1.status === 201 ? '✅ Product created with valid MOQ' : '❌ Failed');
  if (test1.status !== 201) console.log('Error:', test1.data.message || test1.data);
  console.log();
  
  // Test 2: Invalid MOQ (0)
  console.log('3. Testing invalid MOQ (0)...');
  const test2 = await makeRequest('/api/products', 'POST', {
    name: 'MOQ Test Product Zero',
    description: 'Testing MOQ = 0',
    price: 50,
    category_id: vegetableCategoryId,
    unit: 'kg',
    location: 'Metro Manila',
    stock_quantity: 100,
    minimum_order_quantity: 0,
    is_preorder: 'false',
    is_available: 'true'
  }, token);
  console.log(`Status: ${test2.status}`);
  console.log('Response:', test2.status === 400 ? '✅ Correctly rejected MOQ = 0' : '❌ Should have rejected');
  if (test2.status === 400) console.log('Error:', test2.data.message);
  console.log();
  
  // Test 3: Negative MOQ
  console.log('4. Testing negative MOQ (-5)...');
  const test3 = await makeRequest('/api/products', 'POST', {
    name: 'MOQ Test Product Negative',
    description: 'Testing negative MOQ',
    price: 50,
    category_id: vegetableCategoryId,
    unit: 'kg',
    location: 'Metro Manila',
    stock_quantity: 100,
    minimum_order_quantity: -5,
    is_preorder: 'false',
    is_available: 'true'
  }, token);
  console.log(`Status: ${test3.status}`);
  console.log('Response:', test3.status === 400 ? '✅ Correctly rejected negative MOQ' : '❌ Should have rejected');
  if (test3.status === 400) console.log('Error:', test3.data.message);
  console.log();
  
  // Test 4: No MOQ (should default to 1)
  console.log('5. Testing no MOQ (should default to 1)...');
  const test4 = await makeRequest('/api/products', 'POST', {
    name: 'MOQ Test Product None',
    description: 'Testing no MOQ',
    price: 50,
    category_id: vegetableCategoryId,
    unit: 'kg',
    location: 'Metro Manila',
    stock_quantity: 100,
    is_preorder: 'false',
    is_available: 'true'
  }, token);
  console.log(`Status: ${test4.status}`);
  console.log('Response:', test4.status === 201 ? '✅ Product created without MOQ (defaults to 1)' : '❌ Failed');
  if (test4.status !== 201) console.log('Error:', test4.data.message || test4.data);
  console.log();
  
  console.log('=== Test Complete ===');
}

testMOQ().catch(console.error);
