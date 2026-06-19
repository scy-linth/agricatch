const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

// Test with the exact token from browser
const browserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiZW1haWwiOiJzY3lAbGludGgiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3ODE2ODc3MDgsImV4cCI6MTc4MTY4NDEwOH0.8xxA_3p0njVrC2YTfCol0j9iylTqmLAhNrGgPDPXexw';

(async () => {
  try {
    console.log('=== Testing with browser token ===\n');
    console.log('Token length:', browserToken.length);
    console.log('Token preview:', browserToken.substring(0, 50) + '...');
    
    // Test 1: Verify token
    console.log('\nTest 1: Token verification');
    try {
      const decoded = jwt.verify(browserToken, process.env.JWT_SECRET);
      console.log('✓ Token verified:', decoded);
      console.log('Token exp:', new Date(decoded.exp * 1000).toISOString());
      console.log('Token iat:', new Date(decoded.iat * 1000).toISOString());
      console.log('Current time:', new Date().toISOString());
      console.log('Token expired:', Date.now() > decoded.exp * 1000);
    } catch (e) {
      console.error('✗ Token verification failed:', e.message);
      return;
    }
    
    // Test 2: HTTP request with browser token
    console.log('\nTest 2: HTTP request with browser token');
    try {
      const response = await fetch('http://localhost:3000/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${browserToken}`
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
