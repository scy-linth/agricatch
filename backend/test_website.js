const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Website Status: ${res.statusCode}`);
  console.log('Content-Type:', res.headers['content-type']);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (data.includes('AgriCatch') && data.includes('Freshly Caught')) {
      console.log('✅ Website loaded successfully with AgriCatch branding!');
    } else {
      console.log('❌ Website loaded but branding not found');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Website Error: ${e.message}`);
});

req.end();