/**
 * Complete a password reset using the dev-visible OTP, then remove test user and resets.
 * Usage: node scripts/complete-reset-and-cleanup.js email@example.com NewPassword123!
 */
const http = require('http');
require('dotenv').config();
const { Pool } = require('pg');

const email = process.argv[2];
const newPassword = process.argv[3] || 'NewPass123!';
if (!email) {
  console.error('Usage: node scripts/complete-reset-and-cleanup.js <email> [newPassword]');
  process.exit(2);
}

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
        try { parsed = JSON.parse(buf); } catch (e) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    console.log('Requesting OTP via /api/auth/forgot for', email);
    const r1 = await post('/api/auth/forgot', { email });
    console.log('forgot status:', r1.status, 'body:', r1.body);

    const otp = r1.body?.debugOtp;
    if (!otp) {
      console.error('No debugOtp returned. Ensure DEV_SHOW_PASSWORD_RESET_OTP=true or check email. Aborting.');
      process.exit(1);
    }

    console.log('Using dev OTP:', otp);
    const v = await post('/api/auth/forgot/verify-otp', { email, otp });
    console.log('verify status:', v.status, 'body:', v.body);

    if (v.status !== 200) {
      console.error('Verification failed, aborting reset.');
      process.exit(1);
    }

    const r = await post('/api/auth/forgot/reset', { email, otp, newPassword });
    console.log('reset status:', r.status, 'body:', r.body);

    // Cleanup: remove password_resets and user entry
    const pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'agriculture_marketplace',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });

    const delResets = await pool.query('DELETE FROM password_resets WHERE email = $1', [email.toLowerCase()]);
    const delUsers = await pool.query('DELETE FROM users WHERE email = $1 RETURNING id', [email.toLowerCase()]);
    console.log('Cleanup: deleted password_resets rows:', delResets.rowCount, 'deleted users:', delUsers.rowCount);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error during complete/reset/cleanup:', err.message || err);
    process.exit(1);
  }
})();
