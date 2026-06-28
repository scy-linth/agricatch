require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const res = await pool.query(
      'SELECT id, username, email, role, password, password_hash FROM users WHERE username = $1',
      ['scy_linth']
    );
    
    if (res.rows.length === 0) {
      console.log('User not found');
      await pool.end();
      return;
    }
    
    const user = res.rows[0];
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Username:', user.username);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Password column:', user.password ? user.password.substring(0, 30) + '...' : 'NULL');
    console.log('  Password_hash column:', user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'NULL');
    
    // Test password comparison
    const testPassword = 'etitsmwa123';
    console.log('\nTesting password:', testPassword);
    
    if (user.password && user.password.startsWith('$2')) {
      const match = await bcrypt.compare(testPassword, user.password);
      console.log('  Bcrypt compare on password column:', match);
    }
    
    if (user.password_hash && user.password_hash.startsWith('$2')) {
      const match = await bcrypt.compare(testPassword, user.password_hash);
      console.log('  Bcrypt compare on password_hash column:', match);
    }
    
    if (user.password && !user.password.startsWith('$2')) {
      const match = testPassword === user.password;
      console.log('  Plaintext compare on password column:', match);
    }
    
    if (user.password_hash && !user.password_hash.startsWith('$2')) {
      const match = testPassword === user.password_hash;
      console.log('  Plaintext compare on password_hash column:', match);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
})();
