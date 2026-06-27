require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    // Clear password_hash for scy_linth to force plaintext only
    const res = await pool.query(`
      UPDATE users 
      SET password_hash = NULL 
      WHERE username = 'scy_linth' OR email = 'scy@linth'
      RETURNING id, username, email, password, password_hash
    `);
    
    if (res.rows.length > 0) {
      console.log('Cleared password_hash for user:');
      console.log('ID:', res.rows[0].id);
      console.log('Username:', res.rows[0].username);
      console.log('Email:', res.rows[0].email);
      console.log('Password (plaintext):', res.rows[0].password);
      console.log('Password hash:', res.rows[0].password_hash);
    } else {
      console.log('User not found');
    }
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
