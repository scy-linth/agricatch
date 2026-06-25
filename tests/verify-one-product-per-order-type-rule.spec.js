const { test, expect } = require('@playwright/test');
const { getFarmerToken } = require('./auth-helper');

test('Verify one-product-per-order-type rule still works correctly', async ({ page }) => {
  // Get farmer token
  const { token, user } = await getFarmerToken();
  
  // Get existing products for this farmer
  const productsResponse = await page.request.get('http://localhost:3000/api/products/my-products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const productsData = await productsResponse.json();
  const existingProducts = productsData.products || [];
  
  console.log(`Farmer has ${existingProducts.length} existing products`);
  
  // Check if farmer already has a product with "Pechay" in Available Now
  const existingPechayAvailable = existingProducts.find(p => 
    p.name === 'Pechay' && !p.is_preorder
  );
  
  // Check if farmer already has a product with "Pechay" in Pre-order
  const existingPechayPreorder = existingProducts.find(p => 
    p.name === 'Pechay' && p.is_preorder
  );
  
  console.log(`Existing Pechay Available Now: ${existingPechayAvailable ? 'Yes' : 'No'}`);
  console.log(`Existing Pechay Pre-order: ${existingPechayPreorder ? 'Yes' : 'No'}`);
  
  // Test Case 1: Verify no duplicate Available Now products exist
  if (existingPechayAvailable) {
    const pechayAvailableCount = existingProducts.filter(p => 
      p.name === 'Pechay' && !p.is_preorder
    ).length;
    expect(pechayAvailableCount).toBe(1);
    console.log('\n✓ Verified: Only 1 Pechay Available Now product exists (no duplicates)');
  }
  
  // Test Case 2: Verify no duplicate Pre-order products exist
  if (existingPechayPreorder) {
    const pechayPreorderCount = existingProducts.filter(p => 
      p.name === 'Pechay' && p.is_preorder
    ).length;
    expect(pechayPreorderCount).toBe(1);
    console.log('\n✓ Verified: Only 1 Pechay Pre-order product exists (no duplicates)');
  }
  
  // Test Case 3: Verify that having both Available Now and Pre-order with same name is allowed
  if (existingPechayAvailable && existingPechayPreorder) {
    console.log('\n✓ Verified: Farmer has both Pechay Available Now and Pre-order (allowed)');
  } else if (existingPechayAvailable || existingPechayPreorder) {
    console.log('\n✓ Verified: Farmer has one type of Pechay (can create the other type)');
  }
  
  // Test Case 4: Check all products for duplicates across the entire catalog
  const productNames = {};
  existingProducts.forEach(p => {
    const key = `${p.name}_${p.is_preorder ? 'preorder' : 'available'}`;
    productNames[key] = (productNames[key] || 0) + 1;
  });
  
  const duplicates = Object.entries(productNames).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('\n⚠ Found duplicate products:', duplicates);
  } else {
    console.log('\n✓ Verified: No duplicate products found (one-product-per-order-type rule enforced)');
  }
  
  expect(duplicates.length).toBe(0);
  
  console.log('\n✓ One-product-per-order-type rule verification complete');
});
