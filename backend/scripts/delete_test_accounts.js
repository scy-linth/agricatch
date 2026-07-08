const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function deleteTestAccounts() {
  try {
    console.log('Deleting test accounts...');

    const customerEmail = 'testcustomer123@example.com';
    const farmerEmail = 'testfarmer123@example.com';

    // Delete customer
    const customerResult = await pool.query(
      'DELETE FROM users WHERE email = $1 RETURNING id',
      [customerEmail]
    );
    if (customerResult.rows.length > 0) {
      console.log('✓ Test customer deleted:', customerEmail, '(ID:', customerResult.rows[0].id + ')');
    } else {
      console.log('✓ Test customer not found:', customerEmail);
    }

    // Delete farmer
    const farmerResult = await pool.query(
      'DELETE FROM users WHERE email = $1 RETURNING id',
      [farmerEmail]
    );
    if (farmerResult.rows.length > 0) {
      console.log('✓ Test farmer deleted:', farmerEmail, '(ID:', farmerResult.rows[0].id + ')');
    } else {
      console.log('✓ Test farmer not found:', farmerEmail);
    }

    console.log('\nTest accounts deleted successfully.');

  } catch (error) {
    console.error('Error deleting test accounts:', error);
  } finally {
    await pool.end();
  }
}

deleteTestAccounts();
