const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function checkAdminPassword() {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role, password FROM users WHERE username = $1',
      ['admin']
    );

    if (result.rows.length === 0) {
      console.log('❌ Admin account not found');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Admin account found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password Hash: ${user.password}`);
    
    // Check if it's plaintext or hashed
    if (user.password.length < 50) {
      console.log(`   ⚠️  Password appears to be PLAINTEXT: "${user.password}"`);
    } else {
      console.log(`   Password is hashed (bcrypt)`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminPassword();
