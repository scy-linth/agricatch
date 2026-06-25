require('dotenv').config();
const { pool } = require('../utils/db');

async function checkFeatureFlags() {
  try {
    const result = await pool.query('SELECT key, name, enabled FROM feature_flags ORDER BY key');
    
    console.log('Current Feature Flags:');
    console.log('=====================');
    result.rows.forEach(row => {
      console.log(`  ${row.key}: ${row.name} (${row.enabled ? 'ON' : 'OFF'})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkFeatureFlags();
