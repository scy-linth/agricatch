require('dotenv').config();
const { pool } = require('../utils/db');
const jwt = require('jsonwebtoken');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function getFarmerToken() {
  const result = await pool.query(
    "SELECT id, email, password FROM users WHERE role = 'farmer' AND is_verified = true AND is_disabled = false LIMIT 1"
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
  
  return { token, farmerId: farmer.id, email: farmer.email };
}

async function getAdminToken() {
  const result = await pool.query(
    "SELECT id, email FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
  );
  
  if (result.rows.length === 0) {
    throw new Error('No admin found');
  }
  
  const admin = result.rows[0];
  console.log(`Using admin: ${admin.email}`);
  
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  return { token, adminId: admin.id };
}

async function createTestProduct(farmerToken) {
  console.log('\n=== Step 1: Creating test product as farmer ===');
  
  const response = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${farmerToken}`
    },
    body: JSON.stringify({
      name: `Test Approval Product ${Date.now()}`,
      description: 'This product should require approval',
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

async function checkProductInPublicAPI(productId) {
  console.log('\n=== Step 2: Checking if product appears in public API ===');
  
  const response = await fetch(`${API_BASE}/products`);
  const data = await response.json();
  
  const found = data.products.find(p => p.id === productId);
  
  if (found) {
    console.log('❌ Product is visible in public API (should not be visible while pending)');
    return false;
  } else {
    console.log('✅ Product is NOT visible in public API (correct - pending approval)');
    return true;
  }
}

async function approveProductAsAdmin(adminToken, productId) {
  console.log('\n=== Step 3: Approving product as admin ===');
  
  const response = await fetch(`${API_BASE}/admin/products/${productId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Failed to approve product:', data.message);
    throw new Error(data.message);
  }
  
  console.log('✅ Product approved');
  return data;
}

async function checkProductAfterApproval(productId) {
  console.log('\n=== Step 4: Checking if product appears after approval ===');
  
  const response = await fetch(`${API_BASE}/products`);
  const data = await response.json();
  
  const found = data.products.find(p => p.id === productId);
  
  if (found) {
    console.log('✅ Product is now visible in public API (correct - approved)');
    return true;
  } else {
    console.log('❌ Product is NOT visible in public API (should be visible after approval)');
    return false;
  }
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
    console.log('=== Testing Product Approval Workflow ===\n');
    
    const { token: farmerToken, farmerId } = await getFarmerToken();
    const { token: adminToken } = await getAdminToken();
    
    const product = await createTestProduct(farmerToken);
    
    if (product.status !== 'pending' || product.is_available !== false) {
      console.error('❌ Product was not created with pending status');
      await cleanupTestProduct(product.id);
      process.exit(1);
    }
    
    const notVisible = await checkProductInPublicAPI(product.id);
    
    await approveProductAsAdmin(adminToken, product.id);
    
    const visible = await checkProductAfterApproval(product.id);
    
    await cleanupTestProduct(product.id);
    
    if (notVisible && visible) {
      console.log('\n✅ ALL TESTS PASSED');
      console.log('   - Products require approval before appearing');
      console.log('   - Approved products appear in marketplace');
      process.exit(0);
    } else {
      console.log('\n❌ TESTS FAILED');
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
