const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.cxqyqffnrmfowwaefbff',
  password: 'etitsmwa123'
});

async function findCustomer() {
  try {
    const result = await pool.query(
      'SELECT email, role, is_verified FROM users WHERE role = $1 AND is_verified = true LIMIT 5',
      ['customer']
    );
    
    console.log('Found customers:');
    result.rows.forEach(u => {
      console.log(`Email: ${u.email}, Role: ${u.role}, Verified: ${u.is_verified}`);
    });
    
    if (result.rows.length > 0) {
      console.log('\nUse this email for the test:', result.rows[0].email);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

findCustomer();
