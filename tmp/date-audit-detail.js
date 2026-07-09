const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const auditPath = path.join(rootDir, 'tmp', 'date-audit-output.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const DATE_ONLY_KEYWORDS = [
  'expir', 'birthday', 'birth_date', 'delivery_date', 'harvest_date',
  'preorder_availability', 'availability', 'scheduled_delivery_date',
  'starts_at', 'expires_at', 'best before', 'best_before', 'joined'
];
const DATETIME_KEYWORDS = [
  'created_at', 'updated_at', 'submitted', 'reviewed_at', 'cancelled_at',
  'delivered_at', 'confirmed_at', 'prepared_at', 'out_for_delivery_at',
  'scheduled_at', 'timestamp', 'last updated', 'last_updated', 'activity',
  'audit', 'log', 'notification', 'ticket created', 'request created',
  'order created', 'product created', 'when', 'exact'
];

function getContext(file, line, radius = 3) {
  const full = path.join(rootDir, file);
  if (!fs.existsSync(full)) return 'FILE NOT FOUND';
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const start = Math.max(1, line - radius) - 1;
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).map((l, i) => `${line - radius + i}: ${l}`).join('\n');
}

function classify(text, context) {
  const lc = (text + ' ' + context).toLowerCase();
  // Force date-only for certain unambiguous labels
  if (/(delivery\s*date|harvest\s*date|preorder.*availability|best\s*before|expiry|expires_at|starts_at|joined|birth)/.test(lc)) {
    return 'Date Only';
  }
  // Force date+time for creation/update/timestamps
  if (/(created_at|updated_at|submitted|reviewed_at|cancelled_at|confirmed_at|prepared_at|out_for_delivery_at|delivered_at|scheduled.*date|timestamp|last\s*updated|activity|audit|notification|when|exact)/.test(lc)) {
    return 'Date + Time';
  }
  return 'UNCERTAIN';
}

let out = '# Date Display Classification Draft\n\n';
out += '| File | Line | Current Text | Proposed | Notes |\n|---|---|---|---|---|\n';

audit.forEach(group => {
  group.matches
    .filter(m => m.type === 'display')
    .forEach(m => {
      const ctx = getContext(m.file, m.line);
      const proposed = classify(m.text, ctx);
      const notes = proposed === 'UNCERTAIN' ? ctx.replace(/\n/g, '<br>') : '';
      const text = m.text.replace(/\|/g, '\\|').substring(0, 160);
      out += `| ${m.file.replace(/\|/g, '\\|')} | ${m.line} | \`${text}\` | ${proposed} | ${notes} |\n`;
    });
});

fs.writeFileSync(path.join(rootDir, 'tmp', 'date-classification-draft.md'), out, 'utf8');
console.log('Wrote tmp/date-classification-draft.md');
