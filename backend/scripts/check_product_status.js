const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT id, name, status, is_available, is_admin_disabled 
  FROM products 
  WHERE farmer_id = 42 
  ORDER BY id DESC 
  LIMIT 10
`)
  .then(r => {
    console.log('Products for test farmer (ID: 42):');
    console.log(JSON.stringify(r.rows, null, 2));
  })
  .catch(e => console.error(e.message))
  .finally(() => pool.end());
