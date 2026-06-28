const http = require('http');

// Test Case 2: Product 51 is unavailable but has linked product 53 which is available
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/products/51/current-active',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test-token'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response: ${data}`);
    const parsed = JSON.parse(data);
    if (parsed.currentProductId === 53 && parsed.isOriginal === false) {
      console.log('✓ Case 2 PASSED: Returns linked available product (53)');
    } else {
      console.log('✗ Case 2 FAILED');
    }
  });
});

req.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

req.end();
