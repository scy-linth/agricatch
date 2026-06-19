const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Testing /api/auth/profile endpoint dependencies ===\n');
    
    // Test 1: Database connection
    console.log('Test 1: Database connection');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✓ Database connected:', connTest.rows[0].now);
    
    // Test 2: Check users table exists
    console.log('\nTest 2: Check users table exists');
    const tableTest = await pool.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'users'`
    );
    console.log('✓ Users table exists:', tableTest.rows.length > 0);
    
    // Test 3: Get user columns (same as getUserColumns)
    console.log('\nTest 3: Get user columns');
    const columnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'users'`
    );
    const columns = new Set(columnsResult.rows.map(row => row.column_name));
    console.log('✓ Columns found:', Array.from(columns).length);
    console.log('Columns:', Array.from(columns).sort());
    
    // Test 4: Test a sample query
    console.log('\nTest 4: Test sample user query');
    const sampleQuery = await pool.query(
      `SELECT id, username, email, full_name, role, created_at FROM users LIMIT 1`
    );
    console.log('✓ Sample query successful, rows:', sampleQuery.rows.length);
    
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
