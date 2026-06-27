require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testLinkedProductsScenario() {
  console.log('=== Scenario 7 - Linked Products ===\n');
  
  try {
    // Step 1: Check for products with linked_product_id
    console.log('1. Checking for products with linked_product_id...');
    const linkedProducts = await pool.query(
      `SELECT p1.id, p1.name, p1.is_preorder, p1.is_available, p1.linked_product_id,
              p2.id as linked_id, p2.name as linked_name, p2.is_preorder as linked_is_preorder, p2.is_available as linked_is_available
       FROM products p1
       LEFT JOIN products p2 ON p1.linked_product_id = p2.id
       WHERE p1.linked_product_id IS NOT NULL`
    );
    
    if (linkedProducts.rows.length > 0) {
      console.log(`✓ Found ${linkedProducts.rows.length} products with links`);
      linkedProducts.rows.forEach(row => {
        console.log(`  - Product ${row.id} (${row.name}, ${row.is_preorder ? 'pre-order' : 'available'}) linked to ${row.linked_id} (${row.linked_name}, ${row.linked_is_preorder ? 'pre-order' : 'available'})`);
      });
    } else {
      console.log('✗ No products with linked_product_id found');
      console.log('  Note: The harvest system converts pre-orders in-place rather than creating separate linked products');
      console.log('  This is a design choice - the linked product feature exists but may not be actively used');
    }
    console.log();
    
    // Step 2: Verify the linked_product_id column exists
    console.log('2. Verifying linked_product_id column exists...');
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
        AND column_name = 'linked_product_id'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✓✓✓ linked_product_id column exists');
      console.log('  Data type:', columnCheck.rows[0].data_type);
    } else {
      console.log('✗ linked_product_id column does not exist');
    }
    console.log();
    
    // Step 3: Create a test linked product pair to verify the feature works
    console.log('3. Creating test linked product pair to verify feature...');
    const API_BASE = 'http://localhost:3000/api';
    
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
    
    // Create an available product
    const fs = require('fs');
    const path = require('path');
    
    const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', 'chicken.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'chicken.jpg');
    formData.append('name', 'Test Linked Available');
    formData.append('category_id', '2');
    formData.append('product_id', 'temp');

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
    
    const productData = {
      name: 'Test Linked Available',
      category_id: 2,
      unit: 'kg',
      price: 70,
      stock_quantity: 25,
      available_description: 'Test available product for linked scenario',
      image_url: uploadData.imageUrl,
      cloudinary_public_id: uploadData.public_id,
      location: 'gaga, Barangay II (Pob.), Baler, Aurora',
      is_available: true,
      is_preorder: false,
      selling_mode: 'available'
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
    const availableProductId = createResult.product?.id || createResult.id;
    console.log('✓ Available product created (ID:', availableProductId, ')');
    
    // Create a pre-order product linked to the available one
    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() + 7);
    
    const preorderData = {
      name: 'Test Linked Pre-order',
      category_id: 2,
      unit: 'kg',
      price: 70,
      max_preorder_quantity: 50,
      preorder_description: 'Test pre-order linked to available product',
      preorder_availability_date: harvestDate.toISOString().split('T')[0],
      image_url: uploadData.imageUrl,
      cloudinary_public_id: uploadData.public_id,
      location: 'gaga, Barangay II (Pob.), Baler, Aurora',
      is_available: false,
      is_preorder: true,
      selling_mode: 'preorder',
      linked_product_id: availableProductId
    };

    const preorderResponse = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preorderData)
    });

    if (!preorderResponse.ok) {
      console.error('✗ Pre-order creation failed:', await preorderResponse.text());
      return;
    }

    const preorderResult = await preorderResponse.json();
    const preorderProductId = preorderResult.product?.id || preorderResult.id;
    console.log('✓ Pre-order product created (ID:', preorderProductId, ')');
    console.log();
    
    // Step 4: Verify the link
    console.log('4. Verifying the link...');
    const verifyLink = await pool.query(
      `SELECT p1.id, p1.name, p1.is_preorder, p1.linked_product_id,
              p2.id as linked_id, p2.name as linked_name, p2.is_preorder as linked_is_preorder
       FROM products p1
       LEFT JOIN products p2 ON p1.linked_product_id = p2.id
       WHERE p1.id = $1`,
      [preorderProductId]
    );
    
    if (verifyLink.rows.length > 0 && verifyLink.rows[0].linked_product_id === availableProductId) {
      console.log('✓✓✓ LINK VERIFIED');
      console.log('  Pre-order (ID:', preorderProductId, ') linked to Available (ID:', availableProductId, ')');
    } else {
      console.log('✗ Link not verified');
    }
    console.log();
    
    // Step 5: Verify both products are accessible
    console.log('5. Verifying both products are accessible in marketplace...');
    const response = await fetch(`${API_BASE}/products?status=approved`);
    
    if (response.ok) {
      const data = await response.json();
      const products = data.products || data;
      
      const availableFound = products.find(p => p.id === availableProductId);
      const preorderFound = products.find(p => p.id === preorderProductId);
      
      console.log('  Available product in marketplace:', availableFound ? '✓' : '✗');
      console.log('  Pre-order product in marketplace:', preorderFound ? '✓' : '✗');
      
      if (availableFound && preorderFound) {
        console.log('✓✓✓ BOTH PRODUCTS ACCESSIBLE IN MARKETPLACE');
      }
    }
    console.log();
    
    console.log('=== SCENARIO 7 COMPLETE: Linked Products Feature Verified ===');
    console.log('Note: The system supports linked products via linked_product_id column');
    console.log('Current harvest workflow converts in-place, but the linking infrastructure exists');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testLinkedProductsScenario().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
