const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET;

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function generateUniquePhone() {
  const suffix = Math.floor(100000000 + Math.random() * 899999999);
  return `9${suffix.toString().slice(0, 9)}`;
}

// ---- Unit tests for the shared helper ----

const helperSource = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'utils', 'phoneValidation.js'),
  'utf8'
);

function runNormalizePhone(phone) {
  // Evaluate the helper in a tiny sandbox so we don't require the full backend.
  const exports = {};
  const module = { exports };
  const fn = new Function('module', 'exports', helperSource);
  fn(module, module.exports);
  return module.exports.normalizePhone(phone);
}

test('normalizePhone accepts 10 digits starting with 9', () => {
  assert.equal(runNormalizePhone('9123456789'), '9123456789');
});

test('normalizePhone normalizes spaces only', () => {
  assert.equal(runNormalizePhone('912 345 6789'), '9123456789');
});

test('normalizePhone rejects letters', () => {
  assert.equal(runNormalizePhone('9123456789a'), null);
  assert.equal(runNormalizePhone('abcdefghij'), null);
});

test('normalizePhone rejects hyphens and special chars', () => {
  assert.equal(runNormalizePhone('912-345-6789'), null);
  assert.equal(runNormalizePhone('912@3456789'), null);
  assert.equal(runNormalizePhone('912#3456789'), null);
});

test('normalizePhone rejects +63 prefix', () => {
  assert.equal(runNormalizePhone('+639123456789'), null);
});

test('normalizePhone rejects leading 0', () => {
  assert.equal(runNormalizePhone('09123456789'), null);
});

test('normalizePhone rejects too few or too many digits', () => {
  assert.equal(runNormalizePhone('91234567'), null);
  assert.equal(runNormalizePhone('9123456789012'), null);
});

test('normalizePhone accepts undefined/null as invalid', () => {
  assert.equal(runNormalizePhone(undefined), null);
  assert.equal(runNormalizePhone(null), null);
});

// ---- API integration helpers ----

async function api(method, endpoint, body = undefined, token = undefined) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(`${BASE_URL}${endpoint}`, opts);
}

// Reuse test accounts from TEST-ACCOUNTS.md (by fixed IDs)
const TOKENS = {
  admin: makeToken({ id: 43, username: 'testadmin', role: 'admin' }),
  superadmin: makeToken({ id: 5, username: 'scy_linth', role: 'super_admin' }),
  farmer: makeToken({ id: 42, username: 'testfarmer', role: 'farmer' }),
  customer: makeToken({ id: 103, username: 'testcustomer', role: 'customer' }),
};

// ---- Invalid format tests (no DB mutations) ----

const invalidPhones = [
  { phone: '9123456789a', label: 'with letter' },
  { phone: '912-345-6789', label: 'with hyphens' },
  { phone: '912@3456789', label: 'with @' },
  { phone: '912#3456789', label: 'with #' },
  { phone: '+639123456789', label: 'with +63' },
  { phone: '09123456789', label: 'with leading 0' },
];

for (const { phone, label } of invalidPhones) {
  test(`POST /api/auth/check-phone rejects ${label}: ${phone}`, async () => {
    const res = await api('POST', '/api/auth/check-phone', { phone });
    assert.equal(res.status, 400);
  });
}

test('POST /api/auth/check-phone accepts spaces and returns available', async () => {
  const res = await api('POST', '/api/auth/check-phone', { phone: '912 345 6789' });
  const status = res.status;
  // Could be 200 (available) or 409 (already registered); either means validation passed.
  assert.ok(status === 200 || status === 409, `unexpected status: ${status}`);
});

// ---- PUT /api/auth/profile ----

test('PUT /api/auth/profile rejects phone with +63', async () => {
  const res = await api('PUT', '/api/auth/profile', { phone: '+639123456789' }, TOKENS.customer);
  assert.equal(res.status, 400);
});

