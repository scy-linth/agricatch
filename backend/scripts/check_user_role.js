require('dotenv').config({ path: '.env' });
const { pool } = require('../utils/db');

async function checkUserRole() {
  try {
    const result = await pool.query(
      'SELECT id, username, role, email FROM users WHERE username = $1',
      ['admin']
    );
    console.log('User data:', JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUserRole();
