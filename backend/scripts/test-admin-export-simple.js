const http = require('http');

async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : body;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function main() {
  console.log('Testing admin export endpoint...\n');
  
  // Login as admin
  console.log('1. Logging in as admin...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'admin',
    password: 'adminadmin'
  });
  
  console.log('Login status:', loginResponse.status);
  if (loginResponse.status !== 200) {
    console.log('Login failed:', loginResponse.data);
    return;
  }
  
  const token = loginResponse.data.token;
  console.log('Login successful, token obtained');
  
  // Test admin export
  console.log('\n2. Testing admin export endpoint...');
  const exportResponse = await makeRequest('GET', '/api/admin/dashboard/export.xlsx?period=month', null, token);
  
  console.log('Export status:', exportResponse.status);
  console.log('Content-Type:', exportResponse.headers['content-type']);
  console.log('Content-Disposition:', exportResponse.headers['content-disposition']);
  
  if (exportResponse.status === 200) {
    console.log('File size:', exportResponse.data.length, 'bytes');
    console.log('✓ PASS: Admin export successful');
  } else {
    console.log('✗ FAIL: Admin export failed');
    console.log('Response (first 500 chars):', exportResponse.data.substring(0, 500));
  }
}

main().catch(console.error);
