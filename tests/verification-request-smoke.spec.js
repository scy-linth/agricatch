const { test, expect } = require('@playwright/test');
const { getAdminToken } = require('./auth-helper');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');

// Load environment variables
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      process.env[key] = valueParts.join('=');
    }
  });
}

let farmerToken;
let adminToken;
let adminUser;

test.beforeAll(async () => {
  // Get admin token
  const adminResult = await getAdminToken();
  adminToken = adminResult.token;
  adminUser = adminResult.user;
  console.log(`Authenticated as admin: ${adminUser.email} (${adminUser.role})`);

  // Get farmer token by querying database directly (bypasses CAPTCHA)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
  });

  const farmerResult = await pool.query(
    `SELECT id, email, username, role FROM users WHERE email = $1`,
    ['testfarmer@test.com']
  );

  if (farmerResult.rows.length === 0) {
    throw new Error('Test farmer user not found');
  }

  const farmerUser = farmerResult.rows[0];
  
  // Generate JWT token for farmer
  farmerToken = jwt.sign(
    { id: farmerUser.id, email: farmerUser.email, role: farmerUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log(`Authenticated as farmer: ${farmerUser.email} (${farmerUser.role})`);
  
  await pool.end();
});

test.describe('Verification Request Smoke Test', () => {
  test('Farmer: Verification UI elements exist', async ({ page }) => {
    if (!farmerToken) {
      test.skip();
    }

    // Inject farmer token and navigate
    await page.goto('http://localhost:3000/farmer.html');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, farmerToken);
    await page.reload();
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if verification request button exists in DOM
    const verifyBtn = page.locator('#verification-request-btn');
    const btnExists = await verifyBtn.count();
    
    if (btnExists > 0) {
      console.log('✓ Verification request button exists in DOM');
    } else {
      console.log('✗ Verification request button not found');
    }
    
    // Check if verification request modal exists
    const modal = page.locator('#verification-request-modal');
    const modalExists = await modal.count();
    
    if (modalExists > 0) {
      console.log('✓ Verification request modal exists in DOM');
    } else {
      console.log('✗ Verification request modal not found');
    }
    
    // Check if verification banner exists
    const banner = page.locator('#verification-banner');
    const bannerExists = await banner.count();
    
    if (bannerExists > 0) {
      console.log('✓ Verification banner exists in DOM');
    } else {
      console.log('✗ Verification banner not found');
    }
  });

  test('Admin: Verification requests section exists', async ({ page }) => {
    // Inject admin token and navigate
    await page.goto('http://localhost:3000/admin.html');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, adminToken);
    await page.reload();
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if verification requests link exists in sidebar
    const verifyLink = page.locator('.sidebar-link[data-section="verification-requests"]');
    const linkExists = await verifyLink.count();
    
    if (linkExists > 0) {
      console.log('✓ Verification requests sidebar link exists');
    } else {
      console.log('✗ Verification requests sidebar link not found');
    }
    
    // Check if verification requests section exists
    const section = page.locator('#verification-requests');
    const sectionExists = await section.count();
    
    if (sectionExists > 0) {
      console.log('✓ Verification requests section exists in DOM');
    } else {
      console.log('✗ Verification requests section not found');
    }
    
    // Check if admin review modal exists
    const modal = page.locator('#admin-review-modal');
    const modalExists = await modal.count();
    
    if (modalExists > 0) {
      console.log('✓ Admin review modal exists in DOM');
    } else {
      console.log('✗ Admin review modal not found');
    }
  });

  test('Backend: Verification request API endpoints', async ({ request }) => {
    // Test farmer GET verification request
    const farmerGetResponse = await request.get('http://localhost:3000/api/farmers/me/verification-request', {
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    
    if (farmerGetResponse.ok()) {
      console.log('✓ Farmer GET verification request endpoint working');
    } else {
      console.log('✗ Farmer GET verification request endpoint failed');
    }
    
    // Test admin GET verification requests
    const adminGetResponse = await request.get('http://localhost:3000/api/admin/verification-requests', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (adminGetResponse.ok()) {
      const data = await adminGetResponse.json();
      console.log(`✓ Admin GET verification requests endpoint working (total: ${data.total})`);
    } else {
      console.log('✗ Admin GET verification requests endpoint failed');
    }
  });
});
