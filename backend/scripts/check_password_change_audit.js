require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    // Check audit logs for password changes for scy_linth
    const auditRes = await pool.query(`
      SELECT action, entity, entity_id, after, created_at 
      FROM admin_audit_logs 
      WHERE entity = 'users' 
      AND (action = 'password.changed' OR action = 'password_reset.completed')
      AND entity_id = 5
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${auditRes.rows.length} password-related audit logs for user ID 5 (scy_linth):`);
    console.log('');
    
    for (const row of auditRes.rows) {
      console.log(`Action: ${row.action}`);
      console.log(`Time: ${row.created_at}`);
      console.log(`Details:`, row.after);
      console.log('---');
    }
    
    // Check current password state
    const userRes = await pool.query(`
      SELECT id, username, email, password, password_hash, updated_at 
      FROM users 
      WHERE id = 5
    `);
    
    if (userRes.rows.length > 0) {
      console.log('\nCurrent password state:');
      console.log('Username:', userRes.rows[0].username);
      console.log('Email:', userRes.rows[0].email);
      console.log('Password (plaintext):', userRes.rows[0].password);
      console.log('Password hash:', userRes.rows[0].password_hash ? userRes.rows[0].password_hash.substring(0, 30) + '...' : 'NULL');
      console.log('Last updated:', userRes.rows[0].updated_at);
    }
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
