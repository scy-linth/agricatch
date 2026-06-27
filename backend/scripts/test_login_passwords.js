require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');

(async function(){
  try{
    const identifier = 'scy@linth';
    const passwords = ['etitsmwa', 'etitsmwa123'];
    
    const q = await pool.query(
      `SELECT id, username, email, password, password_hash FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [identifier, identifier]
    );
    
    if (q.rows.length === 0) {
      console.log('User not found');
      return;
    }
    
    const user = q.rows[0];
    console.log('User found:', user.id, user.username, user.email);
    console.log('Plaintext password:', user.password);
    console.log('Bcrypt hash:', user.password_hash);
    console.log('');
    
    for (const pwd of passwords) {
      // Test bcrypt
      const hash = user.password_hash.startsWith('$2y$') ? `$2a$${user.password_hash.slice(4)}` : user.password_hash;
      const bcryptMatch = await bcrypt.compare(pwd, hash);
      
      // Test plaintext
      const plaintextMatch = user.password === pwd;
      
      console.log(`Password "${pwd}":`);
      console.log(`  - Bcrypt match: ${bcryptMatch ? 'YES ✓' : 'NO ✗'}`);
      console.log(`  - Plaintext match: ${plaintextMatch ? 'YES ✓' : 'NO ✗'}`);
      console.log('');
    }
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
