/**
 * Setup Test Orders for Task 3 Regression Test
 * 
 * Creates test orders for:
 * - Scenario A: Farmer Cancel (regular available product)
 * - Scenario B: Admin Cancel (pre-order not converted)
 * - Scenario C: Delivered (out_for_delivery status)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function setupTestOrders() {
  console.log('=== Setting up Test Orders for Task 3 ===\n');
  
  // Login as test customer
  console.log('1. Logging in as test customer...');
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testcustomer@test.com',
      password: 'Test123456'
    })
  });

  if (!loginResponse.ok) {
    console.error('✗ Login failed:', await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  const customerId = loginData.user?.id || loginData.id;
  console.log('✓ Login successful');
  console.log('  Customer ID:', customerId);
  console.log();

  // Scenario A: Regular available product for Farmer Cancel
  console.log('2. Creating order for Scenario A (Farmer Cancel - Regular Product)...');
  const cartAResponse = await fetch(`${API_BASE}/cart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: 15, // Chico (regular available product)
      quantity: 1
    })
  });

  if (!cartAResponse.ok) {
    console.error('✗ Add to cart failed:', await cartAResponse.text());
    return;
  }

  const checkoutAResponse = await fetch(`${API_BASE}/cart/checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      deliveryAddress: 'Test Customer | +639123456789 | Task 3 Scenario A - Farmer Cancel'
    })
  });

  if (!checkoutAResponse.ok) {
    console.error('✗ Checkout failed:', await checkoutAResponse.text());
    return;
  }

  const checkoutAData = await checkoutAResponse.json();
  const orderAId = checkoutAData.orderId || checkoutAData.id;
  console.log('✓ Order A created:', orderAId);
  console.log();

  // Scenario B: Pre-order for Admin Cancel
  console.log('3. Creating order for Scenario B (Admin Cancel - Pre-order)...');
  const cartBResponse = await fetch(`${API_BASE}/cart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: 65, // Kangkong (pre-order product)
      quantity: 1
    })
  });

  if (!cartBResponse.ok) {
    console.error('✗ Add to cart failed:', await cartBResponse.text());
    return;
  }

  const checkoutBResponse = await fetch(`${API_BASE}/cart/checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      deliveryAddress: 'Test Customer | +639123456789 | Task 3 Scenario B - Admin Cancel'
    })
  });

  if (!checkoutBResponse.ok) {
    console.error('✗ Checkout failed:', await checkoutBResponse.text());
    return;
  }

  const checkoutBData = await checkoutBResponse.json();
  const orderBId = checkoutBData.orderId || checkoutBData.id;
  console.log('✓ Order B created:', orderBId);
  console.log();

  // Scenario C: Order for Delivered test
  console.log('4. Creating order for Scenario C (Delivered)...');
  const cartCResponse = await fetch(`${API_BASE}/cart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: 15, // Chico (regular available product)
      quantity: 2
    })
  });

  if (!cartCResponse.ok) {
    console.error('✗ Add to cart failed:', await cartCResponse.text());
    return;
  }

  const checkoutCResponse = await fetch(`${API_BASE}/cart/checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      deliveryAddress: 'Test Customer | +639123456789 | Task 3 Scenario C - Delivered'
    })
  });

  if (!checkoutCResponse.ok) {
    console.error('✗ Checkout failed:', await checkoutCResponse.text());
    return;
  }

  const checkoutCData = await checkoutCResponse.json();
  const orderCId = checkoutCData.orderId || checkoutCData.id;
  console.log('✓ Order C created:', orderCId);
  console.log();

  // Login as admin to update order statuses
  console.log('5. Logging in as admin to update order statuses...');
  const adminLoginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'scy@linth',
      password: 'scy123456'
    })
  });

  if (!adminLoginResponse.ok) {
    console.error('✗ Admin login failed:', await adminLoginResponse.text());
    return;
  }

  const adminLoginData = await adminLoginResponse.json();
  const adminToken = adminLoginData.token;
  console.log('✓ Admin login successful');
  console.log();

  // Update Order C to out_for_delivery for delivered test
  console.log('6. Updating Order C to out_for_delivery...');
  const statusCResponse = await fetch(`${API_BASE}/admin/orders/${orderCId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'out_for_delivery' })
  });

  if (!statusCResponse.ok) {
    console.error('✗ Status update failed:', await statusCResponse.text());
    return;
  }

  console.log('✓ Order C updated to out_for_delivery');
  console.log();

  console.log('=== Test Orders Setup Complete ===');
  console.log('Order IDs for regression test:');
  console.log(`  Scenario A (Farmer Cancel): ${orderAId}`);
  console.log(`  Scenario B (Admin Cancel): ${orderBId}`);
  console.log(`  Scenario C (Delivered): ${orderCId}`);
  console.log();
  console.log('Run regression test with:');
  console.log(`  node backend/scripts/test_task3_admin_status_consistency.js ${orderAId} ${orderBId} ${orderCId}`);
}

setupTestOrders().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
