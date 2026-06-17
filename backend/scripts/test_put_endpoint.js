// Test the PUT endpoint for product 23
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/products/23',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsInVzZXJuYW1lIjoidGhlcmVzc2EiLCJyb2xlIjoiZmFybWVyIiwiaWF0IjoxNzE4NTU2MDAwLCJleHAiOjE3MTg2NDI0MDB9.test' // Replace with actual token
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

// Test with minimal data
req.write(JSON.stringify({
  name: 'Pakwan',
  price: 100,
  stock_quantity: 50
}));

req.end();
