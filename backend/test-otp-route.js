/**
 * Quick test to verify OTP route is accessible
 * Run: node test-otp-route.js
 */

const http = require('http');

const testData = JSON.stringify({
  email: 'test@example.com',
  purpose: 'register'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/otp/send',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('Testing OTP route...');
console.log('POST http://localhost:3000/api/otp/send');

const req = http.request(options, (res) => {
  console.log(`\nStatus Code: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
    
    if (res.statusCode === 404) {
      console.log('\n❌ Route not found! Server needs to be restarted.');
      console.log('Please restart your server:');
      console.log('  1. Stop the current server (Ctrl+C)');
      console.log('  2. Run: cd backend && node server.js');
    } else if (res.statusCode === 200 || res.statusCode === 400) {
      console.log('\n✅ Route is working! (400 is expected for test email)');
    }
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Request failed: ${e.message}`);
  console.log('Make sure the server is running on port 3000');
});

req.write(testData);
req.end();
