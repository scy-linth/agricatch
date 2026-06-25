const { test, expect } = require('@playwright/test');

/**
 * QA Verification Tests for Hybrid Preorder System Fixes
 * 
 * These tests verify the 6 critical fixes implemented:
 * 1. Race condition in stock/reservation updates
 * 2. Preorder cancellation releases reserved quantity correctly
 * 3. Conversion quantity parsing and validation
 * 4. Harvest quantity validation
 * 5. Per-order preorder allocation tracking
 * 6. Unsafe preorder product edit protection
 */

const API_BASE = 'http://localhost:3000/api';

// Helper to get auth token
async function getAuthToken(page, email, password) {
  const response = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email, password }
  });
  const data = await response.json();
  return data.token;
}

// Helper to create a farmer and get token
async function createFarmerAndProduct(page) {
  const farmerEmail = `testfarmer${Date.now()}@test.com`;
  const farmerPassword = 'Test123456';
  
  // Register farmer
  await page.request.post(`${API_BASE}/auth/register`, {
    data: {
      email: farmerEmail,
      password: farmerPassword,
      role: 'farmer',
      shop_name: 'Test Shop',
      first_name: 'Test',
      last_name: 'Farmer'
    }
  });
  
  const token = await getAuthToken(page, farmerEmail, farmerPassword);
  
  // Create a preorder product
  const productResponse = await page.request.post(`${API_BASE}/products`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: {
      name: 'Test Preorder Product',
      description: 'Test description',
      price: 100,
      category_id: 1,
      stock_quantity: 0,
      unit: 'kg',
      is_preorder: true,
      preorder_availability_date: '2026-12-31',
      max_preorder_quantity: 50
    }
  });
  
  const product = await productResponse.json();
  return { token, product, farmerEmail, farmerPassword };
}

// Helper to create a customer
async function createCustomer(page) {
  const customerEmail = `testcustomer${Date.now()}@test.com`;
  const customerPassword = 'Test123456';
  
  await page.request.post(`${API_BASE}/auth/register`, {
    data: {
      email: customerEmail,
      password: customerPassword,
      role: 'customer',
      first_name: 'Test',
      last_name: 'Customer'
    }
  });
  
  const token = await getAuthToken(page, customerEmail, customerPassword);
  return { token, customerEmail, customerPassword };
}

