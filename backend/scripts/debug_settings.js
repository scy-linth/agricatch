const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugSettings() {
  try {
    console.log('=== Debugging Platform Settings ===\n');

    const res = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key IN ('max_products_per_name_available', 'max_products_per_name_preorder')"
    );
    
    console.log('Current settings in database:');
    res.rows.forEach(row => {
      console.log(`  ${row.key}: ${row.value}`);
    });

    console.log('\nExpected behavior:');
    console.log('  - If limit is 5, product names with < 5 existing products should show in dropdown');
    console.log('  - If you have 1 "Pakwan" product, "Pakwan" should still appear in dropdown (1 < 5)');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugSettings();
