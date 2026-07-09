const fs = require('fs');
const path = require('path');

// Fix admin.js chat timestamp
const adminPath = path.join(__dirname, '..', 'frontend', 'js', 'admin.js');
let adminContent = fs.readFileSync(adminPath, 'utf8');

// Replace chat message timestamp
adminContent = adminContent.replace(
  /const exactTime = new Date\(msg\.created_at\)\.toLocaleString\('en-PH'\);/g,
  'const exactTime = FormatUtil.formatDate(msg.created_at);'
);

fs.writeFileSync(adminPath, adminContent, 'utf8');
console.log('✅ Fixed admin.js chat timestamp');

// Fix support-ticket-chat.js relative timestamps (intentionally excluded - these are relative time displays)
// No changes needed - these are intentionally using native methods for relative time logic

console.log('✅ Chat timestamp fixes complete');
