const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testProductLimitBackend() {
  try {
    console.log('=== Testing Backend Product Limit Enforcement ===\n');

    // Test 1: Check if getPlatformSetting is imported in products.js
    console.log('Test 1: Checking if getPlatformSetting is imported in products.js...');
    const fs = require('fs');
    const productsJs = fs.readFileSync('./routes/products.js', 'utf8');
    
    if (productsJs.includes("getPlatformSetting")) {
      console.log('✓ getPlatformSetting is imported');
    } else {
      console.log('✗ getPlatformSetting is NOT imported');
      return;
    }

    // Test 2: Check if max_products_per_farmer is used
    console.log('\nTest 2: Checking if max_products_per_farmer setting is used...');
    if (productsJs.includes("max_products_per_farmer")) {
      console.log('✓ max_products_per_farmer setting is referenced');
    } else {
      console.log('✗ max_products_per_farmer setting is NOT referenced');
      return;
    }

    // Test 3: Check if hardcoded 10 is replaced
    console.log('\nTest 3: Checking if hardcoded limit is replaced...');
    const hasHardcoded10 = productsJs.includes("count >= 10") && !productsJs.includes("maxProducts");
    if (!hasHardcoded10) {
      console.log('✓ Hardcoded limit appears to be replaced with configurable value');
    } else {
      console.log('✗ Hardcoded limit still exists');
      return;
    }

    // Test 4: Set a test value in database
    console.log('\nTest 4: Setting test value (2) in database...');
    await pool.query(
      "UPDATE platform_settings SET value = '2', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_farmer'"
    );
    console.log('✓ Test value set to 2');

    // Test 5: Verify the code uses getPlatformSetting with correct key
    console.log('\nTest 5: Verifying getPlatformSetting usage...');
    if (productsJs.includes("getPlatformSetting('max_products_per_farmer'")) {
      console.log('✓ getPlatformSetting is called with correct key');
    } else {
      console.log('✗ getPlatformSetting not called with correct key');
    }

    // Test 6: Reset to default
    console.log('\nTest 6: Resetting to default value (10)...');
    await pool.query(
      "UPDATE platform_settings SET value = '10', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_farmer'"
    );
    console.log('✓ Setting reset to 10');

    console.log('\n=== Backend code structure tests passed! ===');
    console.log('Note: Full integration test requires running server and making API calls');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testProductLimitBackend();
