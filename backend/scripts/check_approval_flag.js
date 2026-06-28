const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT key, enabled FROM feature_flags WHERE key = $1', ['require_product_approval'])
  .then(r => {
    console.log(JSON.stringify(r.rows, null, 2));
  })
  .catch(e => console.error(e.message))
  .finally(() => pool.end());
