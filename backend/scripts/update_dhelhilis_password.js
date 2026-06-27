require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    const res = await pool.query(
      `UPDATE users SET password = $1, password_hash = $1 WHERE email = $2 RETURNING id, username, email, password`,
      ['password123', 'dhelhilis@gmail.com']
    );
    
    if (res.rows.length > 0) {
      const row = res.rows[0];
      console.log(`Updated password for:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Username: ${row.username}`);
      console.log(`  Email: ${row.email}`);
      console.log(`  New password: ${row.password}`);
    } else {
      console.log('Account not found');
    }
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
