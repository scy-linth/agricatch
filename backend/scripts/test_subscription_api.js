require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');

// Use the token from the error message
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzgsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoic3RhZmYiLCJpYXQiOjE3ODE3NzY3MzksImV4cCI6MTc4MTg2MzEzOX0.sSguDwiNxAcmvcI7bIEfzjoTBCariazz4BJ__gSWq-c';

async function testEndpoint() {
  try {
    // Decode token to verify contents
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    // Test the endpoint
    const response = await fetch('http://localhost:3000/api/admin/subscriptions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Response status:', response.status);
    console.log('Response body:', await response.text());
  } catch (error) {
    console.error('Error:', error);
  }
}

testEndpoint();
