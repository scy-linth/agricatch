const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(
  `INSERT INTO platform_settings (key, value, updated_at) VALUES ('delivery_fee', '35', CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING`
)
  .then(() => { 
    console.log('✓ Migration completed'); 
    pool.end(); 
  })
  .catch(err => { 
    console.error('✗ Migration failed:', err.message); 
    pool.end(); 
    process.exit(1); 
  });
