require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

// Test product image upload endpoint
async function testProductImageUpload() {
  console.log('=== Testing Product Image Upload ===\n');
  
  // First, login as test farmer to get token
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

  // Get a product ID to test with
  console.log('2. Getting farmer products...');
  const productsResponse = await fetch(`${API_BASE}/products/farmer/${farmerId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!productsResponse.ok) {
    console.error('✗ Failed to get products:', await productsResponse.text());
    return;
  }

  const productsData = await productsResponse.json();
  const products = productsData.products || [];
  
  if (products.length === 0) {
    console.error('✗ No products found for testing');
    return;
  }

  const testProduct = products[0];
  console.log(`✓ Found product: ${testProduct.name} (ID: ${testProduct.id})\n`);

  // Prepare image file for upload
  console.log('3. Preparing image file...');
  const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', 'tomatoes.jpg');
  
  if (!fs.existsSync(imagePath)) {
    console.error(`✗ Image file not found: ${imagePath}`);
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'tomatoes.jpg');
  formData.append('name', testProduct.name);
  formData.append('category_id', testProduct.category_id);
  formData.append('product_id', testProduct.id);

  console.log(`✓ Image file prepared: ${imagePath}\n`);

  // Upload image
  console.log('4. Uploading image to Cloudinary...');
  const uploadResponse = await fetch(`${API_BASE}/upload/product-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!uploadResponse.ok) {
    console.error('✗ Image upload failed:', await uploadResponse.text());
    return;
  }

  const uploadData = await uploadResponse.json();
  console.log('✓ Image upload successful!');
  console.log('  Image URL:', uploadData.imageUrl);
  console.log('  Public ID:', uploadData.public_id);
  console.log();

  // Update product with new image
  console.log('5. Updating product with new image...');
  const updateFormData = new FormData();
  updateFormData.append('image_url', uploadData.imageUrl);
  updateFormData.append('cloudinary_public_id', uploadData.public_id);

  const updateResponse = await fetch(`${API_BASE}/products/${testProduct.id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: updateFormData
  });

  if (!updateResponse.ok) {
    console.error('✗ Product update failed:', await updateResponse.text());
    return;
  }

  console.log('✓ Product updated successfully!\n');

  // Verify the update
  console.log('6. Verifying product update...');
  const verifyResponse = await fetch(`${API_BASE}/products/farmer/${farmerId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!verifyResponse.ok) {
    console.error('✗ Verification failed:', await verifyResponse.text());
    return;
  }

  const verifyData = await verifyResponse.json();
  const updatedProduct = verifyData.products?.find(p => p.id === testProduct.id);

  if (updatedProduct) {
    console.log('✓ Product verified!');
    console.log('  Product name:', updatedProduct.name);
    console.log('  Image URL:', updatedProduct.image_url);
    console.log('  Cloudinary Public ID:', updatedProduct.cloudinary_public_id);
    
    if (updatedProduct.image_url === uploadData.imageUrl) {
      console.log('\n✓✓✓ SUCCESS: Image URL matches uploaded image!');
    } else {
      console.log('\n✗ FAILED: Image URL does not match');
    }
  } else {
    console.error('✗ Product not found after update');
  }

  console.log('\n=== Test Complete ===');
}

testProductImageUpload().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
