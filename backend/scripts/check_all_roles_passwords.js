require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    const testAccounts = [
      { email: 'testadmin@test.com', username: 'testadmin', role: 'admin' },
      { email: 'testfarmer@test.com', username: 'testfarmer', role: 'farmer' },
      { email: 'testcustomer@test.com', username: 'testcustomer', role: 'customer' },
      { email: 'scy@linth', username: 'scy_linth', role: 'super_admin' }
    ];

    console.log('Checking all test account passwords:');
    console.log('');

    for (const account of testAccounts) {
      const res = await pool.query(
        `SELECT id, username, email, password, password_hash, role FROM users WHERE email = $1 OR username = $2`,
        [account.email, account.username]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        console.log(`=== ${row.role.toUpperCase()} ===`);
        console.log(`Username: ${row.username}`);
        console.log(`Email: ${row.email}`);
        console.log(`Password (plaintext): ${row.password}`);
        console.log(`Password hash: ${row.password_hash}`);
        console.log(`Is plaintext: ${!row.password_hash || row.password_hash === row.password ? 'YES' : 'NO'}`);
        console.log('');
      } else {
        console.log(`Account not found: ${account.username}`);
        console.log('');
      }
    }

    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
