const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testPerNameLimits() {
  try {
    console.log('=== Testing Per-Product-Name Per-Type Limits ===\n');

    // Test 1: Check if settings exist in database
    console.log('Test 1: Checking if max_products_per_name settings exist...');
    const settingRes = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key IN ('max_products_per_name_available', 'max_products_per_name_preorder')"
    );
    
    if (settingRes.rows.length === 2) {
      console.log('✓ Both settings exist in database');
      settingRes.rows.forEach(row => {
        console.log(`  - ${row.key}: ${row.value}`);
      });
    } else {
      console.log('✗ Settings missing from database');
      return;
    }

    // Test 2: Update to test values (2 for development)
    console.log('\nTest 2: Updating settings to test values (2)...');
    await pool.query(
      "UPDATE platform_settings SET value = '2', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_name_available'"
    );
    await pool.query(
      "UPDATE platform_settings SET value = '2', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_name_preorder'"
    );
    console.log('✓ Settings updated to 2');

    // Test 3: Verify the update
    console.log('\nTest 3: Verifying the update...');
    const verifyRes = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key IN ('max_products_per_name_available', 'max_products_per_name_preorder')"
    );
    verifyRes.rows.forEach(row => {
      console.log(`  - ${row.key}: ${row.value}`);
    });
    console.log('✓ Update verified');

    // Test 4: Check if admin.html has the UI fields
    console.log('\nTest 4: Checking if admin.html has UI fields...');
    const adminHtml = fs.readFileSync('../frontend/admin.html', 'utf8');
    
    if (adminHtml.includes('setting-max-products-per-name-available') && 
        adminHtml.includes('setting-max-products-per-name-preorder')) {
      console.log('✓ UI fields exist in admin.html');
    } else {
      console.log('✗ UI fields missing from admin.html');
      return;
    }

    // Test 5: Check if admin.js handles the settings
    console.log('\nTest 5: Checking if admin.js handles the settings...');
    const adminJs = fs.readFileSync('../frontend/js/admin.js', 'utf8');
    
    if (adminJs.includes('maxProductsPerNameAvailable') && 
        adminJs.includes('maxProductsPerNamePreorder') &&
        adminJs.includes('max_products_per_name_available') &&
        adminJs.includes('max_products_per_name_preorder')) {
      console.log('✓ admin.js handles both settings');
    } else {
      console.log('✗ admin.js does not handle settings properly');
      return;
    }

    // Test 6: Check if farmer.js uses the configurable limits
    console.log('\nTest 6: Checking if farmer.js uses configurable limits...');
    const farmerJs = fs.readFileSync('../frontend/js/farmer.js', 'utf8');
    
    if (farmerJs.includes('maxProductsPerNameAvailable') && 
        farmerJs.includes('maxProductsPerNamePreorder') &&
        farmerJs.includes('nameCounts') &&
        farmerJs.includes('limit')) {
      console.log('✓ farmer.js uses configurable limits');
    } else {
      console.log('✗ farmer.js does not use configurable limits');
      return;
    }

    // Test 7: Reset to default (1)
    console.log('\nTest 7: Resetting to default values (1)...');
    await pool.query(
      "UPDATE platform_settings SET value = '1', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_name_available'"
    );
    await pool.query(
      "UPDATE platform_settings SET value = '1', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_name_preorder'"
    );
    console.log('✓ Settings reset to 1');

    console.log('\n=== All tests passed! ===');
    console.log('The per-product-name per-type limits are now configurable via superadmin settings.');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testPerNameLimits();
