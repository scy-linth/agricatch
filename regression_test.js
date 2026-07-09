// AgriCatch Regression Test Script
// Tests dashboard functionality after recent fixes

// Node.js 18+ has built-in fetch

const BASE_URL = 'http://localhost:3001';
let ADMIN_TOKEN = '';
let FARMER_TOKEN = '';
let CUSTOMER_TOKEN = '';
let SUPERADMIN_TOKEN = '';

// Test credentials
const ADMIN_CREDS = { email: 'testadmin@test.com', password: 'NewPassword123' };
const FARMER_CREDS = { email: 'testfarmer@test.com', password: 'Test123456' };
const CUSTOMER_CREDS = { email: 'testcustomer@test.com', password: 'Test123456' };
const SUPERADMIN_CREDS = { email: 'scy@linth', password: 'etitsmwa' };

const results = {
  pass: [],
  fail: [],
  warn: [],
  info: []
};

function log(category, message, evidence = '') {
  results[category].push({ message, evidence });
  console.log(`[${category.toUpperCase()}] ${message}`);
  if (evidence) console.log(`  Evidence: ${evidence}`);
}

async function login(creds) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });
    const data = await response.json();
    if (data.token) {
      return data.token;
    }
    throw new Error(data.message || 'Login failed');
  } catch (error) {
    throw new Error(`Login error: ${error.message}`);
  }
}

