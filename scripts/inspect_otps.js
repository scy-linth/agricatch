(async function(){
  try{
    const path = require('path');
    const db = require(path.join(__dirname,'..','backend','utils','db'));
    const pool = db.pool;
    const email = process.argv[2] || 'local-register-test@example.com';
    const res = await pool.query('SELECT id,email,otp_code,purpose,is_used,created_at,expires_at,attempts FROM otps WHERE email=$1 ORDER BY created_at DESC LIMIT 10',[email]);
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  }catch(e){
    console.error('ERROR', e);
    process.exit(1);
  }
})();