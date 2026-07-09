require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

async function main() {
  const res = await pool.query(
    "SELECT id, email, role, username FROM users WHERE email IN ('testadmin@test.com', 'testfarmer@test.com', 'dhelhilis@gmail.com', 'scy@linth')",
    []
  );
  const rows = res.rows;
  console.log('Users:');
  console.log(JSON.stringify(rows, null, 2));

  const JWT_SECRET = process.env.JWT_SECRET;
  for (const user of rows) {
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.username
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log(`\nToken for ${user.email} (${user.role}):\n${token}\n`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
