const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const DOWNLOAD_DIR = path.join(__dirname, '../../test-downloads');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function makeRequest(method, path, data = null, token = null, binary = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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
      if (binary) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ status: res.statusCode, data: buffer, headers: res.headers });
        });
      } else {
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
      }
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testFarmerExport() {
  console.log('\n=== Testing Farmer Dashboard Export ===\n');
  
  // Login as premium farmer
  console.log('1. Logging in as premium farmer (dhelhilis@gmail.com)...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'dhelhilis@gmail.com',
    password: 'password123'
  });
  
  if (loginResponse.status !== 200) {
    console.log('✗ FAIL: Login failed');
    console.log('Response:', loginResponse.data);
    return;
  }
  
  console.log('✓ PASS: Login successful');
  const token = loginResponse.data.token;
  
  // Test export with different rangeDays
  const rangeDaysValues = ['7', '30', '90'];
  
  for (const rangeDays of rangeDaysValues) {
    console.log(`\n2. Testing export with rangeDays=${rangeDays}...`);
    const exportResponse = await makeRequest('GET', `/api/farmers/me/metrics/export.xlsx?rangeDays=${rangeDays}`, null, token, true);
    
    if (exportResponse.status === 200) {
      console.log(`✓ PASS: Export successful for rangeDays=${rangeDays}`);
      console.log(`  Content-Type: ${exportResponse.headers['content-type']}`);
      console.log(`  Content-Disposition: ${exportResponse.headers['content-disposition']}`);
      console.log(`  File size: ${exportResponse.data.length} bytes`);
      
      // Save the file
      const filename = `Farmer_Dashboard_Report_${rangeDays}days.xlsx`;
      const filepath = path.join(DOWNLOAD_DIR, filename);
      fs.writeFileSync(filepath, exportResponse.data);
      console.log(`  Saved to: ${filepath}`);
    } else {
      console.log(`✗ FAIL: Export failed for rangeDays=${rangeDays}`);
      console.log('Status:', exportResponse.status);
      console.log('Response:', exportResponse.data.toString());
    }
  }
  
  // Test unauthorized access
  console.log('\n3. Testing unauthorized access to farmer export endpoint...');
  const unauthorizedResponse = await makeRequest('GET', '/api/farmers/me/metrics/export.xlsx?rangeDays=30');
  
  if (unauthorizedResponse.status === 401) {
    console.log('✓ PASS: Unauthorized access returns 401');
  } else {
    console.log('✗ FAIL: Unauthorized access did not return 401');
    console.log('Response:', unauthorizedResponse.data);
  }
}

async function testAdminExport() {
  console.log('\n=== Testing Admin Dashboard Export ===\n');
  
  // Login as admin
  console.log('1. Logging in as admin...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'admin',
    password: 'adminadmin'
  });
  
  if (loginResponse.status !== 200) {
    console.log('✗ FAIL: Login failed');
    console.log('Response:', loginResponse.data);
    return;
  }
  
  console.log('✓ PASS: Login successful');
  const token = loginResponse.data.token;
  
  // Test export with different periods
  const periods = ['today', 'week', 'month', 'year', 'all'];
  
  for (const period of periods) {
    console.log(`\n2. Testing export with period=${period}...`);
    const exportResponse = await makeRequest('GET', `/api/admin/dashboard/export.xlsx?period=${period}`, null, token, true);
    
    if (exportResponse.status === 200) {
      console.log(`✓ PASS: Export successful for period=${period}`);
      console.log(`  Content-Type: ${exportResponse.headers['content-type']}`);
      console.log(`  Content-Disposition: ${exportResponse.headers['content-disposition']}`);
      console.log(`  File size: ${exportResponse.data.length} bytes`);
      
      // Save the file
      const filename = `Admin_Dashboard_Report_${period}.xlsx`;
      const filepath = path.join(DOWNLOAD_DIR, filename);
      fs.writeFileSync(filepath, exportResponse.data);
      console.log(`  Saved to: ${filepath}`);
    } else {
      console.log(`✗ FAIL: Export failed for period=${period}`);
      console.log('Response:', exportResponse.data);
    }
  }
  
  // Test unauthorized access
  console.log('\n3. Testing unauthorized access to admin export endpoint...');
  const unauthorizedResponse = await makeRequest('GET', '/api/admin/dashboard/export.xlsx?period=month');
  
  if (unauthorizedResponse.status === 401) {
    console.log('✓ PASS: Unauthorized access returns 401');
  } else {
    console.log('✗ FAIL: Unauthorized access did not return 401');
    console.log('Response:', unauthorizedResponse.data);
  }
}

async function main() {
  try {
    await testFarmerExport();
    await testAdminExport();
    console.log('\n=== All Tests Complete ===\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
