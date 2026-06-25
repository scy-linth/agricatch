const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  INSERT INTO platform_settings (key, value, updated_at) VALUES 
    ('max_products_per_name_available', '1', CURRENT_TIMESTAMP),
    ('max_products_per_name_preorder', '1', CURRENT_TIMESTAMP)
  ON CONFLICT (key) DO NOTHING
`)
  .then(() => {
    console.log('✓ max_products_per_name settings added (or already exist)');
    console.log('  - max_products_per_name_available: 1');
    console.log('  - max_products_per_name_preorder: 1');
    pool.end();
  })
  .catch(err => {
    console.error('✗ Migration failed:', err.message);
    pool.end();
    process.exit(1);
  });
