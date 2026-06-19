const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Reproducing /api/auth/profile 500 error ===\n');
    
    // Get the token from localStorage simulation (same token as frontend)
    // First, get a super_admin user
    const userResult = await pool.query(
      `SELECT id, email, username, role FROM users WHERE role = 'super_admin' LIMIT 1`
    );
    
    if (userResult.rows.length === 0) {
      console.log('No super_admin user found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Test user:', user);
    
    // Generate a token (same as frontend would have)
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('Token generated (184 chars):', token.length === 184);
    console.log('Token preview:', token.substring(0, 50) + '...');
    
    // Simulate the exact request from admin.js
    console.log('\n--- Simulating /api/auth/profile request ---');
    
    // Test 1: Token verification
    console.log('\nTest 1: Token verification');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✓ Token verified:', decoded);
    } catch (e) {
      console.error('✗ Token verification failed:', e.message);
      return;
    }
    
    // Test 2: getUserColumns
    console.log('\nTest 2: getUserColumns');
    try {
      const columnsResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'users'`
      );
      const columns = new Set(columnsResult.rows.map(row => row.column_name));
      console.log('✓ Columns retrieved:', columns.size);
    } catch (e) {
      console.error('✗ getUserColumns failed:', e.message);
      return;
    }
    
    // Test 3: Build select fields
    console.log('\nTest 3: Build select fields');
    try {
      const columnsResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'users'`
      );
      const columns = new Set(columnsResult.rows.map(row => row.column_name));
      
      const selectFields = ['id', 'username', 'email', 'full_name', 'role', 'created_at'];
      ['first_name', 'middle_name', 'last_name', 'shop_name', 'phone', 'address', 
       'shop_description', 'shop_banner_url', 'shop_avatar_url', 'is_verified', 
       'is_disabled', 'disabled_reason'].forEach((field) => {
        if (columns.has(field)) selectFields.push(field);
      });
      console.log('✓ Select fields:', selectFields);
    } catch (e) {
      console.error('✗ Build select fields failed:', e.message);
      return;
    }
    
    // Test 4: Execute the query
    console.log('\nTest 4: Execute user query');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const columnsResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'users'`
      );
      const columns = new Set(columnsResult.rows.map(row => row.column_name));
      
      const selectFields = ['id', 'username', 'email', 'full_name', 'role', 'created_at'];
      ['first_name', 'middle_name', 'last_name', 'shop_name', 'phone', 'address', 
       'shop_description', 'shop_banner_url', 'shop_avatar_url', 'is_verified', 
       'is_disabled', 'disabled_reason'].forEach((field) => {
        if (columns.has(field)) selectFields.push(field);
      });
      
      const result = await pool.query(
        `SELECT ${selectFields.join(', ')} FROM users WHERE id = $1`,
        [decoded.id]
      );
      console.log('✓ Query successful, rows:', result.rows.length);
      if (result.rows.length > 0) {
        console.log('✓ User found:', result.rows[0].username);
      }
    } catch (e) {
      console.error('✗ Query failed:', e.message);
      console.error('Stack:', e.stack);
      return;
    }
    
    // Test 5: Full endpoint simulation via HTTP
    console.log('\nTest 5: Full HTTP request to /api/auth/profile');
    try {
      const response = await fetch('http://localhost:3000/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      const data = await response.json();
      console.log('Response data:', data);
    } catch (e) {
      console.error('✗ HTTP request failed:', e.message);
    }
    
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
