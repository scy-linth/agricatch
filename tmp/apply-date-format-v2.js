const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const auditPath = path.join(rootDir, 'tmp', 'date-audit-output.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const APPLY = process.argv.includes('--apply') || process.argv.includes('-a');

let logLines = [];
const log = (...args) => {
  logLines.push(args.join(' '));
};

const skipLine = (line, file) => {
  const t = line.trim();
  if (t.startsWith('//')) return true;
  if (file === 'frontend\\js\\format.js') return true;
  if (/(\bNumber\s*\(|\bparseFloat\s*\(|\bparseInt\s*\(|\.total\s*\.\s*toLocale|settings\.durations|seriesIndex|context\.raw|amount_paid|amountPaid|discount_pct|PHP\s*\$|₱)/i.test(line)) return true;
  return false;
};

const isRelativeChatContext = (line, file) => {
  if (!/(chat\.js|support-ticket-chat\.js)/.test(file)) return false;
  if (/(\b_relativeTime\b|_formatMessageTime|_formatDateHeader|dayLabel\b|timeStr\b|dayName\b|Yesterday at| at \$\{|firstMsgDate\.toLocale|msgDate\.toLocale)/.test(line)) return true;
  return false;
};

const actionFor = (file, line) => {
  if (skipLine(line, file)) return { action: 'skip' };
  if (isRelativeChatContext(line, file)) return { action: 'skip' };

  const m = line.match(
    /(?:new\s+Date\s*\(\s*([^)]*?)\s*\)|([A-Za-z_$][A-Za-z0-9_$\.\[\]]*))\s*\.\s*(toLocaleString|toLocaleDateString|toLocaleTimeString)\s*\((.*?)\)/s
  );
  if (!m) return { action: 'skip' };

  const arg = (m[1] || m[2]).trim();
  const method = m[3];
  const args = m[4] || '';

  if (!arg) return { action: 'skip' };
  if (/^(Number\s*\(|parseFloat\s*\(|parseInt\s*\(|\.total|info\.total|settings\.durations|context\.raw|v\b|value\b)/.test(arg)) return { action: 'skip' };

  const ctx = (line + ' ' + args).toLowerCase();

  const dateOnlySignals = [
    'delivery_date', 'harvest_date', 'expiry_date', 'preorder_availability_date',
    'expires_at', 'starts_at', 'best_before', 'best before', 'previous_harvest_date',
    'joined', 'sub-current-expiry', 'sub-detail-starts-at', 'sub-detail-expires-at',
    'available:', 'expected harvest', 'availability date', 'previous harvest date',
    'delivery date announced', 'bestbefore', 'expiry', 'harvestformatted'
  ];

  const dateTimeSignals = [
    'created_at', 'updated_at', 'submitted', 'reviewed_at', 'cancelled_at',
    'confirmed_at', 'prepared_at', 'out_for_delivery_at', 'delivered_at',
    'scheduled_at', 'timestamp', 'last updated', 'lastupdated', 'activity', 'audit',
    'notification', 'ticket created', 'request created', 'order created', 'product created',
    'when', 'exact', 'sub-detail-created-at', 'display-submitted', 'displaysubmitted'
  ];

  let target = null;

  if (method === 'toLocaleTimeString') {
    target = 'FormatUtil.formatTimeOnly';
  } else if (method === 'toLocaleString') {
    if (/hour\s*:\s*['"]?2-digit|hour\s*:\s*['"]?numeric|minute\s*:/.test(args)) {
      target = 'FormatUtil.formatDate';
    } else if (/month\s*:|day\s*:/.test(args) && !/hour\s*:/.test(args) && !/minute\s*:/.test(args)) {
      target = 'FormatUtil.formatDateOnly';
    } else {
      target = 'FormatUtil.formatDate';
    }
  } else if (method === 'toLocaleDateString') {
    const dateOnly = dateOnlySignals.some(s => ctx.includes(s));
    const dateTime = dateTimeSignals.some(s => ctx.includes(s));
    if (dateOnly && !dateTime) target = 'FormatUtil.formatDateOnly';
    else if (dateTime) target = 'FormatUtil.formatDate';
    else target = 'FormatUtil.formatDateOnly';
  }

  return { action: 'replace', target, arg, method, match: m[0], options: args };
};

const processFile = (file, matches) => {
  const full = path.join(rootDir, file);
  if (!fs.existsSync(full)) {
    log(`Missing file: ${file}`);
    return { changes: 0 };
  }
  let src = fs.readFileSync(full, 'utf8');
  const lines = src.split(/\r?\n/);
  let replacements = 0;

  matches
    .filter(m => m.type === 'display')
    .sort((a, b) => b.line - a.line)
    .forEach(m => {
      const lineIdx = m.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) return;
      const line = lines[lineIdx];
      const act = actionFor(file, line);
      if (act.action !== 'replace') {
        if (DRY_RUN) log(`SKIP ${file}:${m.line}: ${line.trim()}`);
        return;
      }

      const rep = `${act.target}(${act.arg})`;
      const idx = line.indexOf(act.match);
      if (idx === -1) {
        log(`MATCH_TEXT_NOT_FOUND ${file}:${m.line}`);
        return;
      }

      const newLine = line.slice(0, idx) + rep + line.slice(idx + act.match.length);
      lines[lineIdx] = newLine;
      replacements++;
      if (DRY_RUN) {
        log(`DRY ${file}:${m.line}`);
        log(`- ${line.trim()}`);
        log(`+ ${newLine.trim()}`);
      }
    });

  const newSrc = lines.join('\n');
  if (APPLY && replacements > 0) {
    fs.writeFileSync(full, newSrc, 'utf8');
  }
  return { changes: replacements };
};

const summary = {};
let total = 0;
audit.forEach(group => {
  const res = processFile(group.file, group.matches);
  if (res.changes) {
    summary[group.file] = res.changes;
    total += res.changes;
  }
});

log('\n--- summary ---');
log(JSON.stringify(summary, null, 2));
log(`Total lines changed: ${total}`);

fs.writeFileSync(path.join(rootDir, 'tmp', DRY_RUN ? 'dry-run-v2.log' : 'apply.log'), logLines.join('\n'), 'utf8');
console.log('Wrote log to', DRY_RUN ? 'tmp/dry-run-v2.log' : 'tmp/apply.log');
