require('dotenv').config();
const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT id, username, email, role FROM users WHERE role = 'customer' LIMIT 5")
  .then(r => {
    console.log(JSON.stringify(r.rows, null, 2));
    pool.end();
  })
  .catch(e => {
    console.error(e.message);
    pool.end();
  });
