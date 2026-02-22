const fs = require('fs');
const path = require('path');
try {
  const filePath = path.join(__dirname, '..', 'routes', 'products.js');
  const s = fs.readFileSync(filePath, 'utf8');
  new Function(s);
  console.log('products.js parsed OK');
} catch (err) {
  console.error('parse error:', err && err.stack ? err.stack : err);
  process.exitCode = 2;
}
