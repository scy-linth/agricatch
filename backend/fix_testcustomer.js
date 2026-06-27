const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixTestAccounts() {
  try {
    console.log('Connecting to database...');
    const bcrypt = require('bcryptjs');
    
    // Fix testcustomer
    console.log('\n--- Fixing testcustomer ---');
    const customerCheck = await pool.query(
      'SELECT id, email, username FROM users WHERE username = $1 OR email = $2',
      ['testcustomer', 'testcustomer@test.com']
    );
    
    if (customerCheck.rows.length > 0) {
      console.log('testcustomer found with ID:', customerCheck.rows[0].id);
      const hashedPassword = await bcrypt.hash('Test123456', 10);
      await pool.query(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, 'testcustomer']
      );
      console.log('✓ Updated testcustomer password to Test123456');
    }
    
    // Fix testadmin
    console.log('\n--- Fixing testadmin ---');
    const adminCheck = await pool.query(
      'SELECT id, email, username FROM users WHERE username = $1 OR email = $2',
      ['testadmin', 'testadmin@test.com']
    );
    
    if (adminCheck.rows.length > 0) {
      console.log('testadmin found with ID:', adminCheck.rows[0].id);
      const hashedPassword = await bcrypt.hash('Test123456', 10);
      await pool.query(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, 'testadmin']
      );
      console.log('✓ Updated testadmin password to Test123456');
    }
    
    console.log('\n✓ Test accounts password reset complete!');
    console.log('testcustomer@test.com / testcustomer / Test123456');
    console.log('testadmin@test.com / testadmin / Test123456');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixTestAccounts();
