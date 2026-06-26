// Check if wake-up ping flag exists
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('render') 
    ? { rejectUnauthorized: false } 
    : false
});

async function checkFlag() {
  try {
    const result = await pool.query(
      'SELECT key, name, description, enabled FROM feature_flags WHERE key = $1',
      ['enable_wake_up_ping']
    );
    
    if (result.rows.length > 0) {
      console.log('✓ Feature flag found:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('✗ Feature flag not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFlag();
