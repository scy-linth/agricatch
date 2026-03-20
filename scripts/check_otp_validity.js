(async()=>{
  try{
    const path=require('path');
    const {pool}=require(path.join(__dirname,'..','backend','utils','db'));
    const email=process.argv[2]||'local-register-test@example.com';
    const res=await pool.query(`SELECT id,otp_code,created_at,expires_at,is_used FROM otps WHERE email=$1 AND purpose='register' AND is_used = true ORDER BY created_at DESC LIMIT 1`,[email]);
    console.log('row',res.rows[0]);
    if(!res.rows[0]){ console.log('no used otps'); process.exit(0);}    
    const r=res.rows[0];
    const now=new Date();
    const otpExpiresAt=new Date(r.expires_at);
    console.log('now',now.toISOString());
    console.log('expires',otpExpiresAt.toISOString());
    console.log('expires < now?', otpExpiresAt < now);
    await pool.end();
  }catch(e){console.error(e); process.exit(1);}  
})();