/**
 * Smoke test for Forgot Password routes.
 * Run:
 *   node test-forgot-password-route.js you@example.com
 */

const http = require('http');

const email = process.argv[2] || 'nonexistent@example.com';

function post(path, body) {
  const data = JSON.stringify(body);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', (chunk) => (buf += chunk));
      res.on('end', () => {
        let parsed = buf;
        try {
          parsed = JSON.parse(buf);
        } catch (_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Testing Forgot Password routes...');
  console.log('Email:', email);

  const r1 = await post('/api/auth/forgot', { email });
  console.log('\nPOST /api/auth/forgot');
  console.log('Status:', r1.status);
  console.log('Body:', r1.body);

  const r2 = await post('/api/auth/forgot/resend', { email });
  console.log('\nPOST /api/auth/forgot/resend');
  console.log('Status:', r2.status);
  console.log('Body:', r2.body);

  const r3 = await post('/api/auth/forgot/verify-otp', { email, otp: '000000' });
  console.log('\nPOST /api/auth/forgot/verify-otp (expected fail)');
  console.log('Status:', r3.status);
  console.log('Body:', r3.body);

  console.log('\n✅ Routes respond (200/429/400 expected).');
})().catch((e) => {
  console.error('\n❌ Request failed:', e.message);
  console.log('Make sure the server is running on port 3000');
  process.exit(1);
});
