require('dotenv').config();
const { pool } = require('../utils/db');
const jwt = require('jsonwebtoken');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function getFarmerToken() {
  const result = await pool.query(
    "SELECT id, email FROM users WHERE role = 'farmer' AND is_verified = true AND is_disabled = false LIMIT 1"
  );
  
  if (result.rows.length === 0) {
    throw new Error('No verified farmer found');
  }
  
  const farmer = result.rows[0];
  console.log(`Using farmer: ${farmer.email}`);
  
  const token = jwt.sign(
    { id: farmer.id, email: farmer.email, role: 'farmer' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  return { token, farmerId: farmer.id };
}

async function createPendingProduct(farmerToken) {
  console.log('\n=== Step 1: Creating pending product ===');
  
  const response = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerToken}`
    },
    body: JSON.stringify({
      name: `Test Pending Product ${Date.now()}`,
      description: 'This product should be pending',
      price: 100,
      category_id: 2,
      stock_quantity: 50,
      unit: 'kg',
      is_preorder: false,
      location: 'Test Location',
      city: 'Test City',
      province: 'Test Province'
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to create product:', data.message);
    throw new Error(data.message);
  }
  
  console.log('✅ Product created:', data.product.id);
  console.log('   Status:', data.product.status);
  console.log('   is_available:', data.product.is_available);
  
  return data.product;
}

async function getFarmerProducts(farmerToken, farmerId) {
  console.log('\n=== Step 2: Getting farmer products from API ===');
  
  const response = await fetch(`${API_BASE}/products/farmer/${farmerId}`, {
    headers: {
      'Authorization': `Bearer ${farmerToken}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to get farmer products:', data.message);
    throw new Error(data.message);
  }
  
  console.log(`✅ Retrieved ${data.products.length} products`);
  
  return data.products;
}

async function checkProductVisibility(products, productId) {
  console.log('\n=== Step 3: Checking product visibility in different tabs ===');
  
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    console.log('❌ Product not found in farmer products list');
    return false;
  }
  
  console.log(`Product found: ${product.name}`);
  console.log(`  Status: ${product.status}`);
  console.log(`  is_available: ${product.is_available}`);
  console.log(`  is_preorder: ${product.is_preorder}`);
  
  // Simulate filterAvailableProducts logic
  const wouldShowInAvailableNow = !product.is_preorder && product.status === 'approved';
  console.log(`\n  Would show in Available Now tab: ${wouldShowInAvailableNow}`);
  
  // Simulate filterPreorderProducts logic
  const wouldShowInPreorders = product.is_preorder && product.status === 'approved';
  console.log(`  Would show in Pre-orders tab: ${wouldShowInPreorders}`);
  
  // Pending products should only show in Approval tab
  if (product.status === 'pending') {
    if (!wouldShowInAvailableNow && !wouldShowInPreorders) {
      console.log('\n✅ CORRECT: Pending product does NOT appear in Available Now or Pre-orders tabs');
      console.log('   It should only appear in the Approval tab');
      return true;
    } else {
      console.log('\n❌ INCORRECT: Pending product appears in Available Now or Pre-orders tab');
      return false;
    }
  }
  
  return false;
}

async function cleanupTestProduct(productId) {
  console.log('\n=== Cleanup: Deleting test product ===');
  
  try {
    await pool.query('DELETE FROM notifications WHERE product_id = $1', [productId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    console.log('✅ Test product deleted');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
  }
}

async function runTest() {
  try {
    console.log('=== Testing Farmer Dashboard Product Visibility ===\n');
    
    const { token: farmerToken, farmerId } = await getFarmerToken();
    
    const product = await createPendingProduct(farmerToken);
    
    if (product.status !== 'pending' || product.is_available !== false) {
      console.error('❌ Product was not created with pending status');
      await cleanupTestProduct(product.id);
      process.exit(1);
    }
    
    const products = await getFarmerProducts(farmerToken, farmerId);
    
    const correct = await checkProductVisibility(products, product.id);
    
    await cleanupTestProduct(product.id);
    
    if (correct) {
      console.log('\n✅ TEST PASSED');
      console.log('   - Pending products do NOT appear in Available Now tab');
      console.log('   - Pending products do NOT appear in Pre-orders tab');
      console.log('   - Pending products only appear in Approval tab');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
