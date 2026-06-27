require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function customerAddToCartAndCheckout() {
  console.log('=== Customer Add to Cart and Checkout for Scenario 1 ===\n');
  
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

  // Add product to cart
  console.log('2. Adding test product to cart...');
  const cartResponse = await fetch(`${API_BASE}/cart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: 98,
      quantity: 2
    })
  });

  if (!cartResponse.ok) {
    console.error('✗ Add to cart failed:', await cartResponse.text());
    return;
  }

  const cartData = await cartResponse.json();
  console.log('✓ Product added to cart!');
  console.log('  Cart item:', cartData);
  console.log();

  // Get cart
  console.log('3. Fetching cart...');
  const getCartResponse = await fetch(`${API_BASE}/cart`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!getCartResponse.ok) {
    console.error('✗ Get cart failed:', await getCartResponse.text());
    return;
  }

  const cartItems = await getCartResponse.json();
  console.log('✓ Cart fetched!');
  console.log('  Cart items:', JSON.stringify(cartItems, null, 2));
  console.log();

  // Checkout
  console.log('4. Creating order (checkout)...');
  const checkoutResponse = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      delivery_address: 'Test Address for Scenario 1',
      payment_method: 'cod'
    })
  });

  if (!checkoutResponse.ok) {
    console.error('✗ Checkout failed:', await checkoutResponse.text());
    return;
  }

  const orderData = await checkoutResponse.json();
  console.log('✓ Order created successfully!');
  console.log('  Full response:', JSON.stringify(orderData, null, 2));
  console.log();

  const orderIds = orderData.orderIds || orderData.order_ids || [];
  if (orderIds.length > 0) {
    console.log('  Order IDs created:', orderIds);
    console.log('  Total Amount:', orderData.totalAmount || orderData.total_amount);
    console.log('  Order Count:', orderData.orderCount || orderData.order_count);
  }

  // Verify order by querying database
  console.log('5. Verifying order in database...');
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const verifyResult = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [customerId]
    );
    console.log('✓ Recent orders for customer:');
    verifyResult.rows.forEach(order => {
      console.log(`  - Order ID: ${order.id}, Product ID: ${order.product_id}, Status: ${order.status}, Total: ${order.total_amount}`);
    });
  } catch (error) {
    console.error('✗ Database verification failed:', error);
  } finally {
    await pool.end();
  }

  console.log();
  console.log('=== SCENARIO 1 COMPLETE: Available Product → Add to Cart → Checkout → Order Created ===');
  return orderIds[0];
}

customerAddToCartAndCheckout().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
