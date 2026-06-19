require('dotenv').config({ path: '.env' });
const { pool } = require('../utils/db');

async function checkMaintenanceMode() {
  try {
    const result = await pool.query(
      'SELECT key, name, enabled FROM feature_flags WHERE key = $1',
      ['maintenance_mode']
    );
    console.log('Maintenance mode flag:', JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkMaintenanceMode();
