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

async function runQuery(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function uniquePhone(exclude = []) {
  for (let i = 0; i < 100; i++) {
    const suffix = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const phone = '9' + suffix;
    const exists = await runQuery(
      'SELECT 1 FROM users WHERE phone = $1 UNION SELECT 1 FROM user_addresses WHERE phone = $1 LIMIT 1',
      [phone]
    );
    if (exists.length === 0 && !exclude.includes(phone)) return phone;
  }
  throw new Error('Could not generate unique phone');
}

async function loginViaApi(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${data.message || res.status}`);
  return data;
}

function makeStorageState(token) {
  return {
    origins: [{
      origin: BASE_URL,
      localStorage: [{ name: 'token', value: token }]
    }]
  };
}

(async () => {
  const data = await loginViaApi('testcustomer@test.com', 'Test123456');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: makeStorageState(data.token)
  });
  const page = await context.newPage();

  const phoneA = await uniquePhone();
  const diag = [];

  page.on('console', msg => diag.push({ type: 'console', level: msg.type(), text: msg.text() }));
  page.on('pageerror', err => diag.push({ type: 'pageerror', text: err.message }));

  await page.goto(`${BASE_URL}/customer-account.html`);
  await page.waitForTimeout(2500);
  await page.click('a.sidebar-link[data-section="profile-edit"]');
  await page.waitForTimeout(800);

  // Fill in values
  await page.fill('#edit-firstname', 'Test');
  await page.fill('#edit-lastname', 'Customer');
  await page.fill('#edit-phone', phoneA);
  await page.waitForTimeout(200);

  // Inspect form validity and validation state
  const validity = await page.evaluate(() => {
    const form = document.getElementById('edit-profile-form');
    const fields = {};
    ['edit-firstname', 'edit-middlename', 'edit-lastname', 'edit-phone', 'edit-zone', 'edit-province', 'edit-city', 'edit-barangay', 'edit-street'].forEach(id => {
      const el = document.getElementById(id);
      fields[id] = el ? {
        value: el.value,
        validity: el.validity ? {
          valid: el.validity.valid,
          valueMissing: el.validity.valueMissing,
          patternMismatch: el.validity.patternMismatch,
          tooLong: el.validity.tooLong,
          typeMismatch: el.validity.typeMismatch
        } : null,
        validationMessage: el.validationMessage || null,
        required: el.required,
        disabled: el.disabled,
        checkValidity: el.checkValidity ? el.checkValidity() : null
      } : null;
    });
    return {
      formCheckValidity: form ? form.checkValidity() : null,
      fields,
      activeElement: document.activeElement?.id || document.activeElement?.tagName,
      saveBtnExists: !!document.getElementById('save-profile-btn'),
      saveBtnDisabled: document.getElementById('save-profile-btn')?.disabled,
      saveBtnText: document.getElementById('save-profile-btn')?.textContent?.trim()
    };
  });
  diag.push({ type: 'formValidity', data: validity });

  // Add instrumentation to detect whether submit fires and whether saveProfile is called
  await page.evaluate(() => {
    const form = document.getElementById('edit-profile-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        window.submitFired = true;
        window.submitDefaultPrevented = e.defaultPrevented;
      }, { capture: true });
    }
    const ca = window.customerAccount;
    if (ca) {
      const orig = ca.saveProfile.bind(ca);
      ca.saveProfile = async function(e) {
        window.saveProfileCalled = true;
        const keys = ['edit-firstname','edit-middlename','edit-lastname','edit-phone','edit-zone','edit-province','edit-city','edit-barangay','edit-street'];
        window.saveProfileInputs = {};
        keys.forEach(k => { const el = document.getElementById(k); window.saveProfileInputs[k] = el ? el.value : null; });
        try {
          const result = await orig(e);
          window.saveProfileResult = { status: 'completed' };
          return result;
        } catch (err) {
          window.saveProfileResult = { status: 'threw', message: err.message };
          throw err;
        }
      };
    }
  });

  // Click save button and wait briefly
  await page.click('#save-profile-btn');
  await page.waitForTimeout(3000);

  // Gather post-click state
  const post = await page.evaluate(() => ({
    submitFired: window.submitFired || false,
    submitDefaultPrevented: window.submitDefaultPrevented || false,
    saveProfileCalled: window.saveProfileCalled || false,
    saveProfileInputs: window.saveProfileInputs || null,
    saveProfileResult: window.saveProfileResult || null,
    toastMessage: document.querySelector('.toast.show, .toast-message, #toast-stack, .admin-toast-stack')?.textContent?.trim().slice(0, 500) || null,
    activeElement: document.activeElement?.id || document.activeElement?.tagName,
    phoneValue: document.getElementById('edit-phone')?.value
  }));
  diag.push({ type: 'postClickState', data: post });

  // Screenshot
  const shot = path.join(SCREENSHOT_DIR, 'customer-edit-blocker-diag.png');
  await page.screenshot({ path: shot });

  // Query DB for phone
  const dbPhone = await runQuery('SELECT phone FROM users WHERE id = 103');
  diag.push({ type: 'dbPhone', data: dbPhone[0] });

  await page.close();
  await browser.close();
  await pool.end();

  const outFile = path.join(__dirname, 'profile-save-blocker-diag.json');
  fs.writeFileSync(outFile, JSON.stringify({ phoneA, validity, post, diag, screenshot: shot }, null, 2));
  console.log('Diagnostic written to', outFile);
  console.log('Phone tested:', phoneA);
  console.log('Form validity:', validity);
  console.log('Post click:', post);
})();
