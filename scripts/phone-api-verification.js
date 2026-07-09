require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'phone-e2e-screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

const results = [];

async function runQuery(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

function addResult(page, scenario, pass, details, evidence = {}) {
  results.push({ page, scenario, pass, details, evidence, time: new Date().toISOString() });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${page} | ${scenario}`);
}

async function loginViaApi(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.message || res.status}`);
  return data;
}

async function uniquePhone(exclude = []) {
  for (let i = 0; i < 100; i++) {
    const suffix = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const phone = '9' + suffix;
    const exists = await runQuery(
      `SELECT 1 FROM users WHERE phone = $1 UNION SELECT 1 FROM user_addresses WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    if (exists.length === 0 && !exclude.includes(phone)) return phone;
  }
  throw new Error('Could not generate unique phone');
}

async function testCustomerProfileApi() {
  const pageName = 'Customer Profile API';
  try {
    const data = await loginViaApi('testcustomer@test.com', 'Test123456');
    const phoneA = await uniquePhone();
    const phoneB = await uniquePhone([phoneA]);
    const duplicatePhone = '9879678966'; // existing customer phone

    // Test 1: Update profile with new phone
    const dbBefore = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const res1 = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        first_name: 'Test',
        middle_name: null,
        last_name: 'Customer',
        phone: phoneA
      })
    });
    const data1 = await res1.json();
    const dbAfter1 = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass1 = res1.status === 200 && dbAfter1.phone === phoneA && data1.user?.phone === phoneA;
    addResult(pageName, 'update profile with new phone', pass1, {
      phone: phoneA,
      requestPhone: phoneA,
      responsePhone: data1.phone,
      dbBefore: dbBefore.phone,
      dbAfter: dbAfter1.phone,
      status: res1.status,
      response: data1
    });

    // Test 2: Update profile with same phone
    const res2 = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        first_name: 'Test',
        middle_name: null,
        last_name: 'Customer',
        phone: phoneA
      })
    });
    const data2 = await res2.json();
    const dbAfter2 = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass2 = res2.status === 200 && dbAfter2.phone === phoneA;
    addResult(pageName, 'update profile with same phone', pass2, {
      phone: phoneA,
      dbAfter: dbAfter2.phone,
      status: res2.status,
      response: data2
    });

    // Test 3: Update profile with duplicate phone
    const res3 = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        first_name: 'Test',
        middle_name: null,
        last_name: 'Customer',
        phone: duplicatePhone
      })
    });
    const data3 = await res3.json();
    const dbAfter3 = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass3 = (res3.status === 409 || res3.status === 400) && dbAfter3.phone === phoneA;
    addResult(pageName, 'update profile with duplicate phone fails', pass3, {
      duplicatePhone,
      dbAfter: dbAfter3.phone,
      status: res3.status,
      response: data3
    });

    // Test 4: Update profile with new phone B
    const res4 = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        first_name: 'Test',
        middle_name: null,
        last_name: 'Customer',
        phone: phoneB
      })
    });
    const data4 = await res4.json();
    const dbAfter4 = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass4 = res4.status === 200 && dbAfter4.phone === phoneB && data4.user?.phone === phoneB;
    addResult(pageName, 'update profile with new phone B', pass4, {
      phone: phoneB,
      requestPhone: phoneB,
      responsePhone: data4.phone,
      dbAfter: dbAfter4.phone,
      status: res4.status,
      response: data4
    });

    // Reset
    await runQuery('UPDATE users SET phone = NULL WHERE id = 103');
    addResult(pageName, 'reset test data', true, { dbPhone: 'NULL' });
  } catch (err) {
    addResult(pageName, 'overall', false, { error: err.message });
  }
}

async function testPhoneCheckApi() {
  const pageName = 'Phone Check API';
  try {
    const phoneA = await uniquePhone();
    const duplicatePhone = '9879678966'; // existing customer phone

    // Test 1: Check available phone
    const res1 = await fetch(`${BASE_URL}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneA })
    });
    const data1 = await res1.json();
    const pass1 = res1.status === 200 && data1.available === true;
    addResult(pageName, 'check available phone', pass1, {
      phone: phoneA,
      status: res1.status,
      response: data1
    });

    // Test 2: Check duplicate phone
    const res2 = await fetch(`${BASE_URL}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: duplicatePhone })
    });
    const data2 = await res2.json();
    const pass2 = res2.status === 409;
    addResult(pageName, 'check duplicate phone fails', pass2, {
      phone: duplicatePhone,
      status: res2.status,
      response: data2
    });

    // Test 3: Check phone with userId (exclude self)
    const data = await loginViaApi('testcustomer@test.com', 'Test123456');
    const phoneC = await uniquePhone();
    await runQuery('UPDATE users SET phone = $1 WHERE id = 103', [phoneC]);
    const res3 = await fetch(`${BASE_URL}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneC, userId: 103 })
    });
    const data3 = await res3.json();
    const pass3 = res3.status === 200 && data3.available === true;
    addResult(pageName, 'check own phone with userId', pass3, {
      phone: phoneC,
      userId: 103,
      status: res3.status,
      response: data3
    });

    // Reset
    await runQuery('UPDATE users SET phone = NULL WHERE id = 103');
  } catch (err) {
    addResult(pageName, 'overall', false, { error: err.message });
  }
}

