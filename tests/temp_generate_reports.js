const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'agri_fishery_market_secret_key_2024_make_this_more_secure_in_production';
const BASE_URL = 'http://localhost:3000';

const tokens = {
  admin: jwt.sign({ id: 43, username: 'testadmin', role: 'admin', full_name: 'Test Admin', email: 'testadmin@test.com' }, JWT_SECRET, { expiresIn: '1h' }),
  farmer: jwt.sign({ id: 42, username: 'testfarmer', role: 'farmer', full_name: 'Test Farmer', email: 'testfarmer@test.com' }, JWT_SECRET, { expiresIn: '1h' })
};

const endpoints = [
  { name: 'Admin_Dashboard', url: '/api/admin/dashboard/export.xlsx', token: tokens.admin },
  { name: 'Admin_Orders', url: '/api/admin/orders/export.xlsx', token: tokens.admin },
  { name: 'Admin_Users', url: '/api/admin/users/export.xlsx', token: tokens.admin },
  { name: 'Farmer_Dashboard', url: '/api/farmers/me/metrics/export.xlsx', token: tokens.farmer },
  { name: 'Farmer_Orders', url: '/api/farmers/me/orders/export.xlsx', token: tokens.farmer }
];

const outDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function download(url, token, filePath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = new URL(url);
    const req = client.request({
      hostname: options.hostname,
      port: options.port,
      path: options.pathname + options.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => reject(new Error(`Status ${res.statusCode}: ${body}`)));
        return;
      }
      const file = fs.createWriteStream(filePath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  for (const ep of endpoints) {
    const url = `${BASE_URL}${ep.url}`;
    const filePath = path.join(outDir, `${ep.name}_Report.xlsx`);
    try {
      await download(url, ep.token, filePath);
      console.log(`✓ ${ep.name} saved to ${filePath}`);
    } catch (e) {
      console.error(`✗ ${ep.name} failed: ${e.message}`);
    }
  }
}

main();
