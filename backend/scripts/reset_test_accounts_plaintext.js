require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    const testAccounts = [
      { email: 'testadmin@test.com', username: 'testadmin', password: 'Test123456' },
      { email: 'testfarmer@test.com', username: 'testfarmer', password: 'Test123456' },
      { email: 'testcustomer@test.com', username: 'testcustomer', password: 'Test123456' }
    ];
    
    console.log('Resetting test accounts to plaintext passwords:');
    console.log('');
    
    for (const account of testAccounts) {
      const res = await pool.query(
        `UPDATE users 
         SET password = $1, password_hash = $1 
         WHERE email = $2 OR username = $3
         RETURNING id, username, email, password, password_hash, role`,
        [account.password, account.email, account.username]
      );
      
      if (res.rows.length > 0) {
        const row = res.rows[0];
        console.log(`✓ Reset ${row.username} (${row.role})`);
        console.log(`  Password: ${row.password}`);
        console.log(`  Password hash: ${row.password_hash}`);
        console.log('');
      } else {
        console.log(`✗ Account not found: ${account.username}`);
        console.log('');
      }
    }
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