async function testPhoneFormatValidation() {
  const pageName = 'Phone Format Validation';
  try {
    const invalidPhones = [
      '1234567890', // doesn't start with 9
      '912345678', // only 9 digits
      '912345678901', // 12 digits
      '9123456789a', // contains letter
      '+639123456789', // with +63 prefix
      '09123456789' // with 0 prefix
    ];

    for (const phone of invalidPhones) {
      const res = await fetch(`${BASE_URL}/api/auth/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      const pass = res.status === 400;
      addResult(pageName, `reject invalid phone: ${phone}`, pass, {
        phone,
        status: res.status,
        response: data
      });
    }

    // Test valid phone
    const validPhone = await uniquePhone();
    const resValid = await fetch(`${BASE_URL}/api/auth/check-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: validPhone })
    });
    const dataValid = await resValid.json();
    const passValid = resValid.status === 200 && dataValid.available === true;
    addResult(pageName, `accept valid phone: ${validPhone}`, passValid, {
      phone: validPhone,
      status: resValid.status,
      response: dataValid
    });
  } catch (err) {
    addResult(pageName, 'overall', false, { error: err.message });
  }
}

async function testDatabaseStorage() {
  const pageName = 'Database Storage';
  try {
    const phone = await uniquePhone();
    const data = await loginViaApi('testcustomer@test.com', 'Test123456');

    // Update profile with phone
    await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        first_name: 'Test',
        middle_name: null,
        last_name: 'Customer',
        phone: phone
      })
    });

    // Check database storage
    const dbRow = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass = dbRow.phone === phone && dbRow.phone.length === 10 && dbRow.phone.startsWith('9');
    addResult(pageName, 'database stores 10-digit local number', pass, {
      sentPhone: phone,
      storedPhone: dbRow.phone,
      length: dbRow.phone?.length,
      startsWith9: dbRow.phone?.startsWith('9')
    });

    // Reset
    await runQuery('UPDATE users SET phone = NULL WHERE id = 103');
  } catch (err) {
    addResult(pageName, 'overall', false, { error: err.message });
  }
}

(async () => {
  try {
    await testCustomerProfileApi();
    await testPhoneCheckApi();
    await testPhoneFormatValidation();
    await testDatabaseStorage();
  } catch (err) {
    console.error('Runner fatal error:', err);
    addResult('Runner', 'fatal', false, { error: err.message });
  } finally {
    await pool.end();
    const out = path.join(__dirname, 'phone-api-verification-results.json');
    fs.writeFileSync(out, JSON.stringify(results, null, 2));
    console.log('\nResults written to', out);
  }
})();
