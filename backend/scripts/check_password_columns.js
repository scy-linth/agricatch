require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async function(){
  try{
    // Check what password columns exist in users table
    const columnRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND (column_name LIKE '%password%' OR column_name = 'password' OR column_name = 'password_hash')
      ORDER BY ordinal_position
    `);
    
    console.log('Password-related columns in users table:');
    for (const col of columnRes.rows) {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    }
    
    // Check if password_hash column exists
    const hasPasswordHash = columnRes.rows.some(col => col.column_name === 'password_hash');
    const hasPassword = columnRes.rows.some(col => col.column_name === 'password');
    
    console.log('');
    console.log('Has password column:', hasPassword);
    console.log('Has password_hash column:', hasPasswordHash);
    
    await pool.end();
  }catch(e){
    console.error('ERROR', e.message || e);
    process.exit(2);
  }
})();