test.describe('Preorder QA Verification', () => {
  
  test('1. Race condition in stock/reservation updates', async ({ page }) => {
    console.log('\n=== TEST 1: Race Condition in Stock/Reservation Updates ===');
    console.log('Test Steps:');
    console.log('1. Create a preorder product with max_preorder_quantity = 10');
    console.log('2. Submit 5 concurrent orders for 3 units each (total 15, exceeds limit)');
    console.log('3. Verify only orders that fit within limit succeed');
    console.log('4. Verify reserved_quantity never exceeds max_preorder_quantity');
    
    const { token: farmerToken, product } = await createFarmerAndProduct(page);
    
    // Update product to have specific limits (use FormData)
    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('description', product.description);
    formData.append('price', product.price);
    formData.append('category_id', product.category_id);
    formData.append('stock_quantity', product.stock_quantity);
    formData.append('unit', product.unit);
    formData.append('is_preorder', 'true');
    formData.append('preorder_availability_date', product.preorder_availability_date);
    formData.append('max_preorder_quantity', '10');
    
    await page.request.put(`${API_BASE}/products/${product.id}`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      },
      data: formData
    });
    
    // Create 5 customers
    const customers = [];
    for (let i = 0; i < 5; i++) {
      customers.push(await createCustomer(page));
    }
    
    // Add product to each customer's cart
    for (const customer of customers) {
      await page.request.post(`${API_BASE}/cart`, {
        headers: { 'Authorization': `Bearer ${customer.token}` },
        data: { product_id: product.id, quantity: 3 }
      });
    }
    
    // Submit orders concurrently
    const orderPromises = customers.map(customer =>
      page.request.post(`${API_BASE}/orders`, {
        headers: {
          'Authorization': `Bearer ${customer.token}`,
          'Content-Type': 'application/json'
        },
        data: {
          delivery_address: 'Test Address',
          delivery_date: '2026-12-31'
        }
      })
    );
    
    const results = await Promise.allSettled(orderPromises);
    
    // Count successful orders
    let successfulOrders = 0;
    let failedOrders = 0;
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.ok()) {
        successfulOrders++;
      } else {
        failedOrders++;
      }
    }
    
    // Check final reserved_quantity
    const productCheck = await page.request.get(`${API_BASE}/products/${product.id}`);
    const productData = await productCheck.json();
    
    console.log('\nResults:');
    console.log(`Successful orders: ${successfulOrders}`);
    console.log(`Failed orders: ${failedOrders}`);
    console.log(`Final reserved_quantity: ${productData.reserved_quantity}`);
    console.log(`max_preorder_quantity: ${productData.max_preorder_quantity}`);
    
    // Verification
    const reservedWithinLimit = productData.reserved_quantity <= productData.max_preorder_quantity;
    const ordersLimited = successfulOrders <= 3; // At most 3 orders of 3 units = 9
    
    if (reservedWithinLimit && ordersLimited) {
      console.log('\n✅ PASS: Race condition prevented - reserved_quantity never exceeded limit');
    } else {
      console.log('\n❌ FAIL: Race condition not prevented');
      console.log(`   reserved_quantity (${productData.reserved_quantity}) > max (${productData.max_preorder_quantity})`);
    }
    
    expect(reservedWithinLimit).toBe(true);
  });
  
  test('2. Preorder cancellation releases reserved quantity correctly', async ({ page }) => {
    console.log('\n=== TEST 2: Preorder Cancellation Releases Reserved Quantity ===');
    console.log('Test Steps:');
    console.log('1. Create a preorder product');
    console.log('2. Customer places a preorder order');
    console.log('3. Verify reserved_quantity increased');
    console.log('4. Customer cancels the order');
    console.log('5. Verify reserved_quantity decreased (not stock_quantity)');
    
    const { token: farmerToken, product } = await createFarmerAndProduct(page);
    const { token: customerToken } = await createCustomer(page);
    
    // Add to cart and place order
    await page.request.post(`${API_BASE}/cart`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      data: { product_id: product.id, quantity: 5 }
    });
    
    const orderResponse = await page.request.post(`${API_BASE}/orders`, {
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        delivery_address: 'Test Address',
        delivery_date: '2026-12-31'
      }
    });
    
    const order = await orderResponse.json();
    const orderId = order.orders?.[0]?.id || order.id;
    
    // Check reserved_quantity after order
    const productAfterOrder = await page.request.get(`${API_BASE}/products/${product.id}`);
    const productDataAfter = await productAfterOrder.json();
    
    console.log('\nResults after order:');
    console.log(`reserved_quantity: ${productDataAfter.reserved_quantity}`);
    console.log(`stock_quantity: ${productDataAfter.stock_quantity}`);
    
    // Cancel order
    await page.request.put(`${API_BASE}/orders/${orderId}/cancel`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      data: { reason: 'Test cancellation' }
    });
    
    // Check quantities after cancellation
    const productAfterCancel = await page.request.get(`${API_BASE}/products/${product.id}`);
    const productDataCancel = await productAfterCancel.json();
    
    console.log('\nResults after cancellation:');
    console.log(`reserved_quantity: ${productDataCancel.reserved_quantity}`);
    console.log(`stock_quantity: ${productDataCancel.stock_quantity}`);
    
    // Verification
    const reservedDecreased = productDataCancel.reserved_quantity < productDataAfter.reserved_quantity;
    const stockUnchanged = productDataCancel.stock_quantity === productDataAfter.stock_quantity;
    
    if (reservedDecreased && stockUnchanged) {
      console.log('\n✅ PASS: Preorder cancellation correctly released reserved_quantity');
    } else {
      console.log('\n❌ FAIL: Preorder cancellation did not release reserved_quantity correctly');
      if (!reservedDecreased) console.log('   reserved_quantity did not decrease');
      if (!stockUnchanged) console.log('   stock_quantity changed (should be unchanged)');
    }
    
    expect(reservedDecreased).toBe(true);
    expect(stockUnchanged).toBe(true);
  });
  
  test('3. Conversion quantity parsing and validation', async ({ page }) => {
    console.log('\n=== TEST 3: Conversion Quantity Parsing and Validation ===');
    console.log('Test Steps:');
    console.log('1. Create a preorder product with reserved_quantity = 20');
    console.log('2. Try to convert with invalid harvest_quantity (string, negative, zero)');
    console.log('3. Try to convert with harvest_quantity < reserved_quantity');
    console.log('4. Try to convert with valid harvest_quantity >= reserved_quantity');
    console.log('5. Verify only valid conversion succeeds');
    
    const { token: farmerToken, product } = await createFarmerAndProduct(page);
    
    // Set up product with reservations (use FormData)
    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('description', product.description);
    formData.append('price', product.price);
    formData.append('category_id', product.category_id);
    formData.append('stock_quantity', '0');
    formData.append('unit', product.unit);
    formData.append('is_preorder', 'true');
    formData.append('preorder_availability_date', product.preorder_availability_date);
    formData.append('max_preorder_quantity', product.max_preorder_quantity);
    formData.append('reserved_quantity', '20');
    
    await page.request.put(`${API_BASE}/products/${product.id}`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      },
      data: formData
    });
    
    // Test 1: Invalid string
    const stringResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 'invalid' }
    });
    console.log('\nTest 3a - Invalid string:');
    console.log(`Status: ${stringResponse.status()}`);
    console.log(`Expected: 400, Actual: ${stringResponse.status()}`);
    
    // Test 2: Negative number
    const negativeResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: -5 }
    });
    console.log('\nTest 3b - Negative number:');
    console.log(`Status: ${negativeResponse.status()}`);
    console.log(`Expected: 400, Actual: ${negativeResponse.status()}`);
    
    // Test 3: Zero
    const zeroResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 0 }
    });
    console.log('\nTest 3c - Zero:');
    console.log(`Status: ${zeroResponse.status()}`);
    console.log(`Expected: 400, Actual: ${zeroResponse.status()}`);
    
    // Test 4: Less than reserved
    const lowResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 10 }
    });
    console.log('\nTest 3d - Less than reserved (10 < 20):');
    console.log(`Status: ${lowResponse.status()}`);
    console.log(`Expected: 400, Actual: ${lowResponse.status()}`);
    
    // Test 5: Valid conversion
    const validResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 25 }
    });
    console.log('\nTest 3e - Valid (25 >= 20):');
    console.log(`Status: ${validResponse.status()}`);
    console.log(`Expected: 200, Actual: ${validResponse.status()}`);
    
    const allInvalidRejected = 
      stringResponse.status() === 400 &&
      negativeResponse.status() === 400 &&
      zeroResponse.status() === 400 &&
      lowResponse.status() === 400;
    const validAccepted = validResponse.status() === 200;
    
    if (allInvalidRejected && validAccepted) {
      console.log('\n✅ PASS: Conversion quantity parsing and validation working correctly');
    } else {
      console.log('\n❌ FAIL: Conversion quantity validation not working correctly');
    }
    
    expect(allInvalidRejected).toBe(true);
    expect(validAccepted).toBe(true);
  });
  
  test('4. Harvest quantity validation', async ({ page }) => {
    console.log('\n=== TEST 4: Harvest Quantity Validation ===');
    console.log('Test Steps:');
    console.log('1. Create preorder product with reserved_quantity = 15');
    console.log('2. Attempt conversion with harvest_quantity = 10 (less than reserved)');
    console.log('3. Verify rejection with appropriate error message');
    console.log('4. Attempt conversion with harvest_quantity = 20 (sufficient)');
    console.log('5. Verify success and stock_quantity updated correctly');
    
    const { token: farmerToken, product } = await createFarmerAndProduct(page);
    
    // Set up product with reservations (use FormData)
    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('description', product.description);
    formData.append('price', product.price);
    formData.append('category_id', product.category_id);
    formData.append('stock_quantity', '0');
    formData.append('unit', product.unit);
    formData.append('is_preorder', 'true');
    formData.append('preorder_availability_date', product.preorder_availability_date);
    formData.append('max_preorder_quantity', product.max_preorder_quantity);
    formData.append('reserved_quantity', '15');
    
    await page.request.put(`${API_BASE}/products/${product.id}`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      },
      data: formData
    });
    
    // Test insufficient harvest
    const insufficientResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 10 }
    });
    
    const insufficientData = await insufficientResponse.json();
    console.log('\nTest 4a - Insufficient harvest (10 < 15):');
    console.log(`Status: ${insufficientResponse.status()}`);
    console.log(`Message: ${insufficientData.message}`);
    
    // Test sufficient harvest
    const sufficientResponse = await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 20 }
    });
    
    const sufficientData = await sufficientResponse.json();
    console.log('\nTest 4b - Sufficient harvest (20 >= 15):');
    console.log(`Status: ${sufficientResponse.status()}`);
    console.log(`Message: ${sufficientData.message}`);
    
    // Check final product state
    const finalProduct = await page.request.get(`${API_BASE}/products/${product.id}`);
    const finalData = await finalProduct.json();
    console.log(`\nFinal state:`);
    console.log(`stock_quantity: ${finalData.stock_quantity}`);
    console.log(`reserved_quantity: ${finalData.reserved_quantity}`);
    
    const insufficientRejected = insufficientResponse.status() === 400;
    const hasCorrectError = insufficientData.message?.toLowerCase().includes('harvest') || 
                            insufficientData.message?.toLowerCase().includes('reserved');
    const sufficientAccepted = sufficientResponse.status() === 200;
    const stockUpdated = finalData.stock_quantity === 20;
    const reservedCleared = finalData.reserved_quantity === 0;
    
    if (insufficientRejected && hasCorrectError && sufficientAccepted && stockUpdated && reservedCleared) {
      console.log('\n✅ PASS: Harvest quantity validation working correctly');
    } else {
      console.log('\n❌ FAIL: Harvest quantity validation not working correctly');
      if (!insufficientRejected) console.log('   Insufficient harvest was not rejected');
      if (!hasCorrectError) console.log('   Error message incorrect');
      if (!sufficientAccepted) console.log('   Sufficient harvest was rejected');
      if (!stockUpdated) console.log('   stock_quantity not updated correctly');
      if (!reservedCleared) console.log('   reserved_quantity not cleared');
    }
    
    expect(insufficientRejected).toBe(true);
    expect(sufficientAccepted).toBe(true);
  });
  
  test('5. Per-order preorder allocation tracking', async ({ page }) => {
    console.log('\n=== TEST 5: Per-Order Preorder Allocation Tracking ===');
    console.log('Test Steps:');
    console.log('1. Create preorder product');
    console.log('2. Customer places preorder order for quantity 5');
    console.log('3. Verify order has preorder_reserved_quantity = 5');
    console.log('4. Farmer converts preorders');
    console.log('5. Verify order has preorder_fulfilled_quantity = 5');
    console.log('6. Customer cancels order');
    console.log('7. Verify preorder_reserved_quantity decreased');
    
    const { token: farmerToken, product } = await createFarmerAndProduct(page);
    const { token: customerToken } = await createCustomer(page);
    
    // Add to cart and place order
    await page.request.post(`${API_BASE}/cart`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      data: { product_id: product.id, quantity: 5 }
    });
    
    const orderResponse = await page.request.post(`${API_BASE}/orders`, {
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        delivery_address: 'Test Address',
        delivery_date: '2026-12-31'
      }
    });
    
    const order = await orderResponse.json();
    const orderId = order.orders?.[0]?.id || order.id;
    
    // Check order has preorder_reserved_quantity
    const orderCheck = await page.request.get(`${API_BASE}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const orderData = await orderCheck.json();
    
    console.log('\nAfter order creation:');
    console.log(`Order is_preorder: ${orderData.is_preorder}`);
    console.log(`Order preorder_reserved_quantity: ${orderData.preorder_reserved_quantity}`);
    console.log(`Order quantity: ${orderData.quantity}`);
    
    // Convert preorders
    await page.request.post(`${API_BASE}/products/${product.id}/convert-preorders`, {
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      data: { harvest_quantity: 10 }
    });
    
    // Check order has preorder_fulfilled_quantity
    const orderAfterConvert = await page.request.get(`${API_BASE}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const orderDataConvert = await orderAfterConvert.json();
    
    console.log('\nAfter conversion:');
    console.log(`Order preorder_fulfilled_quantity: ${orderDataConvert.preorder_fulfilled_quantity}`);
    console.log(`Order preorder_converted_at: ${orderDataConvert.preorder_converted_at}`);
    
    // Cancel order
    await page.request.put(`${API_BASE}/orders/${orderId}/cancel`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      data: { reason: 'Test' }
    });
    
    // Check preorder_reserved_quantity decreased
    const orderAfterCancel = await page.request.get(`${API_BASE}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const orderDataCancel = await orderAfterCancel.json();
    
    console.log('\nAfter cancellation:');
    console.log(`Order preorder_reserved_quantity: ${orderDataCancel.preorder_reserved_quantity}`);
    
    const hasReservedQuantity = orderData.preorder_reserved_quantity === 5;
    const hasFulfilledQuantity = orderDataConvert.preorder_fulfilled_quantity === 5;
    const hasConvertedTimestamp = orderDataConvert.preorder_converted_at !== null;
    const reservedDecreased = orderDataCancel.preorder_reserved_quantity < orderData.preorder_reserved_quantity;
    
    if (hasReservedQuantity && hasFulfilledQuantity && hasConvertedTimestamp && reservedDecreased) {
      console.log('\n✅ PASS: Per-order preorder allocation tracking working correctly');
    } else {
      console.log('\n❌ FAIL: Per-order preorder allocation tracking not working correctly');
      if (!hasReservedQuantity) console.log('   preorder_reserved_quantity not set on order creation');
      if (!hasFulfilledQuantity) console.log('   preorder_fulfilled_quantity not set on conversion');
      if (!hasConvertedTimestamp) console.log('   preorder_converted_at not set');
      if (!reservedDecreased) console.log('   preorder_reserved_quantity not decreased on cancellation');
    }
    
    expect(hasReservedQuantity).toBe(true);
    expect(hasFulfilledQuantity).toBe(true);
  });
  
  test('6. Unsafe preorder product edit protection', async ({ page }) => {
    console.log('\n=== TEST 6: Unsafe Preorder Product Edit Protection ===');
    console.log('Test Steps:');
    console.log('1. Create preorder product with active reservations');
    console.log('2. Place a preorder order to create reservation');
    console.log('3. Try to disable is_preorder while reservations exist');
    console.log('4. Try to reduce max_preorder_quantity below reserved_quantity');
    console.log('5. Verify both attempts are blocked');
    console.log('6. Try valid edit (increase max_preorder_quantity)');
    console.log('7. Verify valid edit succeeds');
    
    const { token: farmerToken, product } = await createFarmerAndProduct(page);
    const { token: customerToken } = await createCustomer(page);
    
    // Place order to create reservation
    await page.request.post(`${API_BASE}/cart`, {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      data: { product_id: product.id, quantity: 10 }
    });
    
    await page.request.post(`${API_BASE}/orders`, {
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        delivery_address: 'Test Address',
        delivery_date: '2026-12-31'
      }
    });
    
    // Check product has reservations
    const productCheck = await page.request.get(`${API_BASE}/products/${product.id}`);
    const productData = await productCheck.json();
    console.log('\nProduct state:');
    console.log(`reserved_quantity: ${productData.reserved_quantity}`);
    console.log(`max_preorder_quantity: ${productData.max_preorder_quantity}`);
    
    // Test 1: Try to disable is_preorder (use FormData)
    const disableFormData = new FormData();
    disableFormData.append('name', productData.name);
    disableFormData.append('description', productData.description);
    disableFormData.append('price', productData.price);
    disableFormData.append('category_id', productData.category_id);
    disableFormData.append('stock_quantity', productData.stock_quantity);
    disableFormData.append('unit', productData.unit);
    disableFormData.append('is_preorder', 'false');
    disableFormData.append('preorder_availability_date', productData.preorder_availability_date);
    disableFormData.append('max_preorder_quantity', productData.max_preorder_quantity);
    
    const disableResponse = await page.request.put(`${API_BASE}/products/${product.id}`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      },
      data: disableFormData
    });
    
    const disableData = await disableResponse.json();
    console.log('\nTest 6a - Disable is_preorder with active reservations:');
    console.log(`Status: ${disableResponse.status()}`);
    console.log(`Message: ${disableData.message}`);
    
    // Test 2: Try to reduce max below reserved (use FormData)
    const reduceFormData = new FormData();
    reduceFormData.append('name', productData.name);
    reduceFormData.append('description', productData.description);
    reduceFormData.append('price', productData.price);
    reduceFormData.append('category_id', productData.category_id);
    reduceFormData.append('stock_quantity', productData.stock_quantity);
    reduceFormData.append('unit', productData.unit);
    reduceFormData.append('is_preorder', 'true');
    reduceFormData.append('preorder_availability_date', productData.preorder_availability_date);
    reduceFormData.append('max_preorder_quantity', '5');
    
    const reduceResponse = await page.request.put(`${API_BASE}/products/${product.id}`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      },
      data: reduceFormData
    });
    
    const reduceData = await reduceResponse.json();
    console.log('\nTest 6b - Reduce max_preorder_quantity (5 < 10 reserved):');
    console.log(`Status: ${reduceResponse.status()}`);
    console.log(`Message: ${reduceData.message}`);
    
    // Test 3: Valid edit (increase max) (use FormData)
    const validFormData = new FormData();
    validFormData.append('name', productData.name);
    validFormData.append('description', productData.description);
    validFormData.append('price', productData.price);
    validFormData.append('category_id', productData.category_id);
    validFormData.append('stock_quantity', productData.stock_quantity);
    validFormData.append('unit', productData.unit);
    validFormData.append('is_preorder', 'true');
    validFormData.append('preorder_availability_date', productData.preorder_availability_date);
    validFormData.append('max_preorder_quantity', '50');
    
    const validResponse = await page.request.put(`${API_BASE}/products/${product.id}`, {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      },
      data: validFormData
    });
    
    console.log('\nTest 6c - Increase max_preorder_quantity (50 > 10 reserved):');
    console.log(`Status: ${validResponse.status()}`);
    
    const disableBlocked = disableResponse.status() === 400;
    const reduceBlocked = reduceResponse.status() === 400;
    const validAccepted = validResponse.status() === 200;
    
    if (disableBlocked && reduceBlocked && validAccepted) {
      console.log('\n✅ PASS: Unsafe preorder product edit protection working correctly');
    } else {
      console.log('\n❌ FAIL: Unsafe preorder product edit protection not working correctly');
      if (!disableBlocked) console.log('   Disabling is_preorder was not blocked');
      if (!reduceBlocked) console.log('   Reducing max_preorder_quantity was not blocked');
      if (!validAccepted) console.log('   Valid edit was rejected');
    }
    
    expect(disableBlocked).toBe(true);
    expect(reduceBlocked).toBe(true);
    expect(validAccepted).toBe(true);
  });
});
