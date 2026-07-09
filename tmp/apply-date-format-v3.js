const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const auditPath = path.join(rootDir, 'tmp', 'date-audit-output.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const APPLY = process.argv.includes('--apply') || process.argv.includes('-a') || !DRY_RUN;

const LOG = [];
const log = (...args) => LOG.push(args.join(' '));

const isCurrencyOrNumber = (chunk, file) => {
  const c = chunk.toLowerCase();
  if (file.startsWith('tests\\')) return true; // keep tests untouched
  if (/\bnumber\s*\(|\bparsefloat\s*\(|\bparseint\s*\(|\.total\s*\.\s*toLocale|\.total\b.*\btoLocale|settings\.durations|seriesIndex|amount_paid|amountpaid|context\.raw|php\s*\$|₱/.test(chunk)) return true;
  return false;
};

const isRelativeChat = (chunk, file) => {
  if (!/(chat\.js|support-ticket-chat\.js)/.test(file)) return false;
  if (/(\b_relativeTime\b|_formatMessageTime|_formatDateHeader|dayLabel\b|timeStr\b|dayName\b|Yesterday at| at \$\{|firstMsgDate\.toLocale|msgDate\.toLocale)/.test(chunk)) return true;
  return false;
};

const normalizeMethodName = (method) => {
  if (method === 'toLocaleString') return 'toLocaleString';
  if (method === 'toLocaleDateString') return 'toLocaleDateString';
  if (method === 'toLocaleTimeString') return 'toLocaleTimeString';
  return null;
};

const classify = (chunk, method, arg, opts) => {
  const ctx = chunk.toLowerCase();

  // Currency/relative already filtered before this point

  // Override: Joined fields = date only
  if (/(\bjoined\b|overview-joined|po-joined)/.test(ctx)) return { target: 'formatDateOnly' };

  // Override: scheduled delivery dates = date only (user-selected date, no time)
  if (/scheduled_delivery_date/.test(ctx)) return { target: 'formatDateOnly' };

  // Override: order list displayDate/displayTime -> combined full date+time
  if (/displayDate\s*=|displayTime\s*=/ .test(chunk) && /createdAt/.test(ctx)) {
    return { target: 'formatDate', combine: true, varName: 'createdAt' };
  }

  // Override: fmtTimelineDate -> combine compactly (no year)
  if (/fmtTimelineDate/.test(chunk)) {
    return { target: 'formatDate', combine: true, varName: 'dt', options: { month: 'short', day: 'numeric', year: undefined } };
  }

  // Override: chart labels keep compact month/day (no year)
  if (/(admin-charts\.js|dailyTotals|apexchart|report.*chart|period.*year|period.*all)/.test(chunk)) {
    const preserveShort = /month\s*:\s*['"]short['"]/.test(opts);
    const preserveDay = /day\s*:\s*['"]numeric['"]/.test(opts);
    const preserveYear = /year\s*:/.test(opts);
    const options = {};
    if (preserveShort) options.month = 'short';
    if (preserveDay) options.day = 'numeric';
    if (!preserveYear) options.year = undefined;
    return { target: 'formatDateOnly', options };
  }

  const dateOnlySignals = [
    'delivery_date', 'harvest_date', 'expiry_date', 'preorder_availability_date',
    'expires_at', 'starts_at', 'best_before', 'best before', 'previous_harvest_date',
    'available:', 'expected harvest', 'availability date', 'previous harvest date',
    'delivery date announced', 'bestbefore', 'expiry', 'harvestformatted', 'newexpiry'
  ];

  const dateTimeSignals = [
    'created_at', 'updated_at', 'submitted', 'reviewed_at', 'cancelled_at',
    'confirmed_at', 'prepared_at', 'out_for_delivery_at', 'delivered_at',
    'scheduled_at', 'timestamp', 'last updated', 'lastupdated', 'activity',
    'audit', 'notification', 'ticket created', 'request created', 'order created',
    'product created', 'when', 'exact', 'sub-detail-created-at', 'display-submitted',
    'displaysubmitted', 'flag.updated_at', 'user.flagged_at', 'lastupdated', 'am-detail-timestamp'
  ];

  if (method === 'toLocaleTimeString') {
    return { target: 'formatTimeOnly' };
  }

  if (method === 'toLocaleString') {
    const hasTimeKeys = /hour\s*:\s*|minute\s*:/.test(opts);
    const hasOnlyDateKeys = /month\s*:\s*|day\s*:\s*|year\s*:/.test(opts) && !hasTimeKeys;
    if (hasOnlyDateKeys) return { target: 'formatDateOnly' };
    return { target: 'formatDate' };
  }

  if (method === 'toLocaleDateString') {
    const isDateOnly = dateOnlySignals.some(s => ctx.includes(s));
    const isDateTime = dateTimeSignals.some(s => ctx.includes(s));
    if (isDateOnly && !isDateTime) return { target: 'formatDateOnly' };
    return { target: 'formatDate' };
  }

  return { target: 'formatDateOnly' };
};

const buildReplacement = (target, arg, options = null) => {
  const base = `FormatUtil.${target}(${arg}${options ? ', ' + JSON.stringify(options) : ''})`;
  return base;
};

const formatCallRegex =
  /(?:new\s+Date\s*\(\s*([^)]*?)\s*\)|([A-Za-z_$][A-Za-z0-9_$\.\[\]]*))\s*\.\s*(toLocaleString|toLocaleDateString|toLocaleTimeString)\s*\(([\s\S]*?)\)/;

const processFile = (file, matches) => {
  const full = path.join(rootDir, file);
  if (!fs.existsSync(full)) {
    log(`MISSING ${file}`);
    return 0;
  }
  let lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  let total = 0;

  matches
    .filter(m => m.type === 'display')
    .sort((a, b) => b.line - a.line) // high to low so line indices remain stable
    .forEach(m => {
      const start = Math.max(0, m.line - 1);
      const end = Math.min(lines.length, start + 10);
      const chunk = lines.slice(start, end).join('\n');
      const originalChunk = chunk;

      if (isCurrencyOrNumber(chunk, file)) {
        log(`SKIP_NUMBER ${file}:${m.line}`);
        return;
      }
      if (isRelativeChat(chunk, file)) {
        log(`SKIP_CHAT ${file}:${m.line}`);
        return;
      }

      const match = chunk.match(formatCallRegex);
      if (!match) {
        log(`NO_MATCH ${file}:${m.line} | ${chunk.slice(0, 120).replace(/\n/g, '\\n')}`);
        return;
      }

      const arg = (match[1] || match[2]).trim();
      const method = match[3];
      const opts = match[4];

      if (!arg) {
        log(`NO_ARG ${file}:${m.line}`);
        return;
      }

      const decision = classify(chunk, method, arg, opts);
      let replacement;

      if (decision.combine) {
        // For displayDate+displayTime or fmtTimelineDate: replace the full expression across lines.
        // The regex matched one of the two calls in a combine scenario. We handle the surrounding assignment.
        // Simpler fallback: just replace this single call with the combined target + options.
        replacement = buildReplacement(decision.target, arg, decision.options);
      } else {
        replacement = buildReplacement(decision.target, arg, decision.options);
      }

      const newChunk = chunk.slice(0, match.index) + replacement + chunk.slice(match.index + match[0].length);
      const newLines = newChunk.split('\n');
      lines.splice(start, end - start, ...newLines);
      total++;
      log(`DRY ${file}:${m.line}\n- ${originalChunk.replace(/\n/g, '\\n').slice(0, 220)}\n+ ${newChunk.replace(/\n/g, '\\n').slice(0, 220)}`);
    });

  if (APPLY && total > 0) {
    fs.writeFileSync(full, lines.join('\n'), 'utf8');
  }
  return total;
};

let total = 0;
const summary = {};
audit.forEach(group => {
  const n = processFile(group.file, group.matches);
  if (n) {
    summary[group.file] = n;
    total += n;
  }
});

log('\n--- summary ---');
log(JSON.stringify(summary, null, 2));
log(`Total lines changed: ${total}`);

fs.writeFileSync(path.join(rootDir, 'tmp', DRY_RUN ? 'dry-run-v3.log' : 'apply-v3.log'), LOG.join('\n'), 'utf8');
console.log('Wrote log to', DRY_RUN ? 'tmp/dry-run-v3.log' : 'tmp/apply-v3.log');
