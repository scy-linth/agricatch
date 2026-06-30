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

async function testCheckoutMOQ() {
  console.log('=== Checkout MOQ Testing ===\n');
  
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
  
  // Login as customer for checkout tests
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
  
  // Setup product with MOQ
  const productId = 162;
  const moq = 5;
  
  console.log(`3. Setting up product ${productId} with MOQ=${moq}...`);
  const updateRes = await makeRequest(`/api/products/${productId}`, 'PUT', {
    is_available: 'true',
    stock_quantity: 100,
    minimum_order_quantity: moq
  }, farmerToken);
  console.log(`Status: ${updateRes.status}\n`);
  
  // Add item to cart with valid MOQ quantity
  console.log(`4. Adding product to cart with valid MOQ quantity (${moq})...`);
  const addRes = await makeRequest('/api/cart', 'POST', {
    productId: productId,
    quantity: moq
  }, token);
  console.log(`Status: ${addRes.status}\n`);
  
  if (addRes.status !== 200 && addRes.status !== 201) {
    console.log('❌ Failed to add item to cart');
    return;
  }
  
  // Get cart to find the item
  const cartRes = await makeRequest('/api/cart', 'GET', null, token);
  if (cartRes.status !== 200) {
    console.log('❌ Failed to get cart');
    return;
  }
  
  const cartItems = cartRes.data.cartItems || [];
  const cartItem = cartItems.find(item => item.product_id === productId);
  
  if (!cartItem) {
    console.log('❌ Cart item not found');
    return;
  }
  
  console.log(`✅ Cart item found with quantity: ${cartItem.quantity}\n`);
  
  // Test 1: Update cart item to quantity below MOQ (should fail)
  console.log(`5. Testing update cart item to quantity below MOQ (${moq - 1})...`);
  const test1 = await makeRequest(`/api/cart/${cartItem.id}`, 'PUT', {
    quantity: moq - 1
  }, token);
  console.log(`Status: ${test1.status}`);
  console.log('Response:', test1.status === 400 ? '✅ Correctly rejected update below MOQ' : '❌ Should have rejected');
  if (test1.status === 400) console.log('Error:', test1.data.message);
  console.log();
  
  // Reset to valid quantity
  console.log(`6. Resetting cart item to valid MOQ quantity (${moq})...`);
  await makeRequest(`/api/cart/${cartItem.id}`, 'PUT', {
    quantity: moq
  }, token);
  console.log('✅ Reset successful\n');
  
  // Test 2: Create order with valid MOQ (should succeed)
  console.log(`7. Getting customer addresses...`);
  const addressRes = await makeRequest('/api/addresses', 'GET', null, token);
  let addressId = 1;
  
  if (addressRes.status === 200 && addressRes.data.length > 0) {
    addressId = addressRes.data[0].id;
    console.log(`✅ Using address ID: ${addressId}\n`);
  } else {
    console.log('⚠️  No addresses found, using default ID 1\n');
  }
  
  console.log(`8. Testing order creation with valid MOQ quantity (${moq})...`);
  const orderData = {
    address_id: addressId,
    payment_method: 'cod',
    notes: 'Testing MOQ validation'
  };
  
  const test2 = await makeRequest('/api/orders', 'POST', orderData, token);
  console.log(`Status: ${test2.status}`);
  console.log('Response:', test2.status === 201 || test2.status === 200 ? '✅ Order created successfully' : '❌ Failed');
  if (test2.status !== 201 && test2.status !== 200) console.log('Error:', test2.data.message || test2.data);
  console.log();
  
  // Add item back to cart for next test
  console.log(`9. Adding product back to cart for next test...`);
  await makeRequest('/api/cart', 'POST', {
    productId: productId,
    quantity: moq
  }, token);
  console.log('✅ Added\n');
  
  // Test 3: Update to below MOQ and try to checkout (should fail)
  console.log(`10. Testing checkout after updating to below MOQ (${moq - 1})...`);
  const test3 = await makeRequest(`/api/cart/${cartItem.id}`, 'PUT', {
    quantity: moq - 1
  }, token);
  
  if (test3.status === 400) {
    console.log('✅ Update correctly rejected');
  } else {
    console.log('⚠️  Update succeeded, trying checkout...');
    const test3Order = await makeRequest('/api/orders', 'POST', orderData, token);
    console.log(`Order Status: ${test3Order.status}`);
    console.log('Response:', test3Order.status === 400 ? '✅ Order correctly rejected' : '❌ Should have rejected');
    if (test3Order.status === 400) console.log('Error:', test3Order.data.message);
  }
  console.log();
  
  console.log('=== Checkout MOQ Test Complete ===');
}

testCheckoutMOQ().catch(console.error);
