const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Getting test user credentials ===\n');
    
    // Get farmers
    const farmers = await pool.query(`
      SELECT id, email, username, full_name, role 
      FROM users 
      WHERE role = 'farmer' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('Farmers:');
    farmers.rows.forEach(f => {
      console.log(`  Email: ${f.email}, Username: ${f.username}, ID: ${f.id}`);
    });
    
    // Get admins
    const admins = await pool.query(`
      SELECT id, email, username, full_name, role 
      FROM users 
      WHERE role IN ('admin', 'super_admin') 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\nAdmins:');
    admins.rows.forEach(a => {
      console.log(`  Email: ${a.email}, Username: ${a.username}, Role: ${a.role}, ID: ${a.id}`);
    });
    
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
