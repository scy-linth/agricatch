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
  console.log('Checking admin account role...\n');
  
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
  const user = loginResponse.data.user;
  console.log('Login successful');
  console.log('User data:', JSON.stringify(user, null, 2));
  
  // Test a simple admin endpoint
  console.log('\n2. Testing simple admin endpoint /api/admin/stats...');
  const statsResponse = await makeRequest('GET', '/api/admin/stats', null, token);
  
  console.log('Stats status:', statsResponse.status);
  if (statsResponse.status === 200) {
    console.log('✓ Admin authentication works');
    console.log('Stats data:', JSON.stringify(statsResponse.data, null, 2));
  } else {
    console.log('✗ Admin authentication failed');
    console.log('Response:', statsResponse.data);
  }
}

main().catch(console.error);
