// Test script to verify rejection workflow implementation
// This checks that all necessary code is in place

const fs = require('fs');
const path = require('path');

console.log('=== Rejection Workflow Implementation Check ===\n');

// Check 1: Migration file exists
const migrationPath = path.join(__dirname, '../database/migrations/add_rejection_reason.sql');
if (fs.existsSync(migrationPath)) {
    console.log('✓ Migration file exists: add_rejection_reason.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    if (migrationContent.includes('rejection_reason') && migrationContent.includes('TEXT')) {
        console.log('✓ Migration adds rejection_reason TEXT column');
    } else {
        console.log('✗ Migration does not add rejection_reason column correctly');
    }
} else {
    console.log('✗ Migration file missing: add_rejection_reason.sql');
}

// Check 2: Backend reject endpoint
const adminJsPath = path.join(__dirname, '../backend/routes/admin.js');
if (fs.existsSync(adminJsPath)) {
    console.log('\n✓ Backend admin.js exists');
    const adminContent = fs.readFileSync(adminJsPath, 'utf8');
    if (adminContent.includes('rejection_reason') && adminContent.includes("req.body")) {
        console.log('✓ Reject endpoint accepts rejection_reason from body');
    } else {
        console.log('✗ Reject endpoint does not handle rejection_reason');
    }
    if (adminContent.includes('rejection_reason = $3')) {
        console.log('✓ Reject endpoint stores rejection_reason in database');
    } else {
        console.log('✗ Reject endpoint does not store rejection_reason');
    }
} else {
    console.log('\n✗ Backend admin.js missing');
}

// Check 3: Admin HTML modal
const adminHtmlPath = path.join(__dirname, '../frontend/admin.html');
if (fs.existsSync(adminHtmlPath)) {
    console.log('\n✓ Admin HTML exists');
    const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
    if (adminHtml.includes('reject-product-modal') && adminHtml.includes('rejection-reason')) {
        console.log('✓ Admin has rejection reason modal');
    } else {
        console.log('✗ Admin missing rejection reason modal');
    }
} else {
    console.log('\n✗ Admin HTML missing');
}

// Check 4: Admin JS modal logic
const adminFrontJsPath = path.join(__dirname, '../frontend/js/admin.js');
if (fs.existsSync(adminFrontJsPath)) {
    console.log('\n✓ Admin frontend JS exists');
    const adminJs = fs.readFileSync(adminFrontJsPath, 'utf8');
    if (adminJs.includes('rejectProduct') && adminJs.includes('confirmRejectProduct')) {
        console.log('✓ Admin has rejectProduct and confirmRejectProduct functions');
    } else {
        console.log('✗ Admin missing rejection modal functions');
    }
    if (adminJs.includes('reject-product-modal-close') && adminJs.includes('reject-product-confirm')) {
        console.log('✓ Admin has rejection modal event listeners');
    } else {
        console.log('✗ Admin missing rejection modal event listeners');
    }
    if (adminJs.includes('JSON.stringify({ rejection_reason')) {
        console.log('✓ Admin sends rejection_reason to backend');
    } else {
        console.log('✗ Admin does not send rejection_reason to backend');
    }
    // Check 5: Admin panel displays rejection reason
    if (adminJs.includes('rejection_reason') && adminJs.includes('product.status === \'rejected\'')) {
        console.log('✓ Admin panel displays rejection reason for rejected products');
    } else {
        console.log('✗ Admin panel does not display rejection reason');
    }
} else {
    console.log('\n✗ Admin frontend JS missing');
}

// Check 6: Farmer HTML modal
const farmerHtmlPath = path.join(__dirname, '../frontend/farmer.html');
if (fs.existsSync(farmerHtmlPath)) {
    console.log('\n✓ Farmer HTML exists');
    const farmerHtml = fs.readFileSync(farmerHtmlPath, 'utf8');
    if (farmerHtml.includes('rejection-reason-modal') && farmerHtml.includes('rejection-reason-text')) {
        console.log('✓ Farmer has rejection reason modal');
    } else {
        console.log('✗ Farmer missing rejection reason modal');
    }
} else {
    console.log('\n✗ Farmer HTML missing');
}

// Check 7: Farmer JS modal logic
const farmerJsPath = path.join(__dirname, '../frontend/js/farmer.js');
if (fs.existsSync(farmerJsPath)) {
    console.log('\n✓ Farmer JS exists');
    const farmerJs = fs.readFileSync(farmerJsPath, 'utf8');
    if (farmerJs.includes('showRejectionReason') && farmerJs.includes('closeRejectionReasonModal')) {
        console.log('✓ Farmer has rejection modal functions');
    } else {
        console.log('✗ Farmer missing rejection modal functions');
    }
    if (farmerJs.includes('window.farmerApp = this')) {
        console.log('✓ Farmer instance is globally accessible for onclick handlers');
    } else {
        console.log('✗ Farmer instance not globally accessible');
    }
    if (farmerJs.includes('onclick="window.farmerApp.showRejectionReason')) {
        console.log('✓ Farmer has onclick handler to show rejection reason');
    } else {
        console.log('✗ Farmer missing onclick handler for rejection reason');
    }
    if (farmerJs.includes('Resubmit')) {
        console.log('✓ Farmer shows "Resubmit" button for rejected products');
    } else {
        console.log('✗ Farmer does not show "Resubmit" button');
    }
} else {
    console.log('\n✗ Farmer JS missing');
}

console.log('\n=== Check Complete ===');
console.log('\nNOTE: To complete the setup, run the migration on your database:');
console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;');
