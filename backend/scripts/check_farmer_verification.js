const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Checking farmer verification status ===\n');
    
    const email = 'dhelhilis@gmail.com';
    
    // Get user info
    const userResult = await pool.query(
      `SELECT id, email, username, is_verified, role FROM users WHERE email = $1`,
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found:', email);
      return;
    }
    
    const user = userResult.rows[0];
    console.log('User info:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Is Verified: ${user.is_verified}`);
    
    // Check for existing verification requests
    const requestsResult = await pool.query(
      `SELECT id, status, document_url, notes, created_at, reviewed_at, rejection_reason 
       FROM verification_requests 
       WHERE farmer_id = $1 
       ORDER BY created_at DESC`,
      [user.id]
    );
    
    console.log('\nVerification requests:', requestsResult.rows.length);
    requestsResult.rows.forEach(req => {
      console.log(`  ID: ${req.id}, Status: ${req.status}, Document: ${req.document_url ? 'Yes' : 'No'}`);
      if (req.rejection_reason) {
        console.log(`    Rejection reason: ${req.rejection_reason}`);
      }
    });
    
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
