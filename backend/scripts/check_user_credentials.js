const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function checkUserCredentials() {
  const email = 'customer@gmail.com';
  const password = 'customercustomer';

  try {
    console.log(`Checking user: ${email}`);
    
    // Get user from database
    const result = await pool.query(
      'SELECT id, email, username, role, password FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      return;
    }

    const user = result.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);

    // Check if role is farmer
    if (user.role !== 'farmer') {
      console.log(`⚠️  Warning: User role is '${user.role}', not 'farmer'`);
    } else {
      console.log(`✅ User role is 'farmer'`);
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (isMatch) {
      console.log('✅ Password matches!');
    } else {
      console.log('❌ Password does NOT match');
      console.log(`   Expected password hash to match: "${password}"`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserCredentials();
