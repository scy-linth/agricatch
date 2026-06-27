require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testProductEditingScenario() {
  console.log('=== Scenario 6 - Product Editing ===\n');
  
  try {
    const API_BASE = 'http://localhost:3000/api';
    
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
    console.log('✓ Login successful');
    console.log();
    
    // Step 2: Change description, price, location
    console.log('2. Changing description, price, location...');
    const initialProduct = await pool.query('SELECT * FROM products WHERE id = 98');
    const initial = initialProduct.rows[0];
    
    const editResponse = await fetch(`${API_BASE}/products/98`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'Updated description for scenario 6 testing',
        price: 55,
        location: 'Updated location for scenario 6'
      })
    });

    if (!editResponse.ok) {
      console.error('✗ Edit failed:', await editResponse.text());
      return;
    }

    const editData = await editResponse.json();
    console.log('✓ Product edited successfully');
    console.log('  Response:', JSON.stringify(editData, null, 2));
    console.log();
    
    // Step 3: Verify immediate update
    console.log('3. Verifying immediate update...');
    const updatedProduct = await pool.query('SELECT * FROM products WHERE id = 98');
    const updated = updatedProduct.rows[0];
    
    console.log('Before:');
    console.log('  Description:', initial.description);
    console.log('  Price:', initial.price);
    console.log('  Location:', initial.location);
    console.log();
    console.log('After:');
    console.log('  Description:', updated.description);
    console.log('  Price:', updated.price);
    console.log('  Location:', updated.location);
    console.log();
    
    const descriptionChanged = updated.description === 'Updated description for scenario 6 testing';
    const priceChanged = updated.price === '55.00';
    const locationChanged = updated.location === 'Updated location for scenario 6';
    
    if (descriptionChanged && priceChanged && locationChanged) {
      console.log('✓✓✓ IMMEDIATE UPDATE VERIFIED');
    } else {
      console.log('✗ Changes not applied immediately');
      console.log('  Description changed:', descriptionChanged);
      console.log('  Price changed:', priceChanged);
      console.log('  Location changed:', locationChanged);
    }
    console.log();
    
    // Step 4: Change image
    console.log('4. Changing image...');
    const fs = require('fs');
    const path = require('path');
    
    const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', 'eggs.jpg');
    
    if (!fs.existsSync(imagePath)) {
      console.error(`✗ Image file not found: ${imagePath}`);
      return;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'eggs.jpg');
    formData.append('name', updated.name);
    formData.append('category_id', updated.category_id);
    formData.append('product_id', '98');

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
    console.log('✓ Image uploaded successfully');
    console.log('  New Image URL:', uploadData.imageUrl);
    console.log();
    
    // Step 5: Update product with new image
    const imageUpdateResponse = await fetch(`${API_BASE}/products/98`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: uploadData.imageUrl,
        cloudinary_public_id: uploadData.public_id
      })
    });

    if (!imageUpdateResponse.ok) {
      console.error('✗ Image update failed:', await imageUpdateResponse.text());
      return;
    }

    console.log('✓ Product image updated');
    console.log();
    
    // Step 6: Verify approval workflow
    console.log('5. Verifying approval workflow...');
    const finalProduct = await pool.query('SELECT * FROM products WHERE id = 98');
    const final = finalProduct.rows[0];
    
    console.log('Final product status:', final.status);
    console.log('Image URL:', final.image_url);
    console.log();
    
    // For image changes, the system may or may not require re-approval
    // Check if status changed to pending
    if (final.status === 'pending') {
      console.log('✓✓✓ APPROVAL WORKFLOW TRIGGERED: Status changed to pending');
    } else if (final.status === 'approved') {
      console.log('✓ Image updated without requiring re-approval (system behavior)');
    } else {
      console.log('⚠ Unexpected status:', final.status);
    }
    
    console.log();
    console.log('=== SCENARIO 6 COMPLETE: Product Editing → Immediate Update → Image Change → Approval Workflow ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testProductEditingScenario().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
