const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Creating test users with known credentials ===\n');
    
    const testPassword = 'Test123456!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    // Create or update test farmer
    const farmerResult = await pool.query(`
      INSERT INTO users (email, username, full_name, password, role, is_verified)
      VALUES ($1, $2, $3, $4, $5, false)
      ON CONFLICT (email) 
      DO UPDATE SET password = $4, username = $2, full_name = $3
      RETURNING id, email, username
    `, ['testfarmer@test.com', 'testfarmer', 'Test Farmer', hashedPassword, 'farmer']);
    
    console.log('✓ Test farmer created/updated:');
    console.log(`  Email: testfarmer@test.com`);
    console.log(`  Username: testfarmer`);
    console.log(`  Password: ${testPassword}`);
    console.log(`  ID: ${farmerResult.rows[0].id}`);
    
    // Create or update test admin
    const adminResult = await pool.query(`
      INSERT INTO users (email, username, full_name, password, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) 
      DO UPDATE SET password = $4, username = $2, full_name = $3, role = $5
      RETURNING id, email, username, role
    `, ['testadmin@test.com', 'testadmin', 'Test Admin', hashedPassword, 'admin']);
    
    console.log('\n✓ Test admin created/updated:');
    console.log(`  Email: testadmin@test.com`);
    console.log(`  Username: testadmin`);
    console.log(`  Password: ${testPassword}`);
    console.log(`  Role: ${adminResult.rows[0].role}`);
    console.log(`  ID: ${adminResult.rows[0].id}`);
    
    console.log('\n=== Test users ready ===');
    
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
