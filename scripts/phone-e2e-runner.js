require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const { chromium } = require('playwright');
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

function makeStorageState(token) {
  return {
    origins: [{
      origin: BASE_URL,
      localStorage: [{ name: 'token', value: token }]
    }]
  };
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

function attachNetworkLogger(page, logs) {
  page.on('console', msg => logs.push({ type: 'console', level: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));
  page.route('**/api/**', async route => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/api/events') || url.includes('/api/notifications') || url.includes('/sse')) {
      return await route.continue();
    }
    const postData = req.postData();
    const response = await route.fetch().catch(err => {
      return { status: 599, body: () => Buffer.from(`intercept error: ${err.message}`) };
    });
    const body = await response.body().catch(() => Buffer.from(''));
    logs.push({
      method: req.method(),
      url: req.url(),
      requestBody: postData,
      status: response.status(),
      responseBody: body.toString('utf-8').slice(0, 5000)
    });
    await route.fulfill({ response }).catch(() => route.continue());
  });
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function addResult(page, scenario, pass, details, evidence = {}) {
  results.push({ page, scenario, pass, details, evidence, time: new Date().toISOString() });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${page} | ${scenario}`);
}

async function verifyPhoneInput(page, inputId, pageName) {
  const input = page.locator(`#${inputId}`);
  const visible = await input.isVisible().catch(() => false);
  const placeholder = await input.getAttribute('placeholder').catch(() => null);
  const maxLength = await input.getAttribute('maxlength').catch(() => null);
  const type = await input.getAttribute('type').catch(() => null);
  const prefix = await page.locator(`.phone-input-wrapper:has(#${inputId}) .phone-prefix`).first().textContent().catch(() =>
    page.locator(`.input-group:has(#${inputId}) .input-group-text`).first().textContent().catch(() => null)
  );

  await input.fill('abc123+6309123456789xyz');
  await page.waitForTimeout(100);
  const val = await input.inputValue();
  const hasNonDigits = /[^\d\s]/.test(val);

  const checks = [
    ['input visible', visible],
    ['placeholder set', placeholder && placeholder.includes('9')],
    ['maxlength 12', maxLength === '12'],
    ['+63 prefix displayed', prefix && prefix.includes('+63')],
    ['only digits/spaces retained', !hasNonDigits && (val.replace(/\D/g, '').length > 0)]
  ];
  const all = checks.every(c => c[1]);
  addResult(pageName, `phone field checks for #${inputId}`, all, {
    visible, placeholder, maxLength, type, prefixText: prefix, valueAfterGarbage: val, checks
  });
  return all;
}

async function navigateToCustomerEditProfile(page) {
  await page.goto(`${BASE_URL}/customer-account.html`);
  await page.waitForSelector('a.sidebar-link[data-section="profile-edit"]', { state: 'visible', timeout: 15000 });
  await page.click('a.sidebar-link[data-section="profile-edit"]');
  await page.waitForSelector('#edit-profile-form', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('#edit-phone', { state: 'visible', timeout: 15000 });
}

async function fillCustomerEditProfileForm(page, phone) {
  await navigateToCustomerEditProfile(page);

  await page.fill('#edit-firstname', 'Test');
  await page.fill('#edit-lastname', 'Customer');
  await page.fill('#edit-phone', phone);

  // Zone -> Metro Manila to keep PSGC calls predictable
  await page.selectOption('#edit-zone', 'metro');
  await page.waitForFunction(() => {
    const province = document.getElementById('edit-province');
    return province && province.value === 'Metro Manila' && province.disabled;
  }, { timeout: 15000 });

  // Wait for city dropdown to load after province is set
  await page.waitForFunction(() => {
    const city = document.getElementById('edit-city');
    return city && city.options.length > 1 && !city.disabled;
  }, { timeout: 15000 });

  await page.selectOption('#edit-city', 'Caloocan');
  await page.waitForFunction(() => {
    const city = document.getElementById('edit-city');
    return city && city.value === 'Caloocan';
  }, { timeout: 5000 });

  // Wait for barangay dropdown to load after city is set
  await page.waitForFunction(() => {
    const barangay = document.getElementById('edit-barangay');
    return barangay && barangay.options.length > 1 && !barangay.disabled;
  }, { timeout: 15000 });

  await page.selectOption('#edit-barangay', 'Barangay 1');
  await page.waitForFunction(() => {
    const barangay = document.getElementById('edit-barangay');
    return barangay && barangay.value === 'Barangay 1';
  }, { timeout: 5000 });

  await page.fill('#edit-street', 'Test Street');

  // Verify form is valid before clicking Save
  const isValid = await page.evaluate(() => {
    const form = document.getElementById('edit-profile-form');
    if (!form) return false;
    const valid = form.checkValidity();
    // Log invalid fields for debugging
    if (!valid) {
      const invalid = Array.from(form.querySelectorAll(':invalid')).map(el => ({
        id: el.id,
        name: el.name,
        validationMessage: el.validationMessage,
        value: el.value
      }));
      console.log('Invalid fields:', invalid);
    }
    return valid;
  });
  if (!isValid) {
    throw new Error('Customer edit profile form is invalid after filling all required fields');
  }
  return isValid;
}

async function clickSaveAndCaptureResponse(page, logs, responseUrlPredicate) {
  const saveBtn = page.locator('#save-profile-btn');
  const [res] = await Promise.all([
    page.waitForResponse(responseUrlPredicate, { timeout: 15000 }),
    saveBtn.click()
  ]);
  const reqBody = res.request().postData() || '';
  const respBody = await res.body().catch(() => Buffer.from(''));
  return {
    status: res.status(),
    requestBody: reqBody,
    responseBody: respBody.toString('utf-8').slice(0, 5000),
    url: res.url()
  };
}

async function scenarioCustomerPhoneFieldChecks(page, logs) {
  const pageName = 'Customer Edit Profile';
  try {
    await navigateToCustomerEditProfile(page);
    await verifyPhoneInput(page, 'edit-phone', pageName);
  } catch (err) {
    const file = await screenshot(page, 'customer-edit-field-check-error');
    addResult(pageName, 'phone field checks for #edit-phone', false, { error: err.message, logs }, { screenshot: file });
  }
}

async function scenarioCustomerSaveNewPhone(page, phone, logs) {
  const pageName = 'Customer Edit Profile';
  try {
    await fillCustomerEditProfileForm(page, phone);
    const dbBefore = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const save = await clickSaveAndCaptureResponse(page, logs, resp =>
      resp.url().includes('/api/auth/profile') && resp.request().method() === 'PUT'
    );
    const dbAfter = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass = save.status === 200 && dbAfter.phone === phone && save.requestBody.includes(`"phone":"${phone}"`);
    addResult(pageName, 'save new phone A', pass, {
      phone,
      requestBody: save.requestBody,
      responseStatus: save.status,
      responseBody: save.responseBody,
      dbBefore: dbBefore.phone,
      dbAfter: dbAfter.phone
    });
    return pass;
  } catch (err) {
    const file = await screenshot(page, 'customer-edit-save-new-phone-error');
    addResult(pageName, 'save new phone A', false, { error: err.message, logs }, { screenshot: file });
    return false;
  }
}

async function scenarioCustomerSaveSamePhone(page, phone, logs) {
  const pageName = 'Customer Edit Profile';
  try {
    await fillCustomerEditProfileForm(page, phone);
    const save = await clickSaveAndCaptureResponse(page, logs, resp =>
      resp.url().includes('/api/auth/profile') && resp.request().method() === 'PUT'
    );
    const dbAfter = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass = save.status === 200 && dbAfter.phone === phone;
    addResult(pageName, 'save unchanged phone', pass, {
      phone,
      responseStatus: save.status,
      responseBody: save.responseBody,
      dbPhone: dbAfter.phone
    });
    return pass;
  } catch (err) {
    const file = await screenshot(page, 'customer-edit-save-same-phone-error');
    addResult(pageName, 'save unchanged phone', false, { error: err.message, logs }, { screenshot: file });
    return false;
  }
}

async function scenarioCustomerSaveDuplicatePhone(page, phoneA, duplicatePhone, logs) {
  const pageName = 'Customer Edit Profile';
  try {
    await fillCustomerEditProfileForm(page, duplicatePhone);
    const save = await clickSaveAndCaptureResponse(page, logs, resp =>
      (resp.url().includes('/api/auth/profile') && resp.request().method() === 'PUT') ||
      resp.url().includes('/api/auth/check-phone')
    );
    const dbAfter = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass = (save.status === 409 || save.status === 400) && dbAfter.phone === phoneA;
    addResult(pageName, 'save duplicate phone fails', pass, {
      duplicatePhone,
      responseStatus: save.status,
      responseBody: save.responseBody,
      dbPhone: dbAfter.phone
    });
    return pass;
  } catch (err) {
    const file = await screenshot(page, 'customer-edit-duplicate-phone-error');
    addResult(pageName, 'save duplicate phone fails', false, { error: err.message, logs }, { screenshot: file });
    return false;
  }
}

async function scenarioCustomerSaveNewPhoneAndRefresh(page, phone, logs) {
  const pageName = 'Customer Edit Profile';
  try {
    await fillCustomerEditProfileForm(page, phone);
    const save = await clickSaveAndCaptureResponse(page, logs, resp =>
      resp.url().includes('/api/auth/profile') && resp.request().method() === 'PUT'
    );
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForSelector('a.sidebar-link[data-section="profile-edit"]', { state: 'visible', timeout: 15000 });
    await page.click('a.sidebar-link[data-section="profile-edit"]');
    await page.waitForSelector('#edit-phone', { state: 'visible', timeout: 15000 });
    const displayedPhone = await page.locator('#edit-phone').inputValue();
    const dbAfter = (await runQuery('SELECT phone FROM users WHERE id = 103'))[0];
    const pass = save.status === 200 && dbAfter.phone === phone && displayedPhone.replace(/\D/g, '') === phone;
    addResult(pageName, 'save phone B and refresh preserves value', pass, {
      phone,
      displayedPhone,
      dbPhone: dbAfter.phone,
      responseStatus: save.status,
      responseBody: save.responseBody
    });
    return pass;
  } catch (err) {
    const file = await screenshot(page, 'customer-edit-refresh-phone-error');
    addResult(pageName, 'save phone B and refresh preserves value', false, { error: err.message, logs }, { screenshot: file });
    return false;
  }
}

async function testCustomerEditProfile() {
  const pageName = 'Customer Edit Profile';
  const logs = [];
  const data = await loginViaApi('testcustomer@test.com', 'Test123456');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: makeStorageState(data.token)
  });
  const page = await context.newPage();
  attachNetworkLogger(page, logs);

  try {
    const phoneA = await uniquePhone();
    const phoneB = await uniquePhone([phoneA]);
    const duplicatePhone = '9879678966'; // existing customer phone

    await scenarioCustomerPhoneFieldChecks(page, logs);
    await scenarioCustomerSaveNewPhone(page, phoneA, logs);
    await scenarioCustomerSaveSamePhone(page, phoneA, logs);
    await scenarioCustomerSaveDuplicatePhone(page, phoneA, duplicatePhone, logs);
    await scenarioCustomerSaveNewPhoneAndRefresh(page, phoneB, logs);
  } catch (err) {
    const file = await screenshot(page, 'customer-edit-overall-error');
    addResult(pageName, 'overall', false, { error: err.message, logs }, { screenshot: file });
  } finally {
    await runQuery('UPDATE users SET phone = NULL WHERE id = 103');
    await context.close();
    await browser.close();
  }
}

(async () => {
  try {
    await testCustomerEditProfile();
  } catch (err) {
    console.error('Runner fatal error:', err);
    addResult('Runner', 'fatal', false, { error: err.message });
  } finally {
    await pool.end();
    const out = path.join(__dirname, 'phone-e2e-results.json');
    fs.writeFileSync(out, JSON.stringify(results, null, 2));
    console.log('\nResults written to', out);
  }
})();
