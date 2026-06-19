const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

const API_BASE = 'http://localhost:3000/api';

// Test upload endpoint exists and is configured
async function testUploadEndpoint() {
  console.log('=== Testing Upload Endpoint Configuration ===\n');
  
  // Check if upload route file exists
  const uploadRoutePath = path.join(__dirname, '..', 'routes', 'upload.js');
  if (fs.existsSync(uploadRoutePath)) {
    console.log('✓ upload.js route file exists');
    
    const uploadContent = fs.readFileSync(uploadRoutePath, 'utf8');
    
    // Check for verification-document endpoint
    if (uploadContent.includes('/verification-document')) {
      console.log('✓ /verification-document endpoint defined');
    } else {
      console.log('✗ /verification-document endpoint NOT found');
    }
    
    // Check for multer configuration
    if (uploadContent.includes('verificationUpload')) {
      console.log('✓ verificationUpload middleware defined');
    } else {
      console.log('✗ verificationUpload middleware NOT found');
    }
    
    // Check for Cloudinary upload
    if (uploadContent.includes('publicIdForVerificationDocument')) {
      console.log('✓ Cloudinary publicIdForVerificationDocument called');
    } else {
      console.log('✗ Cloudinary publicIdForVerificationDocument NOT called');
    }
    
    // Check for overwrite setting
    if (uploadContent.includes('overwrite: true')) {
      console.log('✓ Cloudinary overwrite enabled');
    } else {
      console.log('✗ Cloudinary overwrite NOT enabled');
    }
    
  } else {
    console.log('✗ upload.js route file NOT found');
  }
}

// Test farmers route for verification request endpoint
async function testFarmersEndpoint() {
  console.log('\n=== Testing Farmers Endpoint Configuration ===\n');
  
  const farmersRoutePath = path.join(__dirname, '..', 'routes', 'farmers.js');
  if (fs.existsSync(farmersRoutePath)) {
    console.log('✓ farmers.js route file exists');
    
    const farmersContent = fs.readFileSync(farmersRoutePath, 'utf8');
    
    // Check for verification-request endpoint
    if (farmersContent.includes('/me/verification-request')) {
      console.log('✓ /me/verification-request endpoint defined');
    } else {
      console.log('✗ /me/verification-request endpoint NOT found');
    }
    
    // Check for document_url handling
    if (farmersContent.includes('document_url')) {
      console.log('✓ document_url field handled');
    } else {
      console.log('✗ document_url field NOT handled');
    }
    
    // Check for INSERT query with document_url
    if (farmersContent.includes('INSERT INTO verification_requests') && farmersContent.includes('document_url')) {
      console.log('✓ INSERT query includes document_url');
    } else {
      console.log('✗ INSERT query does NOT include document_url');
    }
    
  } else {
    console.log('✗ farmers.js route file NOT found');
  }
}

// Test admin route for verification requests endpoint
async function testAdminEndpoint() {
  console.log('\n=== Testing Admin Endpoint Configuration ===\n');
  
  const adminRoutePath = path.join(__dirname, '..', 'routes', 'admin.js');
  if (fs.existsSync(adminRoutePath)) {
    console.log('✓ admin.js route file exists');
    
    const adminContent = fs.readFileSync(adminRoutePath, 'utf8');
    
    // Check for verification-requests endpoint
    if (adminContent.includes('/verification-requests')) {
      console.log('✓ /verification-requests endpoint defined');
    } else {
      console.log('✗ /verification-requests endpoint NOT found');
    }
    
    // Check for document_url in SELECT (vr.* includes all columns)
    if (adminContent.includes('SELECT vr.*')) {
      console.log('✓ SELECT vr.* includes document_url (all columns)');
    } else if (adminContent.includes('document_url')) {
      console.log('✓ document_url field explicitly in queries');
    } else {
      console.log('✗ document_url field NOT in queries');
    }
    
  } else {
    console.log('✗ admin.js route file NOT found');
  }
}

async function runTests() {
  try {
    await testUploadEndpoint();
    await testFarmersEndpoint();
    await testAdminEndpoint();
    console.log('\n=== Backend endpoint configuration tests completed ===');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

runTests();
