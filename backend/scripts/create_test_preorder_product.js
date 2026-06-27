require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

async function createTestPreorderProduct() {
  console.log('=== Creating Test Pre-order Product for Scenario 2 ===\n');
  
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
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'tomatoes.jpg');
  formData.append('name', 'Test Scenario 2 Pre-order');
  formData.append('category_id', '2'); // Vegetables
  formData.append('product_id', 'temp');

  console.log(`✓ Image file prepared: ${imagePath}\n`);

  // Upload image
  console.log('3. Uploading image to Cloudinary...');
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

  // Create pre-order product
  console.log('4. Creating pre-order product...');
  const harvestDate = new Date();
  harvestDate.setDate(harvestDate.getDate() + 7); // 7 days from now
  
  const productData = {
    name: 'Test Scenario 2 Pre-order',
    category_id: 2,
    unit: 'kg',
    price: 60,
    max_preorder_quantity: 50,
    preorder_description: 'Fresh pre-order test product for certification scenario 2',
    preorder_availability_date: harvestDate.toISOString().split('T')[0],
    image_url: uploadData.imageUrl,
    cloudinary_public_id: uploadData.public_id,
    location: 'gaga, Barangay II (Pob.), Baler, Aurora',
    is_available: false,
    is_preorder: true,
    selling_mode: 'preorder'
  };

  const createResponse = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(productData)
  });

  if (!createResponse.ok) {
    console.error('✗ Product creation failed:', await createResponse.text());
    return;
  }

  const createResult = await createResponse.json();
  console.log('✓ Pre-order product created successfully!');
  console.log('  Product ID:', createResult.product?.id || createResult.id);
  console.log('  Product Name:', createResult.product?.name || createResult.name);
  console.log('  Status:', createResult.product?.status || createResult.status);
  console.log('  Is Pre-order:', createResult.product?.is_preorder || createResult.is_preorder);
  console.log();

  console.log('=== Test Pre-order Product Created Successfully ===');
  return createResult.product?.id || createResult.id;
}

createTestPreorderProduct().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
