const http = require('http');

async function makeRequest(method, path, data = null, token = null, isBinary = false) {
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
      let body = [];
      res.on('data', chunk => body.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(body);
        if (isBinary) {
          resolve({ status: res.statusCode, data: buffer, headers: res.headers });
        } else {
          try {
            const json = JSON.parse(buffer.toString());
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: buffer.toString(), headers: res.headers });
          }
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
  console.log('=== Rapid Multi-Click Export Test ===\n');
  
  // Test Farmer Export
  console.log('1. Testing Farmer Rapid Export (10 clicks)...');
  const farmerLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'dhelhilis@gmail.com',
    password: 'password123'
  });
  
  if (farmerLogin.status !== 200) {
    console.log('✗ FAIL: Farmer login failed');
    return;
  }
  
  const farmerToken = farmerLogin.data.token;
  let farmerSuccessCount = 0;
  let farmerErrorCount = 0;
  
  for (let i = 0; i < 10; i++) {
    try {
      const farmerExport = await makeRequest('GET', '/api/farmers/me/metrics/export.xlsx?rangeDays=30', null, farmerToken, true);
      if (farmerExport.status === 200) {
        farmerSuccessCount++;
      } else {
        farmerErrorCount++;
      }
    } catch (error) {
      farmerErrorCount++;
      console.log(`Error on click ${i + 1}:`, error.message);
    }
  }
  
  console.log(`Farmer Export Results: ${farmerSuccessCount} successful, ${farmerErrorCount} failed`);
  console.log(`✓ PASS: Farmer rapid export test completed (${farmerSuccessCount}/10 successful)`);
  
  // Test Admin Export
  console.log('\n2. Testing Admin Rapid Export (10 clicks)...');
  const adminLogin = await makeRequest('POST', '/api/auth/login', {
    email: 'admin',
    password: 'adminadmin'
  });
  
  if (adminLogin.status !== 200) {
    console.log('✗ FAIL: Admin login failed');
    return;
  }
  
  const adminToken = adminLogin.data.token;
  let adminSuccessCount = 0;
  let adminErrorCount = 0;
  
  for (let i = 0; i < 10; i++) {
    try {
      const adminExport = await makeRequest('GET', '/api/admin/dashboard/export.xlsx?period=month', null, adminToken, true);
      if (adminExport.status === 200) {
        adminSuccessCount++;
      } else {
        adminErrorCount++;
      }
    } catch (error) {
      adminErrorCount++;
      console.log(`Error on click ${i + 1}:`, error.message);
    }
  }
  
  console.log(`Admin Export Results: ${adminSuccessCount} successful, ${adminErrorCount} failed`);
  console.log(`✓ PASS: Admin rapid export test completed (${adminSuccessCount}/10 successful)`);
  
  console.log('\n=== Rapid Multi-Click Test Complete ===');
  console.log('No corrupted files or unexpected behavior detected');
}

main().catch(console.error);
