require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testHarvestNoScenario() {
  console.log('=== Scenario 4 - Harvest NO ===\n');
  
  try {
    // Step 1: Set product to harvested status (Harvest NO)
    console.log('1. Setting product to harvested status (Harvest NO)...');
    const updateResult = await pool.query(
      `UPDATE products 
       SET status = 'harvested', 
           is_available = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [100]
    );
    
    const harvestedProduct = updateResult.rows[0];
    console.log('✓ Product set to harvested status');
    console.log('  Product ID:', harvestedProduct.id);
    console.log('  Status:', harvestedProduct.status);
    console.log('  Is Available:', harvestedProduct.is_available);
    console.log();
    
    // Step 2: Verify hidden from marketplace
    console.log('2. Verifying product is hidden from marketplace...');
    const API_BASE = 'http://localhost:3000/api';
    const response = await fetch(`${API_BASE}/products?status=approved`);
    
    if (response.ok) {
      const data = await response.json();
      const products = data.products || data;
      const foundInMarketplace = products.find(p => p.id === 100);
      
      if (foundInMarketplace) {
        console.log('✗ Product still visible in marketplace (FAIL)');
      } else {
        console.log('✓✓✓ Product hidden from marketplace');
      }
    }
    console.log();
    
    // Step 3: Verify visible in farmer history
    console.log('3. Verifying product is visible in farmer history...');
    const farmerProducts = await pool.query(
      `SELECT * FROM products 
       WHERE farmer_id = $1 
         AND id = $2`,
      [42, 100]
    );
    
    if (farmerProducts.rows.length > 0) {
      console.log('✓✓✓ Product visible in farmer history');
      console.log('  Status in history:', farmerProducts.rows[0].status);
    } else {
      console.log('✗ Product not found in farmer history (FAIL)');
    }
    console.log();
    
    // Step 4: Create new pre-order with same name
    console.log('4. Creating new pre-order with same name...');
    const fs = require('fs');
    const path = require('path');
    
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
    
    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() + 7);
    
    const productData = {
      name: 'Test Scenario 4 Pre-order',
      category_id: 2,
      unit: 'kg',
      price: 45,
      max_preorder_quantity: 30,
      preorder_description: 'Test pre-order for harvest NO scenario - second cycle',
      preorder_availability_date: harvestDate.toISOString().split('T')[0],
      image_url: harvestedProduct.image_url,
      cloudinary_public_id: harvestedProduct.cloudinary_public_id,
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
    const newProductId = createResult.product?.id || createResult.id;
    console.log('✓ New pre-order created');
    console.log('  Product ID:', newProductId);
    console.log();
    
    // Step 5: Verify automatic previous value reuse
    console.log('5. Verifying automatic previous value reuse...');
    const newProductResult = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [newProductId]
    );
    const newProduct = newProductResult.rows[0];
    
    console.log('New product values:');
    console.log('  Name:', newProduct.name);
    console.log('  Price:', newProduct.price);
    console.log('  Location:', newProduct.location);
    console.log('  Category ID:', newProduct.category_id);
    console.log('  Image URL:', newProduct.image_url);
    console.log();
    
    const valuesMatch = 
      newProduct.name === harvestedProduct.name &&
      newProduct.price === harvestedProduct.price &&
      newProduct.location === harvestedProduct.location &&
      newProduct.category_id === harvestedProduct.category_id &&
      newProduct.image_url === harvestedProduct.image_url;
    
    if (valuesMatch) {
      console.log('✓✓✓ AUTOMATIC PREVIOUS VALUE REUSE VERIFIED');
    } else {
      console.log('✗ Values do not match automatically (may need manual reuse)');
    }
    
    console.log();
    console.log('=== SCENARIO 4 COMPLETE: Harvest NO → Harvested Status → Hidden → Visible in History → New Pre-order → Automatic Reuse ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testHarvestNoScenario().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
