const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const auditPath = path.join(rootDir, 'tmp', 'date-audit-output.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const APPLY = process.argv.includes('--apply') || process.argv.includes('-a') || !DRY_RUN;

const LOG = [];
const log = (...args) => LOG.push(args.join(' '));

// Files that must never be auto-modified.
const ALWAYS_SKIP_FILES = [
  'frontend\\js\\format.js',
  'frontend\\js\\chat.js',
  'frontend\\js\\support-ticket-chat.js',
];

// Date-only arguments (calendar/user-selected dates, no time component intended)
const DATE_ONLY_ARGS =
  /\b(delivery_date|harvest_date|expiry_date|preorder_availability_date|expires_at|starts_at|best_before|bestbefore|previous_harvest_date|scheduled_delivery_date|subscription\.expires_at|subscription\.starts_at|sub\.expires_at|sub\.starts_at|d\.expires_at|order\.delivery_date|order\.preorder_availability_date|item\.harvest_date|item\.preorder_availability_date|item\.previous_harvest_date|product\.harvest_date|product\.expiry_date|newExpiry|expiryDateObj|harvestDateObj|announcement\.expires_at|\.expires_at|\.starts_at)\b/;

// Date+time arguments (event timestamps)
const DATE_TIME_ARGS =
  /\b(created_at|updated_at|submitted|reviewed_at|cancelled_at|confirmed_at|prepared_at|out_for_delivery_at|delivered_at|scheduled_at|timestamp|flagged_at|last_message_at|\.created_at|\.updated_at|\.reviewed_at|\.cancelled_at|\.confirmed_at|\.prepared_at|\.out_for_delivery_at|\.delivered_at|\.scheduled_at|\.timestamp|\.flagged_at|\.last_message_at|request\.created_at|ticket\.created_at|msg\.created_at|subscription\.created_at|s\.created_at|p\.created_at|r\.created_at|a\.created_at|n\.created_at|o\.created_at|f\.created_at|user\.created_at|safeUser\.created_at|farmer\.created_at|profile\.created_at|order\.created_at|item\.harvest_date_updated_at|order\.items\[0\]\.harvest_date_updated_at|activity\.timestamp|a\.timestamp|entry\.created_at|log\.created_at|msg\.created_at|flag\.updated_at|data\.updated_at)\b/;

// Context that forces a date-only display even if argument would otherwise be date+time.
const DATE_ONLY_CONTEXT =
  /(Joined|overview-joined|po-joined|joined|fmtDateOnly|Date Only|harvest_date|expiry_date|delivery_date|preorder_availability_date|previous_harvest_date|Availability Date|Expected Harvest|Delivery Date|Best Before|newExpiry|expiryDateObj|harvestDateObj)/i;

// Context that forces date+time even if method is toLocaleDateString.
const DATE_TIME_CONTEXT =
  /(created_at|updated_at|submitted|reviewed_at|cancelled_at|confirmed_at|prepared_at|out_for_delivery_at|delivered_at|scheduled_at|timestamp|Last Updated|last updated|Last updated|activity|audit|notification|sub-detail-created-at|display-submitted|ticket-detail-created|request created|order created|product created|when|exact|\.created_at\b)/i;

// Skip patterns (chat relative timestamps, numeric/currency formatters)
const SKIP_CONTEXT =
  /(_relativeTime|_formatMessageTime|_formatDateHeader|Yesterday at| at \$\{|firstMsgDate\.toLocale|msgDate\.toLocale|chat-msg|message-bubble|msg-text|Number\s*\(|parseFloat\s*\(|parseInt\s*\(|\.total\s*\.\s*toLocale|\.total\b.*\btoLocale|settings\.durations|context\.raw|amount_paid|amountPay|discount_pct|PHP\s*\$|₱|seriesIndex\b)/i;

const SKIP_ARGS =
  /^(Number\s*\(|parseFloat\s*\(|parseInt\s*\(|\.total|info\.total|settings\.durations|context\.raw|v\b|value\b)/;

const parseOptions = (optString) => {
  const out = {};
  const patterns = {
    timeZone: /timeZone\s*:\s*['"]([^'"]+)['"]/,
    year: /year\s*:\s*['"]?(\w+|undefined)['"]?/,
    month: /month\s*:\s*['"]([^'"]+)['"]/,
    day: /day\s*:\s*['"]([^'"]+)['"]/,
    weekday: /weekday\s*:\s*['"]([^'"]+)['"]/,
    hour: /hour\s*:\s*['"]([^'"]+)['"]/,
    minute: /minute\s*:\s*['"]([^'"]+)['"]/,
    second: /second\s*:\s*['"]([^'"]+)['"]/,
    hour12: /hour12\s*:\s*(true|false)/,
  };
  for (const [key, rx] of Object.entries(patterns)) {
    const m = optString.match(rx);
    if (m) {
      if (key === 'hour12') out[key] = m[1] === 'true';
      else if (m[1] === 'undefined') out[key] = undefined;
      else out[key] = m[1];
    }
  }
  return out;
};

const buildOptions = (target, parsed, originalMethod) => {
  const opts = {};
  if (target === 'formatDateOnly') {
    if (parsed.month) opts.month = parsed.month;
    if (parsed.day) opts.day = parsed.day;
    if (parsed.weekday) opts.weekday = parsed.weekday;
    // When original did not specify a year and uses month/day short style, omit year.
    if (!parsed.year) opts.year = undefined;
  } else if (target === 'formatDate') {
    if (parsed.month) opts.month = parsed.month;
    if (parsed.day) opts.day = parsed.day;
    if (parsed.weekday) opts.weekday = parsed.weekday;
    // For compact timeline (short month + day), also omit year.
    if (!parsed.year && parsed.month === 'short') opts.year = undefined;
    // Preserve seconds if the original UI showed seconds.
    if (parsed.second) opts.second = parsed.second;
  } else if (target === 'formatTimeOnly') {
    if (parsed.second) opts.second = parsed.second;
  }
  // Delete undefined values so they don't pass through to Intl as keys.
  Object.keys(opts).forEach(k => { if (opts[k] === undefined) delete opts[k]; });
  return Object.keys(opts).length ? opts : null;
};

const buildReplacement = (target, arg, options = null) => {
  const optArg = options ? `, ${JSON.stringify(options)}` : '';
  return `FormatUtil.${target}(${arg}${optArg})`;
};

const detectFunctionName = (source, matchIndex) => {
  // Look a bit before the match for the enclosing function name.
  const prefix = source.slice(0, matchIndex);
  const m = prefix.match(/(?:function\s+|(?:^|[^A-Za-z0-9_$.\[\]])\b)([A-Za-z_$][A-Za-z0-9_$]*)\s*[=(]\s*(?:async\s*)?\s*\([^)]*\)\s*\{/);
  if (!m) return null;
  return m[1];
};

const classify = (match, source) => {
  const method = match[3];
  const arg = (match[1] || match[2]).trim();
  const optString = match[4] || '';
  const start = Math.max(0, match.index - 200);
  const end = Math.min(source.length, match.index + match[0].length + 120);
  const context = source.slice(start, end).toLowerCase();
  const originalCaseContext = source.slice(start, end);
  const funcName = detectFunctionName(source, match.index);

  // File-level skip
  for (const sf of ALWAYS_SKIP_FILES) {
    if (match.fileRel === sf) return { skip: true, reason: 'always-skip' };
  }

  // Context skip
  if (SKIP_CONTEXT.test(originalCaseContext)) return { skip: true, reason: 'skip-context' };
  if (SKIP_ARGS.test(arg)) return { skip: true, reason: 'skip-arg' };

  const parsed = parseOptions(optString);

  // Heuristic: direct numeric date constructors for calendar-only fields.
  const argNorm = arg.toLowerCase();

  // If we are inside a table cell whose header is "Joined", force Date Only for created_at.
  const joinedFuncs = /^(renderUsers|renderAdmin|renderAllUsers|renderFlaggedUsers|renderFarmers|buildRow|renderFarmerCard)$/;
  const isJoined = (joinedFuncs.test(funcName) || originalCaseContext.includes('Joined')) && /created_at/.test(argNorm);

  let target = null;

  // Argument-driven primary classification
  if (DATE_ONLY_ARGS.test(arg) && !DATE_TIME_ARGS.test(arg)) {
    target = 'formatDateOnly';
  } else if (DATE_TIME_ARGS.test(arg)) {
    if (method === 'toLocaleTimeString') target = 'formatTimeOnly';
    else target = 'formatDate';
  } else {
    // No strong argument signal: fall back to method and options.
    if (method === 'toLocaleTimeString') target = 'formatTimeOnly';
    else if (method === 'toLocaleDateString') {
      if (DATE_TIME_CONTEXT.test(originalCaseContext) && !DATE_ONLY_CONTEXT.test(originalCaseContext)) {
        target = 'formatDate';
      } else {
        target = 'formatDateOnly';
      }
    } else if (method === 'toLocaleString') {
      if (parsed.hour || parsed.minute) target = 'formatDate';
      else if (parsed.month || parsed.day || parsed.year) target = 'formatDateOnly';
      else target = 'formatDate';
    } else {
      target = 'formatDate';
    }
  }

  // Context overrides
  if (isJoined) target = 'formatDateOnly';
  if (DATE_ONLY_CONTEXT.test(originalCaseContext) && !DATE_TIME_CONTEXT.test(originalCaseContext)) {
    target = 'formatDateOnly';
  }
  if (DATE_TIME_CONTEXT.test(originalCaseContext) && !DATE_ONLY_CONTEXT.test(originalCaseContext)) {
    if (method === 'toLocaleTimeString') target = 'formatTimeOnly';
    else target = 'formatDate';
  }

  // Special combined patterns
  const isDisplayDateTime =
    originalCaseContext.includes('displayDate') &&
    originalCaseContext.includes('displayTime') &&
    /createdAt/.test(originalCaseContext);
  if (isDisplayDateTime) {
    // Replace the entire displayDate/displayTime block when we reach displayDate.
    target = 'combine';
  }

  const isFmtTimeline = originalCaseContext.includes('fmtTimelineDate');
  if (isFmtTimeline) {
    target = 'formatDate';
  }

  const options = buildOptions(target, parsed, method);
  return { target, arg, options };
};

const formatCallRegex =
  /(?:new\s+Date\s*\(\s*([^)]*?)\s*\)|([A-Za-z_$][A-Za-z0-9_$\.\[\]]*))\s*\.\s*(toLocaleString|toLocaleDateString|toLocaleTimeString)\s*\((.*?)\)/g;

const combinedDisplayRegex =
  /const\s+displayDate\s*=\s*[^;]*;\s*\n\s*const\s+displayTime\s*=\s*[^;]*;/g;
const fmtTimelineRegex =
  /const\s+[dt]\s*=\s*[^;]*;\s*\n\s*const\s+t\s*=\s*[^;]*;\s*\n\s*return\s+[`"]\$\{[^}]*\},\s*\$\{[^}]*\}[`"];/g;

const processFile = (fileRel, matches) => {
  const full = path.join(rootDir, fileRel);
  if (!fs.existsSync(full)) {
    log(`MISSING ${fileRel}`);
    return 0;
  }
  let source = fs.readFileSync(full, 'utf8');
  const allMatches = [];
  let m;
  // Need to attach fileRel to match for classifier.
  const regex = new RegExp(formatCallRegex.source, formatCallRegex.flags);
  while ((m = regex.exec(source)) !== null) {
    allMatches.push({ ...m, fileRel });
  }

  if (allMatches.length === 0) return 0;

  // Process from end to start so source indices remain stable.
  allMatches.sort((a, b) => b.index - a.index);

  let total = 0;
  for (const match of allMatches) {
    const decision = classify(match, source);
    if (decision.skip) {
      log(`SKIP ${fileRel}:${lineOf(source, match.index)} reason=${decision.reason}`);
      continue;
    }

    let replacement = null;
    let replaceFrom = match.index;
    let replaceTo = match.index + match[0].length;

    if (decision.target === 'combine') {
      // displayDate + displayTime: replace both declarations with one line.
      const c = source.slice(Math.max(0, match.index - 80), match.index + match[0].length + 120);
      const combined = c.match(combinedDisplayRegex);
      if (combined) {
        const combinedStart = match.index - 80 + c.indexOf(combined[0]);
        const combinedEnd = combinedStart + combined[0].length;
        const newLine = `const createdDateTime = FormatUtil.formatDate(createdAt);`;
        replaceFrom = combinedStart;
        replaceTo = combinedEnd;
        replacement = newLine;
      }
    }

    if (decision.target === 'fmtTimelineDate') {
      // Replace const d = ...; const t = ...; return `${d}, ${t}`; with one line.
      const c = source.slice(Math.max(0, match.index - 120), match.index + match[0].length + 120);
      const block = c.match(fmtTimelineRegex);
      if (block) {
        const blockStart = match.index - 120 + c.indexOf(block[0]);
        const blockEnd = blockStart + block[0].length;
        const opts = decision.options && decision.options.month === 'short' ? ', {"month":"short","day":"numeric"}' : '';
        replacement = `return FormatUtil.formatDate(dt${opts});`;
        replaceFrom = blockStart;
        replaceTo = blockEnd;
      }
    }

    if (!replacement && decision.target !== 'combine' && decision.target !== 'fmtTimelineDate') {
      replacement = buildReplacement(decision.target, decision.arg, decision.options);
    }

    if (replacement) {
      source = source.slice(0, replaceFrom) + replacement + source.slice(replaceTo);
      total++;
      log(`DRY ${fileRel}:${lineOf(source, replaceFrom)}\n- ${match[0].replace(/\n/g, '\\n')}\n+ ${replacement}`);
    }
  }

  if (APPLY && total > 0) {
    fs.writeFileSync(full, source, 'utf8');
  }
  return total;
};

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

const summary = {};
let total = 0;
audit.forEach(group => {
  // Only process frontend JS files, not backend or tests.
  if (!group.file.startsWith('frontend\\') || group.file.startsWith('frontend\\js\\format.js')) {
    log(`SKIP_FILE ${group.file}`);
    return;
  }
  const n = processFile(group.file, group.matches);
  if (n) {
    summary[group.file] = n;
    total += n;
  }
});

log('\n--- summary ---');
log(JSON.stringify(summary, null, 2));
log(`Total lines changed: ${total}`);

fs.writeFileSync(path.join(rootDir, 'tmp', DRY_RUN ? 'dry-run-v4.log' : 'apply-v4.log'), LOG.join('\n'), 'utf8');
console.log('Wrote log to', DRY_RUN ? 'tmp/dry-run-v4.log' : 'tmp/apply-v4.log');
