require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');
(async function(){
  try{
    const res = await pool.query("SELECT id, email, username, password, password_hash, encrypted_password FROM users WHERE email = $1 OR username = $2 LIMIT 1", ['scy@linth','scy_linth']);
    console.log(JSON.stringify(res.rows[0] || null, null, 2));
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }finally{
    await pool.end();
  }
})();
