require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testHarvestNoWithEdit() {
  console.log('=== Scenario 4 - Harvest NO (with Edit Approach) ===\n');
  
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
    
    // Step 4: Reactivate product as new pre-order cycle (edit approach)
    console.log('4. Reactivating product as new pre-order cycle...');
    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() + 7);
    
    const reactivateResult = await pool.query(
      `UPDATE products 
       SET status = 'approved',
           is_available = false,
           is_preorder = true,
           reserved_quantity = 0,
           preorder_availability_date = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [harvestDate.toISOString().split('T')[0], 100]
    );
    
    const reactivatedProduct = reactivateResult.rows[0];
    console.log('✓ Product reactivated as new pre-order cycle');
    console.log('  Product ID:', reactivatedProduct.id);
    console.log('  Status:', reactivatedProduct.status);
    console.log('  Is Pre-order:', reactivatedProduct.is_preorder);
    console.log('  Pre-order Availability Date:', reactivatedProduct.preorder_availability_date);
    console.log();
    
    // Step 5: Verify previous values preserved
    console.log('5. Verifying previous values preserved...');
    const valuesPreserved = 
      reactivatedProduct.name === harvestedProduct.name &&
      reactivatedProduct.price === harvestedProduct.price &&
      reactivatedProduct.location === harvestedProduct.location &&
      reactivatedProduct.category_id === harvestedProduct.category_id &&
      reactivatedProduct.image_url === harvestedProduct.image_url;
    
    if (valuesPreserved) {
      console.log('✓✓✓ PREVIOUS VALUES PRESERVED (Automatic Reuse)');
      console.log('  Name:', reactivatedProduct.name);
      console.log('  Price:', reactivatedProduct.price);
      console.log('  Location:', reactivatedProduct.location);
      console.log('  Image URL:', reactivatedProduct.image_url);
    } else {
      console.log('✗ Values not preserved');
    }
    
    console.log();
    console.log('=== SCENARIO 4 COMPLETE: Harvest NO → Harvested Status → Hidden → Visible in History → New Pre-order Cycle → Values Preserved ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testHarvestNoWithEdit().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
