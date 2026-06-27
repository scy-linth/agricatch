require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    const res = await pool.query(
      `SELECT id, username, email, password, password_hash, role FROM users WHERE email = $1 OR username = $2`,
      ['testadmin@test.com', 'testadmin']
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      console.log('Username:', row.username);
      console.log('Email:', row.email);
      console.log('Role:', row.role);
      console.log('Password (plaintext):', row.password);
      console.log('Password hash:', row.password_hash);
      console.log('Is plaintext:', !row.password_hash || row.password_hash === row.password ? 'YES' : 'NO');
    } else {
      console.log('Account not found');
    }

    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
