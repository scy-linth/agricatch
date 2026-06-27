require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function customerReservePreorder() {
  console.log('=== Customer Reserve Pre-order for Scenario 2 ===\n');
  
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

  // Add pre-order to cart
  console.log('2. Adding pre-order product to cart...');
  const cartResponse = await fetch(`${API_BASE}/cart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: 99,
      quantity: 5
    })
  });

  if (!cartResponse.ok) {
    console.error('✗ Add to cart failed:', await cartResponse.text());
    return;
  }

  const cartData = await cartResponse.json();
  console.log('✓ Pre-order added to cart!');
  console.log('  Cart item:', JSON.stringify(cartData, null, 2));
  console.log();

  // Checkout (reserve)
  console.log('3. Creating pre-order reservation (checkout)...');
  const checkoutResponse = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      delivery_address: 'Test Address for Scenario 2 Pre-order',
      payment_method: 'cod'
    })
  });

  if (!checkoutResponse.ok) {
    console.error('✗ Checkout failed:', await checkoutResponse.text());
    return;
  }

  const orderData = await checkoutResponse.json();
  console.log('✓ Pre-order reservation created successfully!');
  console.log('  Full response:', JSON.stringify(orderData, null, 2));
  console.log();

  const orderIds = orderData.orderIds || orderData.order_ids || [];
  if (orderIds.length > 0) {
    console.log('  Order IDs created:', orderIds);
    console.log('  Total Amount:', orderData.totalAmount || orderData.total_amount);
    console.log('  Order Count:', orderData.orderCount || orderData.order_count);
  }

  // Verify reservation in database
  console.log('4. Verifying reservation in database...');
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const verifyResult = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 AND product_id = $2 ORDER BY created_at DESC LIMIT 1',
      [customerId, 99]
    );
    
    if (verifyResult.rows.length > 0) {
      const order = verifyResult.rows[0];
      console.log('✓ Reservation verified!');
      console.log('  Order ID:', order.id);
      console.log('  Product ID:', order.product_id);
      console.log('  Status:', order.status);
      console.log('  Is Pre-order:', order.is_preorder);
      console.log('  Pre-order Reserved Quantity:', order.preorder_reserved_quantity);
      console.log('  Total Amount:', order.total_amount);
      
      // Verify product reserved quantity updated
      const productResult = await pool.query(
        'SELECT reserved_quantity, max_preorder_quantity FROM products WHERE id = $1',
        [99]
      );
      const product = productResult.rows[0];
      console.log('\n  Product Reserved Quantity:', product.reserved_quantity);
      console.log('  Product Max Pre-order Quantity:', product.max_preorder_quantity);
      
      if (product.reserved_quantity === order.preorder_reserved_quantity) {
        console.log('\n✓✓✓ RESERVATION QUANTITY MATCHES PRODUCT RESERVED QUANTITY');
      }
    } else {
      console.log('✗ Reservation not found in database');
    }
  } catch (error) {
    console.error('✗ Database verification failed:', error);
  } finally {
    await pool.end();
  }

  console.log();
  console.log('=== SCENARIO 2 COMPLETE: Pre-order Product → Marketplace → Customer Reserve → Reservation Verified ===');
  return orderIds[0];
}

customerReservePreorder().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
