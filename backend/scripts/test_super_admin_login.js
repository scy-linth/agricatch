require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');

const data = JSON.stringify({
  email: 'scy@linth',
  password: 'etitsmwa123'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
