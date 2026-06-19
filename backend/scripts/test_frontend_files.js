const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..', '..');

async function testFarmerHTML() {
  console.log('=== Testing farmer.html ===\n');
  
  const farmerHtmlPath = path.join(projectRoot, 'frontend', 'farmer.html');
  if (fs.existsSync(farmerHtmlPath)) {
    console.log('✓ farmer.html exists');
    
    const content = fs.readFileSync(farmerHtmlPath, 'utf8');
    
    // Check for verification request modal
    if (content.includes('verification-request-modal')) {
      console.log('✓ verification-request-modal defined');
    } else {
      console.log('✗ verification-request-modal NOT found');
    }
    
    // Check for verification banner
    if (content.includes('verification-banner')) {
      console.log('✓ verification-banner defined');
    } else {
      console.log('✗ verification-banner NOT found');
    }
    
    // Check for verification request button
    if (content.includes('verification-request-btn')) {
      console.log('✓ verification-request-btn defined');
    } else {
      console.log('✗ verification-request-btn NOT found');
    }
    
    // Check for file input
    if (content.includes('verification-document')) {
      console.log('✓ verification-document input defined');
    } else {
      console.log('✗ verification-document input NOT found');
    }
    
    // Check for rejection modal
    if (content.includes('verification-rejection-modal')) {
      console.log('✓ verification-rejection-modal defined');
    } else {
      console.log('✗ verification-rejection-modal NOT found');
    }
    
  } else {
    console.log('✗ farmer.html NOT found');
  }
}

async function testFarmerJS() {
  console.log('\n=== Testing farmer.js ===\n');
  
  const farmerJsPath = path.join(projectRoot, 'frontend', 'js', 'farmer.js');
  if (fs.existsSync(farmerJsPath)) {
    console.log('✓ farmer.js exists');
    
    const content = fs.readFileSync(farmerJsPath, 'utf8');
    
    // Check for uploadToCloudinary function
    if (content.includes('uploadToCloudinary')) {
      console.log('✓ uploadToCloudinary function defined');
    } else {
      console.log('✗ uploadToCloudinary function NOT found');
    }
    
    // Check for openVerificationRequestModal
    if (content.includes('openVerificationRequestModal')) {
      console.log('✓ openVerificationRequestModal function defined');
    } else {
      console.log('✗ openVerificationRequestModal function NOT found');
    }
    
    // Check for handleVerificationRequest
    if (content.includes('handleVerificationRequest')) {
      console.log('✓ handleVerificationRequest function defined');
    } else {
      console.log('✗ handleVerificationRequest function NOT found');
    }
    
    // Check for loadVerificationStatus
    if (content.includes('loadVerificationStatus')) {
      console.log('✓ loadVerificationStatus function defined');
    } else {
      console.log('✗ loadVerificationStatus function NOT found');
    }
    
    // Check for upload endpoint call
    if (content.includes('/upload/verification-document')) {
      console.log('✓ upload endpoint called');
    } else {
      console.log('✗ upload endpoint NOT called');
    }
    
    // Check for verification request endpoint call
    if (content.includes('/farmers/me/verification-request')) {
      console.log('✓ verification request endpoint called');
    } else {
      console.log('✗ verification request endpoint NOT called');
    }
    
  } else {
    console.log('✗ farmer.js NOT found');
  }
}

async function testAdminHTML() {
  console.log('\n=== Testing admin.html ===\n');
  
  const adminHtmlPath = path.join(projectRoot, 'frontend', 'admin.html');
  if (fs.existsSync(adminHtmlPath)) {
    console.log('✓ admin.html exists');
    
    const content = fs.readFileSync(adminHtmlPath, 'utf8');
    
    // Check for verification requests section
    if (content.includes('verification-requests')) {
      console.log('✓ verification-requests section defined');
    } else {
      console.log('✗ verification-requests section NOT found');
    }
    
    // Check for admin review modal
    if (content.includes('admin-review-modal')) {
      console.log('✓ admin-review-modal defined');
    } else {
      console.log('✗ admin-review-modal NOT found');
    }
    
    // Check for verification requests table
    if (content.includes('verification-requests-table')) {
      console.log('✓ verification-requests-table defined');
    } else {
      console.log('✗ verification-requests-table NOT found');
    }
    
    // Check for sidebar link
    if (content.includes('Verification Requests')) {
      console.log('✓ Verification Requests sidebar link defined');
    } else {
      console.log('✗ Verification Requests sidebar link NOT found');
    }
    
  } else {
    console.log('✗ admin.html NOT found');
  }
}

async function testAdminJS() {
  console.log('\n=== Testing admin.js ===\n');
  
  const adminJsPath = path.join(projectRoot, 'frontend', 'js', 'admin.js');
  if (fs.existsSync(adminJsPath)) {
    console.log('✓ admin.js exists');
    
    const content = fs.readFileSync(adminJsPath, 'utf8');
    
    // Check for loadVerificationRequests
    if (content.includes('loadVerificationRequests')) {
      console.log('✓ loadVerificationRequests function defined');
    } else {
      console.log('✗ loadVerificationRequests function NOT found');
    }
    
    // Check for openReviewModal
    if (content.includes('openReviewModal')) {
      console.log('✓ openReviewModal function defined');
    } else {
      console.log('✗ openReviewModal function NOT found');
    }
    
    // Check for handleReviewAction
    if (content.includes('handleReviewAction')) {
      console.log('✓ handleReviewAction function defined');
    } else {
      console.log('✗ handleReviewAction function NOT found');
    }
    
    // Check for verification requests endpoint call
    if (content.includes('/admin/verification-requests')) {
      console.log('✓ verification requests endpoint called');
    } else {
      console.log('✗ verification requests endpoint NOT called');
    }
    
    // Check for review endpoint call
    if (content.includes('/verification-requests/') && content.includes('/review')) {
      console.log('✓ review endpoint called');
    } else {
      console.log('✗ review endpoint NOT called');
    }
    
  } else {
    console.log('✗ admin.js NOT found');
  }
}

async function runTests() {
  try {
    await testFarmerHTML();
    await testFarmerJS();
    await testAdminHTML();
    await testAdminJS();
    console.log('\n=== Frontend file configuration tests completed ===');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

runTests();
