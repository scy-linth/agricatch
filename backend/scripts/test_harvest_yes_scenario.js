require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function testHarvestYesScenario() {
  console.log('=== Scenario 3 - Harvest YES ===\n');
  
  // Login as test farmer
  console.log('1. Logging in as test farmer...');
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testfarmer@test.com',
      password: 'Test123456'
    })
  });

  if (!loginResponse.ok) {
    console.error('✗ Login failed:', await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  const farmerId = loginData.user?.id || loginData.id;
  console.log('✓ Login successful');
  console.log('  Farmer ID:', farmerId);
  console.log();

  // Get pre-order product details before harvest
  console.log('2. Getting pre-order product details before harvest...');
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  let preOrderProduct;
  try {
    const productResult = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [99]
    );
    preOrderProduct = productResult.rows[0];
    console.log('✓ Pre-order product details:');
    console.log('  ID:', preOrderProduct.id);
    console.log('  Name:', preOrderProduct.name);
    console.log('  Is Pre-order:', preOrderProduct.is_preorder);
    console.log('  Reserved Quantity:', preOrderProduct.reserved_quantity);
    console.log('  Stock Quantity:', preOrderProduct.stock_quantity);
    console.log('  Status:', preOrderProduct.status);
    console.log();
  } catch (error) {
    console.error('✗ Failed to get product details:', error);
    await pool.end();
    return;
  }

  // Convert pre-orders to available (Harvest YES)
  console.log('3. Converting pre-orders to available (Harvest YES)...');
  const harvestQuantity = 30; // Harvested 30 kg
  
  const convertResponse = await fetch(`${API_BASE}/products/99/convert-preorders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      harvest_quantity: harvestQuantity
    })
  });

  if (!convertResponse.ok) {
    console.error('✗ Harvest conversion failed:', await convertResponse.text());
    await pool.end();
    return;
  }

  const convertData = await convertResponse.json();
  console.log('✓ Harvest conversion successful!');
  console.log('  Response:', JSON.stringify(convertData, null, 2));
  console.log();

  // Verify available product created
  console.log('4. Verifying available product created...');
  try {
    const availableResult = await pool.query(
      `SELECT * FROM products 
       WHERE farmer_id = $1 
         AND name = $2 
         AND is_preorder = false 
         AND is_available = true
       ORDER BY created_at DESC 
       LIMIT 1`,
      [farmerId, preOrderProduct.name]
    );
    
    if (availableResult.rows.length > 0) {
      const availableProduct = availableResult.rows[0];
      console.log('✓ Available product created!');
      console.log('  ID:', availableProduct.id);
      console.log('  Name:', availableProduct.name);
      console.log('  Is Pre-order:', availableProduct.is_preorder);
      console.log('  Is Available:', availableProduct.is_available);
      console.log('  Stock Quantity:', availableProduct.stock_quantity);
      console.log('  Linked Product ID:', availableProduct.linked_product_id);
      console.log('  Status:', availableProduct.status);
      console.log();
      
      // Verify products are linked
      if (availableProduct.linked_product_id === preOrderProduct.id) {
        console.log('✓✓✓ PRODUCTS LINKED: Available product linked to pre-order');
      } else {
        console.log('✗ Products NOT linked');
      }
      
      // Verify stock transferred
      if (availableProduct.stock_quantity === harvestQuantity) {
        console.log('✓✓✓ STOCK TRANSFERRED: Available product has harvested quantity');
      } else {
        console.log('✗ Stock NOT transferred correctly');
      }
      
      // Verify pre-order status changed to harvested
      const updatedPreOrderResult = await pool.query(
        'SELECT * FROM products WHERE id = $1',
        [99]
      );
      const updatedPreOrder = updatedPreOrderResult.rows[0];
      
      if (updatedPreOrder.status === 'harvested') {
        console.log('✓✓✓ PRE-ORDER STATUS: Changed to harvested');
      } else {
        console.log('✗ Pre-order status NOT changed to harvested:', updatedPreOrder.status);
      }
      
      console.log();
      console.log('=== HARVEST YES VERIFICATION COMPLETE ===');
      console.log('Available Product ID:', availableProduct.id);
      console.log('Pre-order Product ID:', preOrderProduct.id);
      console.log('Linked:', availableProduct.linked_product_id === preOrderProduct.id);
      
      await pool.end();
      return availableProduct.id;
    } else {
      console.log('✗ Available product NOT created');
      await pool.end();
      return null;
    }
  } catch (error) {
    console.error('✗ Verification failed:', error);
    await pool.end();
    return null;
  }
}

testHarvestYesScenario().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
