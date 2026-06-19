const fs = require('fs');
const path = require('path');

// Verification script to check if the subscription endpoint fixes are in place
// This checks that audit log and notification calls are wrapped in try-catch blocks

const adminJsPath = path.join(__dirname, '../routes/admin.js');
const content = fs.readFileSync(adminJsPath, 'utf8');

console.log('=== Verifying Subscription Endpoint Fixes ===\n');

const checks = [
  {
    name: 'Approve endpoint - audit log try-catch',
    pattern: /router\.put\('\/subscriptions\/:id\/approve'[\s\S]*?await writeAdminAuditLog[\s\S]*?} catch \(auditErr\)/,
  },
  {
    name: 'Approve endpoint - notification try-catch',
    pattern: /router\.put\('\/subscriptions\/:id\/approve'[\s\S]*?INSERT INTO notifications[\s\S]*?} catch \(notifErr\)/,
  },
  {
    name: 'Reject endpoint - audit log try-catch',
    pattern: /router\.put\('\/subscriptions\/:id\/reject'[\s\S]*?await writeAdminAuditLog[\s\S]*?} catch \(auditErr\)/,
  },
  {
    name: 'Reject endpoint - notification try-catch',
    pattern: /router\.put\('\/subscriptions\/:id\/reject'[\s\S]*?INSERT INTO notifications[\s\S]*?} catch \(notifErr\)/,
  },
  {
    name: 'Expire endpoint - audit log try-catch',
    pattern: /router\.put\('\/subscriptions\/:id\/expire'[\s\S]*?await writeAdminAuditLog[\s\S]*?} catch \(auditErr\)/,
  },
  {
    name: 'Expire endpoint - notification try-catch',
    pattern: /router\.put\('\/subscriptions\/:id\/expire'[\s\S]*?INSERT INTO notifications[\s\S]*?} catch \(notifErr\)/,
  },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  const found = check.pattern.test(content);
  if (found) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
});

console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}/${checks.length}`);
console.log(`Failed: ${failed}/${checks.length}`);

if (failed === 0) {
  console.log('\n✅ All fixes are in place!');
  console.log('The subscription endpoints (approve, reject, expire) now have error handling for audit log and notification failures.');
  process.exit(0);
} else {
  console.log('\n❌ Some fixes are missing');
  process.exit(1);
}
