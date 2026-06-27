require('dotenv').config();
const { pool } = require('../utils/db');

async function checkPlatformSettings() {
  try {
    console.log('=== Checking Platform Settings ===\n');

    const result = await pool.query(`
      SELECT key, value
      FROM platform_settings
      WHERE key IN ('max_products_per_name_available', 'max_products_per_name_preorder')
      ORDER BY key
    `);

    if (result.rows.length === 0) {
      console.log('No product limit settings found in platform_settings');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.key}: ${row.value}`);
      });
    }

    console.log('\n=== Product Creation Behavior ===');
    console.log('Platform settings: FRONTEND ONLY (soft validation)');
    console.log('Backend validation: NONE (can bypass limits)');
    console.log('Auto-sync: NO (each product is independent)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPlatformSettings();
