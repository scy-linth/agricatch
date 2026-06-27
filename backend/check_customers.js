const { pool } = require('./utils/db');

(async () => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role FROM users WHERE role = $1 LIMIT 5',
      ['customer']
    );
    console.log(JSON.stringify(result.rows, null, 2));
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
