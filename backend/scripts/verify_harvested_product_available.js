require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function verifyHarvestedProductAvailable() {
  console.log('=== Verifying Harvested Product is Available for Purchase ===\n');
  
  // Get all available products
  console.log('1. Fetching available products from marketplace...');
  const response = await fetch(`${API_BASE}/products?status=approved&is_available=true`);
  
  if (!response.ok) {
    console.error('✗ Failed to fetch products:', await response.text());
    return;
  }

  const data = await response.json();
  const products = data.products || data;
  
  console.log(`✓ Found ${products.length} available products\n`);
  
  // Find our harvested product
  const harvestedProduct = products.find(p => p.id === 99);
  
  if (harvestedProduct) {
    console.log('✓ Harvested product found in marketplace as available!');
    console.log('  Product ID:', harvestedProduct.id);
    console.log('  Product Name:', harvestedProduct.name);
    console.log('  Price:', harvestedProduct.price);
    console.log('  Stock Quantity:', harvestedProduct.stock_quantity);
    console.log('  Is Pre-order:', harvestedProduct.is_preorder);
    console.log('  Is Available:', harvestedProduct.is_available);
    console.log('  Status:', harvestedProduct.status);
    console.log('\n✓✓✓ HARVESTED PRODUCT IS AVAILABLE FOR PURCHASE');
    
    // Test customer purchase
    console.log('\n2. Testing customer purchase of harvested product...');
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
    console.log('✓ Customer logged in');
    console.log('  Customer ID:', customerId);
    console.log();

    // Add to cart
    console.log('3. Adding harvested product to cart...');
    const cartResponse = await fetch(`${API_BASE}/cart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: 99,
        quantity: 3
      })
    });

    if (!cartResponse.ok) {
      console.error('✗ Add to cart failed:', await cartResponse.text());
      return;
    }

    console.log('✓ Product added to cart');
    console.log();

    // Checkout
    console.log('4. Creating order...');
    const checkoutResponse = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'Test Address for Harvested Product Purchase',
        payment_method: 'cod'
      })
    });

    if (!checkoutResponse.ok) {
      console.error('✗ Checkout failed:', await checkoutResponse.text());
      return;
    }

    const orderData = await checkoutResponse.json();
    console.log('✓ Order created successfully!');
    console.log('  Order IDs:', orderData.orderIds);
    console.log('  Total Amount:', orderData.totalAmount);
    console.log();

    console.log('=== SCENARIO 3 COMPLETE: Harvest YES → Product Available → Customer Purchase ===');
  } else {
    console.log('✗ Harvested product NOT found in marketplace as available');
    console.log('Available products:');
    products.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, Is Pre-order: ${p.is_preorder})`);
    });
  }
}

verifyHarvestedProductAvailable().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
