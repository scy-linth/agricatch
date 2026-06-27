require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testAvailableUnavailableScenario() {
  console.log('=== Scenario 5 - Available/Unavailable ===\n');
  
  try {
    const API_BASE = 'http://localhost:3000/api';
    
    // Step 1: Start with available product (use product 98)
    console.log('1. Starting with available product (ID: 98)...');
    const initialProduct = await pool.query('SELECT * FROM products WHERE id = 98');
    console.log('  Initial Status:', initialProduct.rows[0].is_available ? 'Available' : 'Unavailable');
    console.log('  Initial Stock:', initialProduct.rows[0].stock_quantity);
    console.log();
    
    // Step 2: Set to unavailable
    console.log('2. Setting product to unavailable...');
    const unavailableResult = await pool.query(
      `UPDATE products 
       SET is_available = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [98]
    );
    console.log('✓ Product set to unavailable');
    console.log('  Is Available:', unavailableResult.rows[0].is_available);
    console.log();
    
    // Step 3: Verify hidden from marketplace
    console.log('3. Verifying product is hidden from marketplace...');
    const response = await fetch(`${API_BASE}/products?status=approved&is_available=true`);
    
    if (response.ok) {
      const data = await response.json();
      const products = data.products || data;
      const foundInMarketplace = products.find(p => p.id === 98);
      
      if (foundInMarketplace) {
        console.log('✗ Product still visible in marketplace (FAIL)');
      } else {
        console.log('✓✓✓ Product hidden from marketplace');
      }
    }
    console.log();
    
    // Step 4: Verify existing orders continue
    console.log('4. Verifying existing orders continue...');
    const orders = await pool.query(
      `SELECT * FROM orders WHERE product_id = 98 AND status != 'cancelled'`
    );
    console.log(`✓ Found ${orders.rows.length} existing orders for product 98`);
    orders.rows.forEach(order => {
      console.log(`  - Order ID: ${order.id}, Status: ${order.status}, Quantity: ${order.quantity}`);
    });
    if (orders.rows.length > 0) {
      console.log('✓✓✓ Existing orders continue (not cancelled)');
    }
    console.log();
    
    // Step 5: Set to available again
    console.log('5. Setting product to available again...');
    const availableResult = await pool.query(
      `UPDATE products 
       SET is_available = true,
           stock_quantity = 15,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [98]
    );
    console.log('✓ Product set to available again');
    console.log('  Is Available:', availableResult.rows[0].is_available);
    console.log('  Stock Quantity:', availableResult.rows[0].stock_quantity);
    console.log();
    
    // Step 6: Verify visible in marketplace
    console.log('6. Verifying product is visible in marketplace again...');
    const response2 = await fetch(`${API_BASE}/products?status=approved&is_available=true`);
    
    if (response2.ok) {
      const data = await response2.json();
      const products = data.products || data;
      const foundInMarketplace = products.find(p => p.id === 98);
      
      if (foundInMarketplace) {
        console.log('✓✓✓ Product visible in marketplace again');
        console.log('  Product Name:', foundInMarketplace.name);
        console.log('  Price:', foundInMarketplace.price);
        console.log('  Stock:', foundInMarketplace.stock_quantity);
      } else {
        console.log('✗ Product not visible in marketplace (FAIL)');
      }
    }
    console.log();
    
    console.log('=== SCENARIO 5 COMPLETE: Available → Unavailable → Hidden → Orders Continue → Available Again → Visible ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testAvailableUnavailableScenario().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
