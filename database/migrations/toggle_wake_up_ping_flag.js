// Toggle wake-up ping flag
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('render') 
    ? { rejectUnauthorized: false } 
    : false
});

async function toggleFlag() {
  const newState = process.argv[2] === 'false' ? false : true;
  
  try {
    const result = await pool.query(
      'UPDATE feature_flags SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2 RETURNING key, enabled',
      [newState, 'enable_wake_up_ping']
    );
    
    if (result.rows.length > 0) {
      console.log(`✓ Flag updated: ${result.rows[0].key} = ${result.rows[0].enabled}`);
    } else {
      console.log('✗ Flag not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

toggleFlag();
