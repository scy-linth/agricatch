const https = require('https');

const url = process.env.PING_URL || process.env.RENDER_EXTERNAL_URL || 'https://api.agricatch.store';
const path = process.env.PING_PATH || '/_health';
const fullUrl = url.replace(/\/+$/, '') + path;

function ping() {
  console.log(`[self-ping] Pinging ${fullUrl}`);
  https.get(fullUrl, (res) => {
    console.log(`[self-ping] Status: ${res.statusCode}`);
    res.on('data', () => {});
    res.on('end', () => {
      process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1);
    });
  }).on('error', (err) => {
    console.error('[self-ping] Error:', err.message);
    process.exit(2);
  });
}

ping();
