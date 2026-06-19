const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Testing /api/auth/profile with actual token ===\n');
    
    // Get a test user
    const userResult = await pool.query(
      `SELECT id, email, username, role FROM users WHERE role = 'super_admin' LIMIT 1`
    );
    
    if (userResult.rows.length === 0) {
      console.log('No super_admin user found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Test user:', user);
    
    // Generate a token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('Token generated (first 50 chars):', token.substring(0, 50) + '...');
    
    // Test the profile endpoint logic directly
    console.log('\n--- Testing profile endpoint logic ---');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✓ Token verified:', decoded);
    
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'users'`
    );
    const columns = new Set(columnsResult.rows.map(row => row.column_name));
    console.log('✓ Columns retrieved:', columns.size);
    
    const selectFields = ['id', 'username', 'email', 'full_name', 'role', 'created_at'];
    ['first_name', 'middle_name', 'last_name', 'shop_name', 'phone', 'address', 
     'shop_description', 'shop_banner_url', 'shop_avatar_url', 'is_verified', 
     'is_disabled', 'disabled_reason'].forEach((field) => {
      if (columns.has(field)) selectFields.push(field);
    });
    console.log('✓ Select fields:', selectFields);
    
    const result = await pool.query(
      `SELECT ${selectFields.join(', ')} FROM users WHERE id = $1`,
      [decoded.id]
    );
    console.log('✓ Query successful, rows:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('✓ User found:', result.rows[0].username);
    }
    
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
