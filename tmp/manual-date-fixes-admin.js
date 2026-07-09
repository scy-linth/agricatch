const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'frontend', 'js', 'admin.js');
let s = fs.readFileSync(file, 'utf8');

// Helpers to build replacement strings without double-escaping issues.
const dateOnlyShort = `{ month: "short", day: "numeric" }`;
const dateOnlyShortNoYear = `{ month: "short", day: "numeric", year: undefined }`;
const dateShort = `{ month: "short", day: "numeric" }`;

function report(label, count) {
  console.log(`${label}: ${count} replacements`);
}

// 1. Joined table cells: user.created_at, f.created_at, farmer.created_at -> Date Only.
[
  ['user.created_at', dateOnlyShort],
  ['f.created_at', dateOnlyShort],
  ['farmer.created_at', dateOnlyShort],
].forEach(([arg, opts]) => {
  const rx = new RegExp(`FormatUtil\\.formatDate\\(${arg},\\s*\\{"month":"short","day":"numeric"\\}\\)`, 'g');
  const repl = `FormatUtil.formatDateOnly(${arg}, ${opts})`;
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`${arg} Joined fix`, m ? m.length : 0);
});

// 2. Activity widget row date should be Date Only (short, no year because time is shown separately).
{
  const arg = 'entry.created_at';
  const rx = new RegExp(`FormatUtil\\.formatDate\\(${arg},\\s*\\{"month":"short","day":"numeric"\\}\\)`, 'g');
  const repl = `FormatUtil.formatDateOnly(${arg}, ${dateOnlyShortNoYear})`;
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`entry.created_at activity row fix`, m ? m.length : 0);
}

// 3. Product table "Created" label (createdAt) should be Date + Time, not Date Only.
{
  const rx = /FormatUtil\.formatDateOnly\(createdAt,\s*\{"month":"short","day":"numeric"\}\)/g;
  const repl = `FormatUtil.formatDate(createdAt, ${dateShort})`;
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`createdAt product created fix`, m ? m.length : 0);
}

// 4. Multi-line Activity Monitor "Last Updated" time-only footer.
{
  const rx = /lastUpdated\.textContent\s*=\s*`Last Updated:\s*\$\{now\.toLocaleTimeString\('en-PH',\s*\{\s*hour:\s*'2-digit',\s*minute:\s*'2-digit',\s*second:\s*'2-digit',\s*hour12:\s*true\s*\}\)\}`/gs;
  const repl = "lastUpdated.textContent = `Last Updated: ${FormatUtil.formatTimeOnly(now, { second: '2-digit' })}`";
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`Last Updated footer fix`, m ? m.length : 0);
}

// 5. Multi-line activity row with separate `time` and `date` variables.
{
  const rx = /const\s+time\s*=\s*new\s+Date\(activity\.timestamp\)\.toLocaleTimeString\('en-PH',\s*\{\s*hour:\s*'2-digit',\s*minute:\s*'2-digit',\s*second:\s*'2-digit',\s*hour12:\s*true\s*\}\);\s*\n\s*const\s+date\s*=\s*new\s+Date\(activity\.timestamp\)\.toLocaleDateString\('en-PH',\s*\{\s*month:\s*'short',\s*day:\s*'numeric'\s*\}\);/g;
  const repl = `const time = FormatUtil.formatTimeOnly(activity.timestamp, { second: '2-digit' });\n            const date = FormatUtil.formatDateOnly(activity.timestamp, ${dateOnlyShortNoYear});`;
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`activity row time+date fix`, m ? m.length : 0);
}

// 6. Multi-line activity details modal timestamp.
{
  const rx = /document\.getElementById\('am-detail-timestamp'\)\.textContent\s*=\s*new\s+Date\(activity\.timestamp\)\.toLocaleString\('en-PH',\s*\{\s*timeZone:\s*'Asia\/Manila',\s*year:\s*'numeric',\s*month:\s*'short',\s*day:\s*'numeric',\s*hour:\s*'2-digit',\s*minute:\s*'2-digit',\s*second:\s*'2-digit',\s*hour12:\s*true\s*\}\);/g;
  const repl = `document.getElementById('am-detail-timestamp').textContent = FormatUtil.formatDate(activity.timestamp, { month: 'short', day: 'numeric', second: '2-digit' });`;
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`am-detail-timestamp fix`, m ? m.length : 0);
}

// 7. Multi-line session timeline time.
{
  const rx = /const\s+time\s*=\s*new\s+Date\(item\.created_at\s*\|\|\s*item\.timestamp\)\.toLocaleTimeString\('en-PH',\s*\{\s*hour:\s*'2-digit',\s*minute:\s*'2-digit',\s*hour12:\s*true\s*\}\);/g;
  const repl = `const time = FormatUtil.formatTimeOnly(item.created_at || item.timestamp);`;
  const m = s.match(rx);
  s = s.replace(rx, repl);
  report(`session timeline time fix`, m ? m.length : 0);
}

fs.writeFileSync(file, s, 'utf8');
console.log('Wrote manual fixes to frontend/js/admin.js');
