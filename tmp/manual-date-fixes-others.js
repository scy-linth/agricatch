const fs = require('fs');
const path = require('path');

function addYearUndefined(optsStr) {
  // optsStr like {"month short","day numeric"}
  // Insert `, year: undefined` before the closing `}`.
  return optsStr.replace(/\}$/, ', year: undefined }');
}

function fix(filePath, replacements, label) {
  const abs = path.join(process.cwd(), filePath);
  let s = fs.readFileSync(abs, 'utf8');
  let changed = false;
  replacements.forEach(([rx, repl]) => {
    const m = s.match(rx);
    if (m) {
      s = s.replace(rx, repl);
      console.log(`${label}: ${m.length} replacements`);
      changed = true;
    } else {
      console.log(`${label}: 0 replacements`);
    }
  });
  fs.writeFileSync(abs, s, 'utf8');
  if (changed) console.log(`Wrote ${label}`);
}

// farmers.js: public farmer card joined date.
fix('frontend/js/farmers.js', [
  [
    /FormatUtil\.formatDate\(farmer\.created_at, \{[^}]*\}\)/g,
    (match) => match.replace('FormatUtil.formatDate', 'FormatUtil.formatDateOnly')
  ]
], 'farmers.js');

// farmer.js: product created label and chart labels.
fix('frontend/js/farmer.js', [
  [
    /FormatUtil\.formatDateOnly\(createdAt, \{[^}]*\}\)/g,
    (match) => match.replace('FormatUtil.formatDateOnly', 'FormatUtil.formatDate')
  ],
  [
    /FormatUtil\.formatDateOnly\(dt, (\{[^}]*\})\)/g,
    (match, opts) => `FormatUtil.formatDateOnly(dt, ${addYearUndefined(opts)})`
  ],
  [
    /FormatUtil\.formatDateOnly\(sub\.starts_at, (\{[^}]*\})\)/g,
    (match, opts) => `FormatUtil.formatDateOnly(sub.starts_at, ${addYearUndefined(opts)})`
  ],
  [
    /FormatUtil\.formatDateOnly\(sub\.expires_at, (\{[^}]*\})\)/g,
    (match, opts) => `FormatUtil.formatDateOnly(sub.expires_at, ${addYearUndefined(opts)})`
  ]
], 'farmer.js');

// admin-charts.js: chart category labels omit year.
fix('frontend/js/admin-charts.js', [
  [
    /FormatUtil\.formatDateOnly\(date, (\{[^}]*\})\)/g,
    (match, opts) => `FormatUtil.formatDateOnly(date, ${addYearUndefined(opts)})`
  ]
], 'admin-charts.js');