async function testEndpoint(name, endpoint, method = 'GET', token = null, body = null, expectJson = true) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    if (response.ok) {
      if (expectJson) {
        const data = await response.json();
        log('pass', `${name} - ${endpoint}`, `Status: ${response.status}`);
        return { success: true, data };
      } else {
        // For file exports, just check status
        const contentType = response.headers.get('content-type');
        log('pass', `${name} - ${endpoint}`, `Status: ${response.status}, Content-Type: ${contentType}`);
        return { success: true };
      }
    } else {
      const data = await response.json();
      log('fail', `${name} - ${endpoint}`, `Status: ${response.status}, Error: ${data.message || JSON.stringify(data)}`);
      return { success: false, error: data.message };
    }
  } catch (error) {
    log('fail', `${name} - ${endpoint}`, `Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('=== AgriCatch Regression Test Suite ===\n');
  
  // 1. Authentication Tests
  console.log('\n--- Authentication Tests ---');
  try {
    ADMIN_TOKEN = await login(ADMIN_CREDS);
    log('pass', 'Admin login successful');
  } catch (error) {
    log('fail', 'Admin login failed', error.message);
  }
  
  try {
    FARMER_TOKEN = await login(FARMER_CREDS);
    log('pass', 'Farmer login successful');
  } catch (error) {
    log('fail', 'Farmer login failed', error.message);
  }
  
  try {
    CUSTOMER_TOKEN = await login(CUSTOMER_CREDS);
    log('pass', 'Customer login successful');
  } catch (error) {
    log('fail', 'Customer login failed', error.message);
  }
  
  try {
    SUPERADMIN_TOKEN = await login(SUPERADMIN_CREDS);
    log('pass', 'Superadmin login successful');
  } catch (error) {
    log('fail', 'Superadmin login failed', error.message);
  }
  
  // 2. Admin Dashboard Tests
  console.log('\n--- Admin Dashboard Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('Admin users list', '/api/admin/users', 'GET', ADMIN_TOKEN);
    await testEndpoint('Admin logs', '/api/admin/logs', 'GET', ADMIN_TOKEN);
    await testEndpoint('Admin orders', '/api/admin/orders', 'GET', ADMIN_TOKEN);
  }
  
  // 3. Super Admin Dashboard Tests
  console.log('\n--- Super Admin Dashboard Tests ---');
  if (SUPERADMIN_TOKEN) {
    await testEndpoint('Superadmin users list', '/api/admin/users', 'GET', SUPERADMIN_TOKEN);
    await testEndpoint('Superadmin logs', '/api/admin/logs', 'GET', SUPERADMIN_TOKEN);
  }
  
  // 4. Farmer Dashboard Tests
  console.log('\n--- Farmer Dashboard Tests ---');
  if (FARMER_TOKEN) {
    await testEndpoint('Farmer orders', '/api/orders/farmer/42', 'GET', FARMER_TOKEN);
    await testEndpoint('Farmer products', '/api/products', 'GET', FARMER_TOKEN);
  }
  
  // 5. Customer Dashboard Tests
  console.log('\n--- Customer Dashboard Tests ---');
  if (CUSTOMER_TOKEN) {
    await testEndpoint('Customer orders', '/api/orders', 'GET', CUSTOMER_TOKEN);
    await testEndpoint('Customer products', '/api/products', 'GET', CUSTOMER_TOKEN);
  }
  
  // 6. Analytics and Reports Tests
  console.log('\n--- Analytics and Reports Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('Admin orders with period filter', '/api/admin/orders?period=today', 'GET', ADMIN_TOKEN);
    await testEndpoint('Admin orders with pagination', '/api/admin/orders?page=1&limit=10', 'GET', ADMIN_TOKEN);
  }
  
  // 7. Notifications Tests
  console.log('\n--- Notifications Tests ---');
  if (FARMER_TOKEN) {
    await testEndpoint('Farmer notifications', '/api/notifications', 'GET', FARMER_TOKEN);
  }
  if (CUSTOMER_TOKEN) {
    await testEndpoint('Customer notifications', '/api/notifications', 'GET', CUSTOMER_TOKEN);
  }
  
  // 8. Orders and Order Management Tests
  console.log('\n--- Orders and Order Management Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('Admin orders list', '/api/admin/orders', 'GET', ADMIN_TOKEN);
  }
  if (FARMER_TOKEN) {
    await testEndpoint('Farmer orders with status filter', '/api/orders/farmer/42?status=pending', 'GET', FARMER_TOKEN);
  }
  
  // 9. Product Management Tests
  console.log('\n--- Product Management Tests ---');
  if (FARMER_TOKEN) {
    await testEndpoint('Farmer product categories', '/api/products/categories', 'GET', FARMER_TOKEN);
    await testEndpoint('Farmer product catalog', '/api/products/catalog/names', 'GET', FARMER_TOKEN);
  }
  
  // 10. Revenue and Sales Calculations Tests
  console.log('\n--- Revenue and Sales Calculations Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('Admin revenue data', '/api/admin/orders', 'GET', ADMIN_TOKEN);
  }
  
  // 11. Period Filtering Tests
  console.log('\n--- Period Filtering Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('Today filter', '/api/admin/orders?period=today', 'GET', ADMIN_TOKEN);
    await testEndpoint('Week filter', '/api/admin/orders?period=week', 'GET', ADMIN_TOKEN);
    await testEndpoint('Month filter', '/api/admin/orders?period=month', 'GET', ADMIN_TOKEN);
    await testEndpoint('Year filter', '/api/admin/orders?period=year', 'GET', ADMIN_TOKEN);
  }
  
  // 12. Pagination Tests
  console.log('\n--- Pagination Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('Page 1', '/api/admin/users?page=1&limit=10', 'GET', ADMIN_TOKEN);
    await testEndpoint('Page 2', '/api/admin/users?page=2&limit=10', 'GET', ADMIN_TOKEN);
  }
  
  // 13. Search Tests
  console.log('\n--- Search Tests ---');
  if (ADMIN_TOKEN) {
    await testEndpoint('User search', '/api/admin/users?search=test', 'GET', ADMIN_TOKEN);
  }
  if (FARMER_TOKEN) {
    await testEndpoint('Product search', '/api/products?search=talong', 'GET', FARMER_TOKEN);
  }
  
  // 14. Sorting Tests
  console.log('\n--- Sorting Tests ---');
  if (FARMER_TOKEN) {
    await testEndpoint('Sort by latest', '/api/products?sort=latest', 'GET', FARMER_TOKEN);
    await testEndpoint('Sort by price low to high', '/api/products?sort=price_low_high', 'GET', FARMER_TOKEN);
    await testEndpoint('Sort by price high to low', '/api/products?sort=price_high_low', 'GET', FARMER_TOKEN);
  }
  
  // 15. Excel/CSV Export Tests
  console.log('\n--- Excel/CSV Export Tests ---');
  if (FARMER_TOKEN) {
    await testEndpoint('Farmer CSV export', '/api/farmers/me/metrics/export.csv', 'GET', FARMER_TOKEN, null, false);
    await testEndpoint('Farmer Excel export', '/api/farmers/me/metrics/export.xlsx', 'GET', FARMER_TOKEN, null, false);
  }
  if (ADMIN_TOKEN) {
    await testEndpoint('Admin dashboard export', '/api/admin/dashboard/export.xlsx', 'GET', ADMIN_TOKEN, null, false);
  }
  
  // Print summary
  console.log('\n=== REGRESSION TEST SUMMARY ===');
  console.log(`PASS: ${results.pass.length}`);
  console.log(`FAIL: ${results.fail.length}`);
  console.log(`WARN: ${results.warn.length}`);
  console.log(`INFO: ${results.info.length}`);
  
  if (results.fail.length > 0) {
    console.log('\n=== FAILED TESTS ===');
    results.fail.forEach(f => console.log(`- ${f.message}: ${f.evidence}`));
  }
  
  return results;
}

// Run tests
runTests().then(results => {
  process.exit(results.fail.length > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
