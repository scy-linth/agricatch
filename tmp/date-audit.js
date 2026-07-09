const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const dirs = [
  path.join(rootDir, 'frontend/js'),
  path.join(rootDir, 'frontend'),
  path.join(rootDir, 'backend/routes'),
  path.join(rootDir, 'backend/utils'),
  path.join(rootDir, 'tests'),
];

const exclude = [
  /\\node_modules\\/,
  /\\vendor\\/,
  /\\.git\\/,
];

const patterns = {
  dateTimeDisplay: /toLocaleDateString\(|toLocaleTimeString\(|toLocaleString\(|ServerTime\.formatDate|ServerTime\.formatDateOnly|ServerTime\.formatTimeOnly|\bformatDate\s*\(/,
  dateParse: /new\s+Date\s*\([^)]*(created_at|updated_at|timestamp|date|expiry|harvest|starts_at|expires_at|joined|submitted|flagged_at|last_message_at|delivered_at|harvest_date_updated_at|previous_harvest_date|preorder_availability_date)/i,
  relativeTime: /_relativeTime\s*\(/
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (exclude.some(re => re.test(full))) continue;
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith('.js') || full.endsWith('.html'))) {
      out.push(full);
    }
  }
  return out;
}

const files = Array.from(new Set(dirs.flatMap(walk)));
const matches = [];

files.forEach(file => {
  const rel = path.relative(rootDir, file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    let matchType = '';
    if (patterns.dateTimeDisplay.test(line)) matchType = 'display';
    else if (patterns.dateParse.test(line)) matchType = 'parse';
    else if (patterns.relativeTime.test(line)) matchType = 'relative';
    if (matchType) {
      matches.push({ file: rel, line: ln, type: matchType, text: line.trim() });
    }
  });
});

// Output grouped by file for easier audit
groups = {};
matches.forEach(m => {
  groups[m.file] = groups[m.file] || [];
  groups[m.file].push(m);
});

const outPath = path.join(rootDir, 'tmp', 'date-audit-output.json');
fs.writeFileSync(outPath, JSON.stringify(Object.keys(groups).sort().map(file => ({
  file,
  matches: groups[file]
})), null, 2), 'utf8');
console.log(`Wrote audit to ${outPath}`);
