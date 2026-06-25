const fs = require('fs');

async function testAdminUISetting() {
  try {
    console.log('=== Testing Admin UI for max_products_per_farmer Setting ===\n');

    // Test 1: Check if input field exists in admin.html
    console.log('Test 1: Checking if input field exists in admin.html...');
    const adminHtml = fs.readFileSync('../frontend/admin.html', 'utf8');
    
    if (adminHtml.includes('setting-max-products-per-farmer')) {
      console.log('✓ Input field with id="setting-max-products-per-farmer" exists');
    } else {
      console.log('✗ Input field NOT found in admin.html');
      return;
    }

    // Test 2: Check if data-key is set correctly
    console.log('\nTest 2: Checking if data-key is set to max_products_per_farmer...');
    if (adminHtml.includes('data-key="max_products_per_farmer"')) {
      console.log('✓ data-key attribute is correct');
    } else {
      console.log('✗ data-key attribute is incorrect or missing');
      return;
    }

    // Test 3: Check if admin.js populates the field
    console.log('\nTest 3: Checking if admin.js populates the field...');
    const adminJs = fs.readFileSync('../frontend/js/admin.js', 'utf8');
    
    if (adminJs.includes('maxProductsPerFarmer') && adminJs.includes('max_products_per_farmer')) {
      console.log('✓ admin.js has code to handle max_products_per_farmer');
    } else {
      console.log('✗ admin.js does not handle max_products_per_farmer');
      return;
    }

    // Test 4: Check if setting is in the allowed keys list
    console.log('\nTest 4: Checking if max_products_per_farmer is in allowed keys...');
    if (adminJs.includes("'max_products_per_farmer'")) {
      console.log('✓ max_products_per_farmer is in the allowed keys list');
    } else {
      console.log('✗ max_products_per_farmer is NOT in allowed keys');
      return;
    }

    // Test 5: Check if farmer.js loads platform settings
    console.log('\nTest 5: Checking if farmer.js loads platform settings...');
    const farmerJs = fs.readFileSync('../frontend/js/farmer.js', 'utf8');
    
    if (farmerJs.includes('loadPlatformSettings') && farmerJs.includes('maxProductsPerFarmer')) {
      console.log('✓ farmer.js has loadPlatformSettings method and maxProductsPerFarmer variable');
    } else {
      console.log('✗ farmer.js does not load platform settings');
      return;
    }

    // Test 6: Check if farmer.js uses the configurable limit in warnings
    console.log('\nTest 6: Checking if farmer.js uses configurable limit in warnings...');
    if (farmerJs.includes('this.maxProductsPerFarmer') && !farmerJs.includes('productCount >= 8')) {
      console.log('✓ farmer.js uses configurable limit in warnings');
    } else {
      console.log('✗ farmer.js still has hardcoded values');
      return;
    }

    console.log('\n=== All admin UI tests passed! ===');
    console.log('The setting can be configured via superadmin Platform Settings UI');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testAdminUISetting();
