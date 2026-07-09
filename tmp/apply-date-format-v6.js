const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const auditPath = path.join(rootDir, 'tmp', 'date-audit-output.json');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');
const APPLY = process.argv.includes('--apply') || process.argv.includes('-a') || !DRY_RUN;

const LOG = [];
const log = (...args) => LOG.push(args.join(' '));

const ALWAYS_SKIP_FILES = [
  'frontend\\js\\format.js',
  'frontend\\js\\chat.js',
  'frontend\\js\\support-ticket-chat.js',
];

const SKIP_ARGS = /^\s*(?:Number\s*\(|parseFloat\s*\(|parseInt\s*\(|info\.total|settings\.durations|\.total|context\.raw|v\b|value\b)\s*/i;

const SKIP_CONTEXT =
  /(_relativeTime|_formatMessageTime|_formatDateHeader|Yesterday at| at \$\{|firstMsgDate\.toLocale|msgDate\.toLocale|chat-msg|message-bubble|msg-text)/i;

// Arguments that are calendar/user-selected dates (no time of day intended).
const DATE_ONLY_ARGS =
  /\b(?:delivery_date|harvest_date|expiry_date|preorder_availability_date|expires_at|starts_at|best_before|bestbefore|previous_harvest_date|scheduled_delivery_date|newexpiry|expirydateobj|harvestdateobj|subscription\.expires_at|subscription\.starts_at|sub\.expires_at|sub\.starts_at|\.expires_at|\.starts_at|d\.expires_at)\b/i;

// Arguments that are event timestamps (should usually show date + time).
const DATE_TIME_ARGS =
  /\b(?:created_at|updated_at|submitted|reviewed_at|cancelled_at|confirmed_at|prepared_at|out_for_delivery_at|delivered_at|scheduled_at|timestamp|flagged_at|last_message_at|\.created_at|\.updated_at|\.reviewed_at|\.cancelled_at|\.confirmed_at|\.prepared_at|\.out_for_delivery_at|\.delivered_at|\.scheduled_at|\.timestamp|\.flagged_at|\.last_message_at)\b/i;

const JOINED_CONTEXT = /Joined|overview-joined|po-joined|['\"]Joined['\"]/i;
const JOINED_FUNCS = /^(?:renderUsers|renderAdmin|renderAllUsers|renderFlaggedUsers|renderFarmers|buildRow|renderFarmerCard|loadProfile|renderOverview)$/i;
const CHART_CONTEXT = /dailyTotals|apexchart|reportsChart|render.*Chart|period.*(today|week|month|year|all)|xaxis\.|categories\b|today \?|period ===/i;

function skipFile(file) {
  return file.startsWith('backend\\') || file.startsWith('tests\\') || ALWAYS_SKIP_FILES.includes(file);
}

function lineOf(source, idx) {
  let line = 1;
  for (let i = 0; i < idx; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

const callRegex =
  /(?:new\s+Date\s*\(\s*([^)]*?)\s*\)|([A-Za-z_$][A-Za-z0-9_$\.\[\]]*))\s*\.\s*(toLocaleString|toLocaleDateString|toLocaleTimeString)\s*\((.*?)\)/g;

function detectFunctionName(source, idx) {
  const prefix = source.slice(0, idx);
  const m1 = prefix.match(/(?:function\s+|^|\n)\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*\{[^}]*$/g);
  if (m1) {
    const last = m1[m1.length - 1];
    const name = last.match(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (name) return name[1];
  }
  const m2 = prefix.match(/(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*$/g);
  if (m2) {
    const last = m2[m2.length - 1];
    const name = last.match(/(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
    if (name) return name[1];
  }
  return null;
}

function parseOptions(optString) {
  const out = {};
  const map = {
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
  for (const [key, rx] of Object.entries(map)) {
    const m = optString.match(rx);
    if (m) {
      if (key === 'hour12') out[key] = m[1] === 'true';
      else if (m[1] === 'undefined') out[key] = undefined;
      else out[key] = m[1];
    }
  }
  return out;
}

function buildOptions(target, parsed, originalMethod, context) {
  const opts = {};
  const isChart = CHART_CONTEXT.test(context);
  const isShort = parsed.month === 'short';

  if (target === 'formatDateOnly') {
    if (parsed.month) opts.month = parsed.month;
    if (parsed.day) opts.day = parsed.day;
    if (parsed.weekday) opts.weekday = parsed.weekday;
    // Calendar-only chart labels and short-form date labels usually omit the year.
    if (!parsed.year) opts.year = undefined;
  } else if (target === 'formatDate') {
    if (parsed.month) opts.month = parsed.month;
    if (parsed.day) opts.day = parsed.day;
    if (parsed.weekday) opts.weekday = parsed.weekday;
    if (parsed.second) opts.second = parsed.second;
    // Only omit the year for chart category labels and compact timeline displays.
    if (!parsed.year && (isChart || context.includes('fmtTimelineDate'))) {
      opts.year = undefined;
    }
  } else if (target === 'formatTimeOnly') {
    if (parsed.second) opts.second = parsed.second;
  }

  Object.keys(opts).forEach(k => { if (opts[k] === undefined) delete opts[k]; });
  return Object.keys(opts).length ? opts : null;
}

function fmtReplacement(target, arg, options) {
  const optArg = options ? `, ${JSON.stringify(options)}` : '';
  return `FormatUtil.${target}(${arg}${optArg})`;
}

function classify(source, match) {
  const method = match[3];
  const arg = (match[1] || match[2]).trim();
  const optString = match[4];
  const ctxStart = Math.max(0, match.index - 160);
  const ctxEnd = Math.min(source.length, match.index + match[0].length + 160);
  const context = source.slice(ctxStart, ctxEnd);
  const funcName = detectFunctionName(source, match.index);

  if (SKIP_CONTEXT.test(context)) return { skip: true, reason: 'skip-context' };
  if (SKIP_ARGS.test(arg)) return { skip: true, reason: 'skip-arg' };

  const parsed = parseOptions(optString);

  // "Joined" fields are always date-only, even though their source column is created_at.
  const joinedContext =
    JOINED_CONTEXT.test(context) ||
    (JOINED_FUNCS.test(funcName) && /created_at/.test(arg));

  // Activity rows render separate date and time elements; keep the date part short.
  const activityRowDate =
    method === 'toLocaleDateString' &&
    /const\s+time\s*=[\s\S]{0,180}toLocaleTimeString/.test(context);

  // Plain toLocaleDateString defaults to a date-only display.
  let target = null;
  if (method === 'toLocaleTimeString') {
    target = 'formatTimeOnly';
  } else if (method === 'toLocaleString') {
    if (parsed.hour || parsed.minute) target = 'formatDate';
    else if (parsed.month || parsed.day || parsed.year) target = 'formatDateOnly';
    else target = 'formatDate';
  } else if (method === 'toLocaleDateString') {
    target = 'formatDateOnly';
  }

  // Upgrade event timestamps to full date+time unless context forces date-only.
  if (joinedContext || activityRowDate || DATE_ONLY_ARGS.test(arg)) {
    target = 'formatDateOnly';
  } else if (DATE_TIME_ARGS.test(arg) || (method === 'toLocaleString' && (parsed.hour || parsed.minute))) {
    target = method === 'toLocaleTimeString' ? 'formatTimeOnly' : 'formatDate';
  }

  const options = buildOptions(target, parsed, method, context);
  return { target, arg, options };
}

const displayDateTimeBlock =
  /const\s+displayDate\s*=\s*Number\.isNaN\(createdAt\.getTime\(\)\)\s*\?\s*['"]—['"]\s*:\s*createdAt\.toLocaleDateString\([^)]*\);\s*\n\s*const\s+displayTime\s*=\s*Number\.isNaN\(createdAt\.getTime\(\)\)\s*\?\s*['"]['"]\s*:\s*createdAt\.toLocaleTimeString\([^)]*\);/g;

const fmtTimelineBlock =
  /const\s+fmtTimelineDate\s*=\s*\(dt\)\s*=>\s*\{\s*\n\s*if\s*\(\!dt\s*\|\|\s*Number\.isNaN\(dt\.getTime\(\)\)\)\s*return\s*['"]['"];\s*\n\s*const\s+d\s*=\s*dt\.toLocaleDateString\([^)]*\);\s*\n\s*const\s+t\s*=\s*dt\.toLocaleTimeString\([^)]*\);\s*\n\s*return\s+[`"]\$\{d\},\s*\$\{t\}[`"];\s*\n\s*\};/g;

function processFile(fileRel) {
  const full = path.join(rootDir, fileRel);
  if (!fs.existsSync(full)) {
    log(`MISSING ${fileRel}`);
    return 0;
  }
  let source = fs.readFileSync(full, 'utf8');

  // Handle the two combined-date patterns atomically.
  let displayMatch = source.match(displayDateTimeBlock);
  if (displayMatch) {
    const newBlock = `const displayDate = Number.isNaN(createdAt.getTime()) ? '—' : FormatUtil.formatDate(createdAt);\n            const displayTime = '';`;
    source = source.replace(displayMatch[0], newBlock);
    log(`DRY ${fileRel}:${lineOf(source, source.indexOf(newBlock))} displayDate+displayTime combined`);
  }

  let fmtMatch = source.match(fmtTimelineBlock);
  if (fmtMatch) {
    const newBlock = `const fmtTimelineDate = (dt) => {\n                if (!dt || Number.isNaN(dt.getTime())) return '';\n                return FormatUtil.formatDate(dt, {"month":"short","day":"numeric","year":undefined});\n            };`;
    source = source.replace(fmtMatch[0], newBlock);
    log(`DRY ${fileRel}:${lineOf(source, source.indexOf(newBlock))} fmtTimelineDate combined`);
  }

  const matches = [];
  let m;
  while ((m = callRegex.exec(source)) !== null) {
    matches.push({ match: m, index: m.index });
  }
  matches.sort((a, b) => b.index - a.index);

  let total = 0;
  for (const { match } of matches) {
    const decision = classify(source, match);
    if (decision.skip) {
      log(`SKIP ${fileRel}:${lineOf(source, match.index)} ${decision.reason} | ${match[0].slice(0, 100).replace(/\n/g, '\\n')}`);
      continue;
    }
    const replacement = fmtReplacement(decision.target, decision.arg, decision.options);
    source = source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
    total++;
    log(`DRY ${fileRel}:${lineOf(source, match.index)}\n- ${match[0].replace(/\n/g, '\\n')}\n+ ${replacement}`);
  }

  if (APPLY && (total > 0 || displayMatch || fmtMatch)) {
    fs.writeFileSync(full, source, 'utf8');
  }
  return total;
}

const summary = {};
let total = 0;
for (const group of audit) {
  const file = group.file;
  if (skipFile(file)) {
    log(`SKIP_FILE ${file}`);
    continue;
  }
  const n = processFile(file);
  if (n) {
    summary[file] = n;
    total += n;
  }
}

log('\n--- summary ---');
log(JSON.stringify(summary, null, 2));
log(`Total matched call replacements: ${total}`);

fs.writeFileSync(path.join(rootDir, 'tmp', DRY_RUN ? 'dry-run-v6.log' : 'apply-v6.log'), LOG.join('\n'), 'utf8');
console.log('Wrote log to', DRY_RUN ? 'tmp/dry-run-v6.log' : 'tmp/apply-v6.log');
