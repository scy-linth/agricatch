const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testMaxProductsSetting() {
  try {
    console.log('=== Testing max_products_per_farmer Setting ===\n');

    // Test 1: Check if setting exists in database
    console.log('Test 1: Checking if max_products_per_farmer exists in platform_settings...');
    const settingRes = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key = 'max_products_per_farmer'"
    );
    
    if (settingRes.rows.length > 0) {
      const value = settingRes.rows[0].value;
      console.log(`✓ Setting exists with value: ${value}`);
    } else {
      console.log('✗ Setting does not exist in database');
      return;
    }

    // Test 2: Update the setting to a test value (2 for development)
    console.log('\nTest 2: Updating setting to test value (2)...');
    await pool.query(
      "UPDATE platform_settings SET value = '2', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_farmer'"
    );
    console.log('✓ Setting updated to 2');

    // Test 3: Verify the update
    console.log('\nTest 3: Verifying the update...');
    const verifyRes = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key = 'max_products_per_farmer'"
    );
    console.log(`✓ Current value: ${verifyRes.rows[0].value}`);

    // Test 4: Reset to default (10)
    console.log('\nTest 4: Resetting to default value (10)...');
    await pool.query(
      "UPDATE platform_settings SET value = '10', updated_at = CURRENT_TIMESTAMP WHERE key = 'max_products_per_farmer'"
    );
    console.log('✓ Setting reset to 10');

    // Test 5: Final verification
    console.log('\nTest 5: Final verification...');
    const finalRes = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key = 'max_products_per_farmer'"
    );
    console.log(`✓ Final value: ${finalRes.rows[0].value}`);

    console.log('\n=== All tests passed! ===');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testMaxProductsSetting();
