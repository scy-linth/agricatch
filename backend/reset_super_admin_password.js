require('dotenv').config();
const {pool} = require('./utils/db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const newPassword = await bcrypt.hash('etitsmwa123', 10);
    const res = await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, username, role',
      [newPassword, 'scy@linth']
    );
    console.log('Super Admin password updated:');
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
