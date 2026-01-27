const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/products?limit=1',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();