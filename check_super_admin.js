require('dotenv').config({ path: './backend/.env' });
const {pool} = require('./backend/utils/db');

(async () => {
  try {
    const res = await pool.query('SELECT id, email, username, role FROM users WHERE role = $1', ['super_admin']);
    console.log('Super Admin accounts:');
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
