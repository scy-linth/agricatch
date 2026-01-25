/**
 * OTP system test script
 * Run: node scripts/test-otp.js
 * Ensure backend server is running on port 3000 first.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const API_BASE = 'http://localhost:3000/api';
const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agri_fishery_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: pgSsl,
});

async function run() {
  console.log('\n=== OTP System Test ===\n');

  const email = `otp-test-${Date.now()}@example.com`;
  const purpose = 'register';

  // 1. Send OTP
  console.log('1. Sending OTP (register)...');
  let sendRes;
  try {
    sendRes = await fetch(`${API_BASE}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose }),
    });
  } catch (e) {
    console.error('   FAIL: Cannot reach server. Is it running on port 3000?', e.message);
    process.exit(1);
  }

  const sendData = await sendRes.json();
  if (!sendRes.ok) {
    console.error('   FAIL: Send OTP failed.', sendData.message || sendData);
    if (sendData.error) console.error('   Error:', sendData.error);
    process.exit(1);
  }
  console.log('   OK:', sendData.message);

  // 2. Fetch OTP from DB
  console.log('2. Fetching OTP from database...');
  let rows;
  try {
    const r = await pool.query(
      `SELECT otp_code FROM otps WHERE email = $1 AND purpose = $2 AND is_used = false ORDER BY created_at DESC LIMIT 1`,
      [email, purpose]
    );
    rows = r.rows;
  } catch (e) {
    console.error('   FAIL: Database error.', e.message);
    await pool.end();
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.error('   FAIL: No OTP found in database for', email);
    await pool.end();
    process.exit(1);
  }
  const otp = rows[0].otp_code;
  console.log('   OK: OTP retrieved (hidden in production): ******');

  // 3. Verify OTP
  console.log('3. Verifying OTP...');
  let verifyRes;
  try {
    verifyRes = await fetch(`${API_BASE}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, purpose }),
    });
  } catch (e) {
    console.error('   FAIL: Verify request failed.', e.message);
    await pool.end();
    process.exit(1);
  }

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) {
    console.error('   FAIL: Verify failed.', verifyData.message || verifyData);
    await pool.end();
    process.exit(1);
  }
  if (!verifyData.verified) {
    console.error('   FAIL: Verify response missing verified: true');
    await pool.end();
    process.exit(1);
  }
  console.log('   OK:', verifyData.message);

  await pool.end();
  console.log('\n=== All OTP tests passed ===\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
