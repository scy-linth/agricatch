require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

async function testAddProductForApproval() {
  console.log('=== Testing Add Product for Approval ===\n');
  
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

  // Prepare image file
  console.log('2. Preparing image file...');
  const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', 'tomatoes.jpg');
  
  if (!fs.existsSync(imagePath)) {
    console.error(`✗ Image file not found: ${imagePath}`);
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`✓ Image file prepared: ${imagePath}\n`);

  // Upload image first
  console.log('3. Uploading image to Cloudinary...');
  const uploadFormData = new FormData();
  uploadFormData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'tomatoes.jpg');

  const uploadResponse = await fetch(`${API_BASE}/upload/product-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: uploadFormData
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

  // Add product with image
  console.log('4. Adding product for approval...');
  const productFormData = new FormData();
  productFormData.append('name', 'Test Bawang Product');
  productFormData.append('category_id', '2'); // Vegetables
  productFormData.append('unit', 'kg');
  productFormData.append('price', '50');
  productFormData.append('stock_quantity', '100');
  productFormData.append('description', 'Fresh garlic harvested today');
  productFormData.append('location', 'gaga, Barangay II (Pob.), Baler, Aurora');
  productFormData.append('available_image', uploadData.imageUrl);
  productFormData.append('cloudinary_public_id', uploadData.public_id);
  productFormData.append('is_available', 'false'); // Will be pending approval

  const addResponse = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: productFormData
  });

  if (!addResponse.ok) {
    console.error('✗ Product add failed:', await addResponse.text());
    return;
  }

  const addData = await addResponse.json();
  console.log('✓ Product added successfully!');
  console.log('  Product ID:', addData.product?.id);
  console.log('  Product Name:', addData.product?.name);
  console.log('  Status:', addData.product?.status);
  console.log();

  // Verify product is in approval status
  console.log('5. Verifying product status...');
  const verifyResponse = await fetch(`${API_BASE}/products/farmer/${farmerId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!verifyResponse.ok) {
    console.error('✗ Verification failed:', await verifyResponse.text());
    return;
  }

  const verifyData = await verifyResponse.json();
  const newProduct = verifyData.products?.find(p => p.id === addData.product?.id);

  if (newProduct) {
    console.log('✓ Product verified!');
    console.log('  Product name:', newProduct.name);
    console.log('  Status:', newProduct.status);
    console.log('  Is Available:', newProduct.is_available);
    
    if (newProduct.status === 'pending' && !newProduct.is_available) {
      console.log('\n✓✓✓ SUCCESS: Product is pending approval and not available!');
    } else {
      console.log('\n✗ FAILED: Product status is not pending');
    }
  } else {
    console.error('✗ Product not found after add');
  }

  console.log('\n=== Test Complete ===');
  console.log('The product should now appear in the Approval tab in the farmer dashboard.');
}

testAddProductForApproval().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
