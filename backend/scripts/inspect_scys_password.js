require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');
(async function(){
  try{
    const res = await pool.query("SELECT id, email, username, password, password_hash, is_debug_account FROM users WHERE email = $1 OR username = $2", ['scy@linth','scy_linth']);
    console.log(`Found ${res.rows.length} row(s)`);
    console.log(JSON.stringify(res.rows, null, 2));
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }finally{
    await pool.end();
  }
})();
