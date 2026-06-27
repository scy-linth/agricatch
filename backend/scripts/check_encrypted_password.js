require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    // Check encrypted_password values for all users
    const res = await pool.query(`
      SELECT id, username, email, password, encrypted_password, password_hash 
      FROM users 
      WHERE encrypted_password IS NOT NULL 
      ORDER BY id
      LIMIT 10
    `);
    
    console.log(`Found ${res.rows.length} users with encrypted_password:`);
    console.log('');
    
    for (const row of res.rows) {
      console.log(`ID: ${row.id}, Username: ${row.username}`);
      console.log(`  password: ${row.password}`);
      console.log(`  encrypted_password: ${row.encrypted_password ? row.encrypted_password.substring(0, 30) + '...' : 'NULL'}`);
      console.log(`  password_hash: ${row.password_hash ? row.password_hash.substring(0, 30) + '...' : 'NULL'}`);
      console.log('');
    }
    
    // Check specifically for scy_linth
    const scyRes = await pool.query(`
      SELECT id, username, email, password, encrypted_password, password_hash 
      FROM users 
      WHERE username = 'scy_linth' OR email = 'scy@linth'
    `);
    
    if (scyRes.rows.length > 0) {
      console.log('scy_linth specific data:');
      const row = scyRes.rows[0];
      console.log(`  password: ${row.password}`);
      console.log(`  encrypted_password: ${row.encrypted_password}`);
      console.log(`  password_hash: ${row.password_hash}`);
    }
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
