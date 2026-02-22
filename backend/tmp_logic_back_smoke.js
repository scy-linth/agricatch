const fs = require('fs');

const appSrc = fs.readFileSync('D:/Program Files/Coding/imtired/frontend/js/app.js', 'utf8');
const ordersSrc = fs.readFileSync('D:/Program Files/Coding/imtired/frontend/js/orders.js', 'utf8');

const checks = [];
checks.push(['app buildOrdersUrl includes returnPath', /buildOrdersUrl\([\s\S]*params\.set\('returnPath'/.test(appSrc)]);
checks.push(['app buildOrdersUrl includes resumeScrollY', /buildOrdersUrl\([\s\S]*params\.set\('resumeScrollY'/.test(appSrc)]);
checks.push(['orders reads returnPath param', /this\.returnPath\s*=\s*this\.normalizeReturnPath\(params\.get\('returnPath'\)/.test(ordersSrc)]);
checks.push(['orders reads resumeScrollY param', /this\.resumeScrollY\s*=\s*Number\(params\.get\('resumeScrollY'\)\)/.test(ordersSrc)]);
checks.push(['orders back href composes returnPath + query + returnTo', /nextHref\s*=\s*`\$\{this\.returnPath\}\$\{query \? `\?\$\{query\}` : ''\}\$\{this\.returnTo\}`/.test(ordersSrc)]);
checks.push(['my-account drag guard flag present', /_myAccountModalDownInside/.test(appSrc)]);
checks.push(['my-account selection guard present', /hasSelection/.test(appSrc)]);

for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`);
}

const allPass = checks.every(([, pass]) => pass);
console.log(`LOGIC_BACK_SMOKE: ${allPass ? 'PASS' : 'FAIL'}`);
process.exit(allPass ? 0 : 1);
