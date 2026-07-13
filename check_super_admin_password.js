require('dotenv').config({ path: './backend/.env' });
const {pool} = require('./backend/utils/db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const res = await pool.query('SELECT id, email, username, role, password FROM users WHERE role = $1', ['super_admin']);
    console.log('Super Admin accounts:');
    for (const user of res.rows) {
      console.log(`ID: ${user.id}, Email: ${user.email}, Username: ${user.username}`);
      const isValid = await bcrypt.compare('etitsmwa123', user.password);
      console.log(`  Password 'etitsmwa123' valid: ${isValid}`);
    }
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
