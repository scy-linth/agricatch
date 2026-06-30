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

async function testCartMOQ() {
  console.log('=== Cart MOQ Testing ===\n');
  
  // Login as farmer to make product available
  console.log('1. Logging in as testfarmer@test.com to update product...');
  const farmerLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'testfarmer@test.com',
    password: 'Test123456'
  });
  
  if (farmerLoginRes.status !== 200) {
    console.log('❌ Farmer login failed:', farmerLoginRes.data);
    return;
  }
  
  const farmerToken = farmerLoginRes.data.token;
  console.log('✅ Farmer login successful\n');
  
  // Login as customer for cart tests
  console.log('2. Logging in as testcustomer@test.com...');
  const customerLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'testcustomer@test.com',
    password: 'Test123456'
  });
  
  if (customerLoginRes.status !== 200) {
    console.log('❌ Customer login failed:', customerLoginRes.data);
    return;
  }
  
  const token = customerLoginRes.data.token;
  console.log('✅ Customer login successful\n');
  
  // First, get a product with MOQ
  console.log('3. Getting products to find one with MOQ...');
  const productsRes = await makeRequest('/api/products', 'GET', null, token);
  
  if (productsRes.status !== 200) {
    console.log('❌ Failed to get products');
    return;
  }
  
  const products = productsRes.data.products || productsRes.data;
  const moqProduct = products.find(p => p.minimum_order_quantity && p.minimum_order_quantity > 1);
  
  if (!moqProduct) {
    console.log('❌ No product with MOQ > 1 found. Using product ID 162 which should have MOQ=5 from previous test');
  } else {
    console.log(`✅ Found product: ${moqProduct.name} with MOQ: ${moqProduct.minimum_order_quantity}`);
  }
  
  const productId = moqProduct ? moqProduct.id : 162;
  const moq = moqProduct ? moqProduct.minimum_order_quantity : 5;
  
  // Verify the product's actual MOQ
  console.log(`\n3.5. Verifying product ${productId} has MOQ=${moq}...`);
  const productDetailRes = await makeRequest(`/api/products/${productId}`, 'GET', null, farmerToken);
  if (productDetailRes.status === 200) {
    const actualMOQ = productDetailRes.data.minimum_order_quantity;
    console.log(`Actual MOQ: ${actualMOQ}`);
    if (actualMOQ !== moq) {
      console.log(`⚠️  Expected MOQ=${moq} but found ${actualMOQ}. Using actual value.`);
    }
  }
  
  // First, make the product available if it's not
  console.log(`\n3.6. Making product ${productId} available with sufficient stock and MOQ for testing...`);
  const updateRes = await makeRequest(`/api/products/${productId}`, 'PUT', {
    is_available: 'true',
    stock_quantity: 100,
    minimum_order_quantity: moq
  }, farmerToken);
  console.log(`Status: ${updateRes.status}`);
  console.log();
  
  // Test 1: Add to cart with quantity below MOQ
  console.log(`\n4. Testing add to cart with quantity below MOQ (${moq - 1})...`);
  const test1 = await makeRequest('/api/cart', 'POST', {
    productId: productId,
    quantity: moq - 1
  }, token);
  console.log(`Status: ${test1.status}`);
  console.log('Response:', test1.status === 400 ? '✅ Correctly rejected quantity below MOQ' : '❌ Should have rejected');
  if (test1.status === 400) console.log('Error:', test1.data.message);
  console.log();
  
  // Test 2: Add to cart with quantity equal to MOQ
  console.log(`5. Testing add to cart with quantity equal to MOQ (${moq})...`);
  const test2 = await makeRequest('/api/cart', 'POST', {
    productId: productId,
    quantity: moq
  }, token);
  console.log(`Status: ${test2.status}`);
  console.log('Response:', test2.status === 201 || test2.status === 200 ? '✅ Successfully added with MOQ quantity' : '❌ Failed');
  if (test2.status !== 201 && test2.status !== 200) console.log('Error:', test2.data.message || test2.data);
  console.log();
  
  // Test 3: Add to cart with quantity above MOQ
  console.log(`6. Testing add to cart with quantity above MOQ (${moq + 5})...`);
  const test3 = await makeRequest('/api/cart', 'POST', {
    productId: productId,
    quantity: moq + 5
  }, token);
  console.log(`Status: ${test3.status}`);
  console.log('Response:', test3.status === 201 || test3.status === 200 ? '✅ Successfully added with quantity above MOQ' : '❌ Failed');
  if (test3.status !== 201 && test3.status !== 200) console.log('Error:', test3.data.message || test3.data);
  console.log();
  
  // Test 4: Update cart item to quantity below MOQ
  console.log(`7. Testing update cart item to quantity below MOQ (${moq - 1})...`);
  // First get cart to find the item
  const cartRes = await makeRequest('/api/cart', 'GET', null, token);
  if (cartRes.status === 200) {
    const cartItems = cartRes.data.cartItems || [];
    const cartItem = cartItems.find(item => item.product_id === productId);
    
    if (cartItem) {
      const test4 = await makeRequest(`/api/cart/${cartItem.id}`, 'PUT', {
        quantity: moq - 1
      }, token);
      console.log(`Status: ${test4.status}`);
      console.log('Response:', test4.status === 400 ? '✅ Correctly rejected update below MOQ' : '❌ Should have rejected');
      if (test4.status === 400) console.log('Error:', test4.data.message);
    } else {
      console.log('⚠️  Cart item not found, skipping update test');
    }
  }
  console.log();
  
  console.log('=== Cart MOQ Test Complete ===');
}

testCartMOQ().catch(console.error);
