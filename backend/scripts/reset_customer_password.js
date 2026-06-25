const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.cxqyqffnrmfowwaefbff',
  password: 'etitsmwa123'
});

async function resetPassword() {
  try {
    const email = 'customer_1782272106053@test.com';
    const newPassword = 'Test123!';
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email',
      [passwordHash, email]
    );
    
    if (result.rows.length > 0) {
      console.log(`✓ Password reset for ${email}`);
      console.log(`New password: ${newPassword}`);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

resetPassword();
