const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTestAccounts() {
  try {
    console.log('Creating test accounts...');

    // Test Customer
    const customerEmail = 'testcustomer123@example.com';
    const customerUsername = 'testcustomer123';
    const customerPassword = await bcrypt.hash('Test123!', 10);
    
    // Check if customer exists
    const customerCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [customerEmail]
    );

    let customerId;
    if (customerCheck.rows.length === 0) {
      const customerResult = await pool.query(
        `INSERT INTO users (email, username, password, role, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, 'customer', true, NOW(), NOW())
         RETURNING id`,
        [customerEmail, customerUsername, customerPassword]
      );
      customerId = customerResult.rows[0].id;
      console.log('✓ Test customer created:', customerEmail);
    } else {
      customerId = customerCheck.rows[0].id;
      console.log('✓ Test customer already exists:', customerEmail);
    }

    // Test Farmer
    const farmerEmail = 'testfarmer123@example.com';
    const farmerUsername = 'testfarmer123';
    const farmerPassword = await bcrypt.hash('Test123!', 10);
    
    // Check if farmer exists
    const farmerCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [farmerEmail]
    );

    let farmerId;
    if (farmerCheck.rows.length === 0) {
      const farmerResult = await pool.query(
        `INSERT INTO users (email, username, password, role, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, 'farmer', true, NOW(), NOW())
         RETURNING id`,
        [farmerEmail, farmerUsername, farmerPassword]
      );
      farmerId = farmerResult.rows[0].id;
      console.log('✓ Test farmer created:', farmerEmail);
    } else {
      farmerId = farmerCheck.rows[0].id;
      console.log('✓ Test farmer already exists:', farmerEmail);
    }

    console.log('\nTest accounts ready:');
    console.log('Customer:', customerEmail, 'Password: Test123!');
    console.log('Farmer:', farmerEmail, 'Password: Test123!');
    console.log('\nCustomer ID:', customerId);
    console.log('Farmer ID:', farmerId);

  } catch (error) {
    console.error('Error creating test accounts:', error);
  } finally {
    await pool.end();
  }
}

createTestAccounts();
