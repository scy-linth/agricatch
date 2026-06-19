// Subscription Implementation Validation Script
// Checks for common issues without running the full server

const fs = require('fs');
const path = require('path');

console.log('=== Subscription Implementation Validation ===\n');

// Check 1: Verify migration file exists
const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_farmer_subscriptions.sql');
if (fs.existsSync(migrationPath)) {
  console.log('✓ Migration file exists');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  if (migrationContent.includes('farmer_subscriptions') && migrationContent.includes('payment_accounts')) {
    console.log('✓ Migration contains required tables');
  } else {
    console.log('✗ Migration missing required tables');
  }
} else {
  console.log('✗ Migration file missing');
}

// Check 2: Verify backend routes exist
const routesToCheck = [
  { file: 'backend/routes/subscriptions.js', routes: ['/settings', '/farmers/me/subscription', '/farmers/me/subscription/request'] },
  { file: 'backend/routes/payment-accounts.js', routes: ['/payment-accounts'] },
  { file: 'backend/routes/admin.js', routes: ['/subscriptions', '/subscriptions/:id/approve', '/subscriptions/:id/reject'] }
];

routesToCheck.forEach(({ file, routes }) => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\n✓ ${file} exists`);
    routes.forEach(route => {
      if (content.includes(route)) {
        console.log(`  ✓ Route ${route} found`);
      } else {
        console.log(`  ✗ Route ${route} missing`);
      }
    });
  } else {
    console.log(`\n✗ ${file} missing`);
  }
});

// Check 3: Verify Cloudinary helper
const cloudinaryPath = path.join(__dirname, '..', 'backend/utils/cloudinary.js');
if (fs.existsSync(cloudinaryPath)) {
  const cloudinaryContent = fs.readFileSync(cloudinaryPath, 'utf8');
  if (cloudinaryContent.includes('publicIdForPaymentProof')) {
    console.log('\n✓ Cloudinary helper for payment proofs exists');
  } else {
    console.log('\n✗ Cloudinary helper for payment proofs missing');
  }
} else {
  console.log('\n✗ Cloudinary utils file missing');
}

// Check 4: Verify frontend HTML elements
const farmerHtmlPath = path.join(__dirname, '..', 'frontend/farmer.html');
if (fs.existsSync(farmerHtmlPath)) {
  const htmlContent = fs.readFileSync(farmerHtmlPath, 'utf8');
  const requiredIds = [
    'subscription',
    'subscription-free-panel',
    'subscription-active-panel',
    'subscription-pending-panel',
    'subscription-expired-panel',
    'subscription-modal',
    'btn-upgrade-premium',
    'btn-submit-subscription'
  ];
  console.log('\n✓ farmer.html exists');
  requiredIds.forEach(id => {
    if (htmlContent.includes(`id="${id}"`)) {
      console.log(`  ✓ Element ${id} found`);
    } else {
      console.log(`  ✗ Element ${id} missing`);
    }
  });
} else {
  console.log('\n✗ farmer.html missing');
}

// Check 5: Verify frontend JS methods
const farmerJsPath = path.join(__dirname, '..', 'frontend/js/farmer.js');
if (fs.existsSync(farmerJsPath)) {
  const jsContent = fs.readFileSync(farmerJsPath, 'utf8');
  const requiredMethods = [
    'loadSubscription',
    'updateSubscriptionUI',
    'updatePremiumBadge',
    'updateAddProductButton',
    'openSubscriptionModal',
    'submitSubscriptionRequest'
  ];
  console.log('\n✓ farmer.js exists');
  requiredMethods.forEach(method => {
    if (jsContent.includes(method)) {
      console.log(`  ✓ Method ${method} found`);
    } else {
      console.log(`  ✗ Method ${method} missing`);
    }
  });
} else {
  console.log('\n✗ farmer.js missing');
}

// Check 6: Verify admin HTML elements
const adminHtmlPath = path.join(__dirname, '..', 'frontend/admin.html');
if (fs.existsSync(adminHtmlPath)) {
  const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');
  const adminRequiredIds = [
    'subscription-requests',
    'subscriptions-table',
    'subscription-proof-modal',
    'payment-accounts-list',
    'btn-add-payment-account'
  ];
  console.log('\n✓ admin.html exists');
  adminRequiredIds.forEach(id => {
    if (adminHtmlContent.includes(`id="${id}"`)) {
      console.log(`  ✓ Element ${id} found`);
    } else {
      console.log(`  ✗ Element ${id} missing`);
    }
  });
} else {
  console.log('\n✗ admin.html missing');
}

// Check 7: Verify admin JS methods
const adminJsPath = path.join(__dirname, '..', 'frontend/js/admin.js');
if (fs.existsSync(adminJsPath)) {
  const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
  const adminRequiredMethods = [
    'loadSubscriptionRequests',
    'loadSubscriptionBadgeCount',
    'loadPaymentAccounts',
    'addPaymentAccount',
    'saveSubscriptionSettings'
  ];
  console.log('\n✓ admin.js exists');
  adminRequiredMethods.forEach(method => {
    if (adminJsContent.includes(method)) {
      console.log(`  ✓ Method ${method} found`);
    } else {
      console.log(`  ✗ Method ${method} missing`);
    }
  });
} else {
  console.log('\n✗ admin.js missing');
}

// Check 8: Verify server route registration
const serverPath = path.join(__dirname, '..', 'backend/server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  console.log('\n✓ server.js exists');
  if (serverContent.includes("app.use('/api/subscriptions'")) {
    console.log('  ✓ Subscriptions route registered');
  } else {
    console.log('  ✗ Subscriptions route not registered');
  }
  if (serverContent.includes("app.use('/api/admin'") && serverContent.includes("require('./routes/payment-accounts')")) {
    console.log('  ✓ Payment accounts route registered');
  } else {
    console.log('  ✗ Payment accounts route not registered');
  }
} else {
  console.log('\n✗ server.js missing');
}

console.log('\n=== Validation Complete ===');
