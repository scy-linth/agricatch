const API_BASE = 'http://localhost:3000/api';

async function getFarmerToken() {
  console.log('\n--- Getting Farmer Token ---');
  
  // Login with test credentials
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'farmer@test.com',
      password: 'password123'
    })
  });
  
  if (!loginRes.ok) {
    const err = await loginRes.json();
    console.error('❌ Login failed:', err.message);
    console.log('⚠ Using fallback: please provide a valid farmer email/password');
    return null;
  }
  
  const loginData = await loginRes.json();
  console.log('✓ Farmer login successful');
  return loginData.token;
}

async function getCategory(token) {
  console.log('\n--- Getting Category ---');
  
  const catRes = await fetch(`${API_BASE}/categories`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!catRes.ok) {
    console.error('❌ Failed to get categories');
    return null;
  }
  
  const cats = await catRes.json();
  if (cats.length === 0) {
    console.error('❌ No categories found');
    return null;
  }
  
  const cat = cats[0];
  console.log(`✓ Using category: ${cat.name} (ID: ${cat.id})`);
  return cat.id;
}

async function testAddAvailableNow(token, categoryId) {
  console.log('\n=== Test 1: Add Available Now Product ===');
  
  const formData = new FormData();
  formData.append('name', 'Smoke Test Available Now');
  formData.append('description', 'Test product for smoke testing');
  formData.append('price', '100');
  formData.append('category_id', categoryId);
  formData.append('stock_quantity', '50');
  formData.append('unit', 'kg');
  formData.append('location', 'Test Farm Location');
  formData.append('harvest_date', '');
  formData.append('expiry_date', '2025-12-31');
  
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.json();
    console.error('❌ Add Available Now failed:', err.message);
    return null;
  }
  
  const product = await res.json();
  console.log('✓ Available Now product created:', product.id);
  console.log('  - Status:', product.status);
  console.log('  - is_available:', product.is_available);
  console.log('  - stock_quantity:', product.stock_quantity);
  console.log('  - harvest_date:', product.harvest_date);
  console.log('  - expiry_date:', product.expiry_date);
  
  return product;
}

async function testAddPreorder(token, categoryId) {
  console.log('\n=== Test 2: Add Pre-order Product ===');
  
  const formData = new FormData();
  formData.append('name', 'Smoke Test Pre-order');
  formData.append('description', 'Test pre-order product for smoke testing');
  formData.append('price', '150');
  formData.append('category_id', categoryId);
  formData.append('stock_quantity', '0');
  formData.append('unit', 'kg');
  formData.append('location', 'Test Farm Location');
  formData.append('harvest_date', '2025-07-15');
  formData.append('expiry_date', '');
  formData.append('max_preorder_quantity', '100');
  formData.append('preorder_availability_date', '2025-07-15');
  
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.json();
    console.error('❌ Add Pre-order failed:', err.message);
    return null;
  }
  
  const product = await res.json();
  console.log('✓ Pre-order product created:', product.id);
  console.log('  - Status:', product.status);
  console.log('  - is_available:', product.is_available);
  console.log('  - stock_quantity:', product.stock_quantity);
  console.log('  - harvest_date:', product.harvest_date);
  console.log('  - preorder_availability_date:', product.preorder_availability_date);
  console.log('  - max_preorder_quantity:', product.max_preorder_quantity);
  
  return product;
}

async function testEditProduct(token, product) {
  console.log('\n=== Test 3: Edit Product ===');
  
  const formData = new FormData();
  formData.append('name', 'Smoke Test Edited');
  formData.append('description', 'Edited description');
  formData.append('price', '200');
  formData.append('category_id', product.category_id);
  formData.append('stock_quantity', '75');
  formData.append('unit', 'kg');
  formData.append('location', 'Updated Farm Location');
  formData.append('harvest_date', '');
  formData.append('expiry_date', '2025-12-31');
  
  const res = await fetch(`${API_BASE}/products/${product.id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.json();
    console.error('❌ Edit product failed:', err.message);
    return false;
  }
  
  const updated = await res.json();
  console.log('✓ Product edited successfully');
  console.log('  - Name:', updated.name);
  console.log('  - Price:', updated.price);
  console.log('  - Stock:', updated.stock_quantity);
  console.log('  - Location:', updated.location);
  
  return true;
}

async function deleteTestProduct(token, productId) {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.ok) {
    console.log(`✓ Cleaned up test product ${productId}`);
  } else {
    console.log(`⚠ Could not delete test product ${productId}`);
  }
}

async function run() {
  try {
    console.log('=== Product CRUD Smoke Test ===\n');
    console.log('API Base:', API_BASE);
    
    const token = await getFarmerToken();
    if (!token) {
      console.error('\n❌ Smoke test failed: Could not get farmer token');
      process.exit(1);
    }
    
    const categoryId = await getCategory(token);
    if (!categoryId) {
      console.error('\n❌ Smoke test failed: Could not get category');
      process.exit(1);
    }
    
    // Test 1: Add Available Now
    const availableProduct = await testAddAvailableNow(token, categoryId);
    if (!availableProduct) {
      console.error('\n❌ Smoke test failed: Add Available Now');
      process.exit(1);
    }
    
    // Test 2: Add Pre-order
    const preorderProduct = await testAddPreorder(token, categoryId);
    if (!preorderProduct) {
      console.error('\n❌ Smoke test failed: Add Pre-order');
      await deleteTestProduct(token, availableProduct.id);
      process.exit(1);
    }
    
    // Test 3: Edit Product
    const editSuccess = await testEditProduct(token, availableProduct);
    if (!editSuccess) {
      console.error('\n❌ Smoke test failed: Edit Product');
      await deleteTestProduct(token, availableProduct.id);
      await deleteTestProduct(token, preorderProduct.id);
      process.exit(1);
    }
    
    // Cleanup
    await deleteTestProduct(token, availableProduct.id);
    await deleteTestProduct(token, preorderProduct.id);
    
    console.log('\n✅ All smoke tests passed!');
    console.log('  - Add Available Now: ✓');
    console.log('  - Add Pre-order: ✓');
    console.log('  - Edit Product: ✓');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Smoke test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