test('PUT /api/auth/profile accepts own phone with spaces and stores only 10 digits', async () => {
  // Find the customer's current phone
  const current = await pool.query('SELECT phone FROM users WHERE id = $1', [103]);
  const ownPhone = current.rows[0]?.phone;
  if (ownPhone) {
    const res = await api('PUT', '/api/auth/profile', { phone: ownPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') }, TOKENS.customer);
    assert.equal(res.status, 200);
    const row = await pool.query('SELECT phone FROM users WHERE id = $1', [103]);
    assert.equal(row.rows[0].phone, ownPhone, 'database must store only the normalized 10-digit local number');
  }
});

test('PUT /api/auth/profile rejects phone already in use by another user', async () => {
  const otherPhone = (await pool.query("SELECT phone FROM users WHERE id <> $1 AND phone IS NOT NULL AND phone ~ '^9\\\\d{9}$' LIMIT 1", [103])).rows[0]?.phone;
  if (otherPhone) {
    const res = await api('PUT', '/api/auth/profile', { phone: otherPhone }, TOKENS.customer);
    assert.equal(res.status, 409);
  }
});

// ---- POST /api/admin/users ----

let createdAdminUserId = null;
let createdPhone = null;

test('POST /api/admin/users rejects phone with +63', async () => {
  const res = await api('POST', '/api/admin/users', {
    username: `phone-test-admin-${Date.now()}`,
    email: `phone-test-admin-${Date.now()}@agricatch.invalid`,
    password: 'TestPass123!',
    first_name: 'Phone',
    last_name: 'Test',
    role: 'customer',
    phone: '+639123456789'
  }, TOKENS.admin);
  const text = await res.text();
  assert.equal(res.status, 400, `expected 400, got ${res.status}: ${text}`);
});

// Self-healing setup: create the admin test user if it does not already exist
async function ensureAdminTestUser() {
  if (!createdAdminUserId) {
    createdPhone = generateUniquePhone();
    const res = await api('POST', '/api/admin/users', {
      username: `phone-test-preset-${Date.now()}`,
      email: `phone-test-preset-${Date.now()}@agricatch.invalid`,
      password: 'TestPass123!',
      first_name: 'Phone',
      last_name: 'Test',
      role: 'customer',
      phone: createdPhone
    }, TOKENS.admin);
    const text = await res.text();
    if (res.status === 201) {
      const data = JSON.parse(text);
      createdAdminUserId = data.user?.id;
    } else {
      console.warn('Could not preset admin test user:', res.status, text);
    }
  }
}

test('POST /api/admin/users accepts valid phone and stores 10 digits', async () => {
  createdPhone = generateUniquePhone();
  const res = await api('POST', '/api/admin/users', {
    username: `phone-test-${Date.now()}`,
    email: `phone-test-${Date.now()}@agricatch.invalid`,
    password: 'TestPass123!',
    first_name: 'Phone',
    last_name: 'Test',
    role: 'customer',
    phone: createdPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')
  }, TOKENS.admin);
  const text = await res.text();
  assert.equal(res.status, 201, `expected 201, got ${res.status}: ${text}`);
  const data = JSON.parse(text);
  createdAdminUserId = data.user?.id;
  const row = await pool.query('SELECT phone FROM users WHERE id = $1', [createdAdminUserId]);
  assert.equal(row.rows[0].phone, createdPhone, 'database must store only the 10-digit local number');
  await ensureAdminTestUser();
});

test('POST /api/admin/users rejects duplicate phone', async () => {
  const res = await api('POST', '/api/admin/users', {
    username: `phone-test-2-${Date.now()}`,
    email: `phone-test-2-${Date.now()}@agricatch.invalid`,
    password: 'TestPass123!',
    first_name: 'Phone',
    last_name: 'Test',
    role: 'customer',
    phone: createdPhone
  }, TOKENS.admin);
  assert.equal(res.status, 409);
});

// ---- PUT /api/admin/users/:id ----

test('PUT /api/admin/users/:id accepts own phone and rejects +63', async () => {
  await ensureAdminTestUser();
  assert.ok(createdAdminUserId, 'prerequisite admin user not created');

  const resOwn = await api('PUT', `/api/admin/users/${createdAdminUserId}`, { phone: createdPhone }, TOKENS.admin);
  const ownText = await resOwn.text();
  assert.equal(resOwn.status, 200, `expected 200 for own phone, got ${resOwn.status}: ${ownText}`);

  const resInvalid = await api('PUT', `/api/admin/users/${createdAdminUserId}`, { phone: '+639123456789' }, TOKENS.admin);
  assert.equal(resInvalid.status, 400);
});

// ---- POST /api/superadmin/users ----

let createdSuperadminUserId = null;
let createdSuperadminPhone = null;

test('POST /api/superadmin/users rejects phone with symbols', async () => {
  const res = await api('POST', '/api/superadmin/users', {
    username: `phone-test-sa-${Date.now()}`,
    email: `phone-test-sa-${Date.now()}@agricatch.invalid`,
    password: 'TestPass123!',
    first_name: 'Phone',
    last_name: 'Test',
    role: 'customer',
    phone: '912-345-6789'
  }, TOKENS.superadmin);
  assert.equal(res.status, 400);
});

test('POST /api/superadmin/users accepts valid phone and stores 10 digits', async () => {
  createdSuperadminPhone = generateUniquePhone();
  const res = await api('POST', '/api/superadmin/users', {
    username: `phone-test-sa2-${Date.now()}`,
    email: `phone-test-sa2-${Date.now()}@agricatch.invalid`,
    password: 'TestPass123!',
    first_name: 'Phone',
    last_name: 'Test',
    role: 'customer',
    phone: createdSuperadminPhone
  }, TOKENS.superadmin);
  const text = await res.text();
  assert.equal(res.status, 201, `expected 201, got ${res.status}: ${text}`);
  const data = JSON.parse(text);
  createdSuperadminUserId = data.user?.id;
  const row = await pool.query('SELECT phone FROM users WHERE id = $1', [createdSuperadminUserId]);
  assert.equal(row.rows[0].phone, createdSuperadminPhone, 'database must store only the 10-digit local number');
});

// ---- PUT /api/superadmin/users/:id ----

test('PUT /api/superadmin/users/:id accepts own phone and rejects leading 0', async () => {
  assert.ok(createdSuperadminUserId, 'prerequisite superadmin user not created');

  const resOwn = await api('PUT', `/api/superadmin/users/${createdSuperadminUserId}`, { phone: createdSuperadminPhone }, TOKENS.superadmin);
  const ownText = await resOwn.text();
  assert.equal(resOwn.status, 200, `expected 200 for own phone, got ${resOwn.status}: ${ownText}`);

  const resInvalid = await api('PUT', `/api/superadmin/users/${createdSuperadminUserId}`, { phone: '09123456789' }, TOKENS.superadmin);
  assert.equal(resInvalid.status, 400);
});

// ---- PUT /api/farmers/profile ----

test('PUT /api/farmers/profile rejects phone with @ symbol', async () => {
  const res = await api('PUT', '/api/farmers/profile', { phone: '912@3456789' }, TOKENS.farmer);
  assert.equal(res.status, 400);
});

test('PUT /api/farmers/profile accepts valid phone and stores 10 digits', async () => {
  const current = await pool.query('SELECT phone FROM users WHERE id = $1', [42]);
  const ownPhone = current.rows[0]?.phone;
  if (ownPhone) {
    const res = await api('PUT', '/api/farmers/profile', { phone: ownPhone }, TOKENS.farmer);
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${await res.text()}`);
    const row = await pool.query('SELECT phone FROM users WHERE id = $1', [42]);
    assert.equal(row.rows[0].phone, ownPhone, 'database must store only the 10-digit local number');
  }
});

// ---- Cleanup ----

test('cleanup: remove test users', async () => {
  if (createdAdminUserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [createdAdminUserId]);
  }
  if (createdSuperadminUserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [createdSuperadminUserId]);
  }
  await pool.end();
});
