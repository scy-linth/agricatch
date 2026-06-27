require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

// Available images to use
const availableImages = [
  'tomatoes.jpg',
  'lettuce.jpg',
  'malunggay.jpg',
  'calamansi.jpg',
  'eggs.jpg',
  'rice.jpg',
  'chicken.jpg'
];

async function updateProductsWithoutImages() {
  console.log('=== Updating Products Without Images ===\n');
  
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

  // Get all farmer products
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
  console.log(`✓ Found ${products.length} products\n`);

  // Filter products without images
  const productsWithoutImages = products.filter(p => 
    !p.image_url || 
    p.image_url === '' || 
    p.image_url === 'null' || 
    p.image_url === '/images/logo.png'
  );

  console.log(`3. Found ${productsWithoutImages.length} products without images\n`);

  if (productsWithoutImages.length === 0) {
    console.log('✓ All products have images. No updates needed.');
    return;
  }

  // Update each product
  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < productsWithoutImages.length; i++) {
    const product = productsWithoutImages[i];
    const imageIndex = i % availableImages.length;
    const imageName = availableImages[imageIndex];
    const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', imageName);

    console.log(`4.${i + 1}. Updating product: ${product.name} (ID: ${product.id})`);
    console.log(`    Using image: ${imageName}`);

    if (!fs.existsSync(imagePath)) {
      console.error(`    ✗ Image file not found: ${imagePath}`);
      failedCount++;
      continue;
    }

    try {
      // Upload image
      const imageBuffer = fs.readFileSync(imagePath);
      const formData = new FormData();
      formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), imageName);
      formData.append('name', product.name);
      formData.append('category_id', product.category_id);
      formData.append('product_id', product.id);

      const uploadResponse = await fetch(`${API_BASE}/upload/product-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!uploadResponse.ok) {
        console.error(`    ✗ Image upload failed:`, await uploadResponse.text());
        failedCount++;
        continue;
      }

      const uploadData = await uploadResponse.json();
      console.log(`    ✓ Image uploaded: ${uploadData.public_id}`);

      // Update product
      const updateFormData = new FormData();
      updateFormData.append('image_url', uploadData.imageUrl);
      updateFormData.append('cloudinary_public_id', uploadData.public_id);

      const updateResponse = await fetch(`${API_BASE}/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: updateFormData
      });

      if (!updateResponse.ok) {
        console.error(`    ✗ Product update failed:`, await updateResponse.text());
        failedCount++;
        continue;
      }

      console.log(`    ✓ Product updated successfully\n`);
      updatedCount++;
    } catch (error) {
      console.error(`    ✗ Error updating product:`, error.message);
      failedCount++;
    }
  }

  console.log('=== Summary ===');
  console.log(`Total products without images: ${productsWithoutImages.length}`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('\n=== Complete ===');
}

updateProductsWithoutImages().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
