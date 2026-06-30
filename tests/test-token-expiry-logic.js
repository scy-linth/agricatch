/**
 * Standalone test for JWT token expiration handling logic.
 * Does NOT require a running backend. Tests the pure logic
 * that was added to app.js, admin.js, and farmer.js.
 *
 * Run: node tests/test-token-expiry-logic.js
 */

const assert = require('assert');
const crypto = require('crypto');

// ── Helpers to create fake JWT tokens ──────────────────────────

function base64UrlEncode(obj) {
    const json = JSON.stringify(obj);
    return Buffer.from(json)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Create a fake JWT token with given payload.
 * The signature is fake but the payload is correctly encoded.
 */
function createFakeToken(payload) {
    const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
    const body = base64UrlEncode(payload);
    const sig = crypto.randomBytes(32).toString('base64url');
    return `${header}.${body}.${sig}`;
}

// ── Replicate decodeJwtPayload from app.js ────────────────────

function decodeJwtPayload(token) {
    try {
        if (!token) return null;
        const parts = String(token).split('.');
        if (parts.length < 2) return null;
        const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, 'base64').toString());
    } catch (_) {
        return null;
    }
}

// ── Replicate isTokenExpired from app.js ──────────────────────

function isTokenExpired(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return false; // no exp = treat as valid
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp < nowSec;
}

// ── Replicate normalizeAuthToken from app.js ──────────────────

function normalizeAuthToken(rawToken) {
    let token = String(rawToken || '').trim();
    if (!token) return null;
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        token = token.slice(1, -1).trim();
    }
    if (/^Bearer\s+/i.test(token)) {
        token = token.replace(/^Bearer\s+/i, '').trim();
    }
    if (!token || token === 'null' || token === 'undefined') return null;
    return token;
}

// ── Tests ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
        passed++;
    } catch (err) {
        console.log(`  \x1b[31mFAIL\x1b[0m ${name}`);
        console.log(`        ${err.message}`);
        failed++;
    }
}

console.log('\n=== JWT Token Expiration Logic Tests ===\n');

// --- decodeJwtPayload ---

console.log('decodeJwtPayload:');

test('decodes a valid JWT payload', () => {
    const token = createFakeToken({ id: 1, role: 'customer', exp: 9999999999 });
    const payload = decodeJwtPayload(token);
    assert.strictEqual(payload.id, 1);
    assert.strictEqual(payload.role, 'customer');
    assert.strictEqual(payload.exp, 9999999999);
});

test('returns null for empty token', () => {
    assert.strictEqual(decodeJwtPayload(null), null);
    assert.strictEqual(decodeJwtPayload(''), null);
    assert.strictEqual(decodeJwtPayload(undefined), null);
});

test('returns null for malformed token', () => {
    assert.strictEqual(decodeJwtPayload('not.a.jwt.token.at.all'), null);
    assert.strictEqual(decodeJwtPayload('onlyonepart'), null);
});

// --- isTokenExpired ---

console.log('\nisTokenExpired:');

test('returns true for expired token', () => {
    const expiredToken = createFakeToken({
        id: 1,
        role: 'customer',
        exp: Math.floor(Date.now() / 1000) - 3600 // expired 1 hour ago
    });
    assert.strictEqual(isTokenExpired(expiredToken), true);
});

test('returns false for valid (non-expired) token', () => {
    const validToken = createFakeToken({
        id: 1,
        role: 'customer',
        exp: Math.floor(Date.now() / 1000) + 3600 // expires in 1 hour
    });
    assert.strictEqual(isTokenExpired(validToken), false);
});

test('returns false for token with no exp field', () => {
    const noExpToken = createFakeToken({ id: 1, role: 'customer' });
    assert.strictEqual(isTokenExpired(noExpToken), false);
});

test('returns false for null/empty token (no payload to decode)', () => {
    // isTokenExpired calls decodeJwtPayload which returns null,
    // then returns false because !payload
    assert.strictEqual(isTokenExpired(null), false);
    assert.strictEqual(isTokenExpired(''), false);
});

// --- normalizeAuthToken ---

console.log('\nnormalizeAuthToken:');

test('returns null for empty/null/undefined', () => {
    assert.strictEqual(normalizeAuthToken(null), null);
    assert.strictEqual(normalizeAuthToken(''), null);
    assert.strictEqual(normalizeAuthToken(undefined), null);
});

test('returns null for string "null" and "undefined"', () => {
    assert.strictEqual(normalizeAuthToken('null'), null);
    assert.strictEqual(normalizeAuthToken('undefined'), null);
});

test('strips surrounding quotes', () => {
    assert.strictEqual(normalizeAuthToken('"abc123"'), 'abc123');
    assert.strictEqual(normalizeAuthToken("'abc123'"), 'abc123');
});

test('strips Bearer prefix', () => {
    assert.strictEqual(normalizeAuthToken('Bearer abc123'), 'abc123');
    assert.strictEqual(normalizeAuthToken('bearer abc123'), 'abc123');
});

test('returns token as-is for normal token', () => {
    assert.strictEqual(normalizeAuthToken('abc123'), 'abc123');
});

// --- Simulated checkAuthStatus logic ---

console.log('\ncheckAuthStatus logic (simulated):');

test('expired token → guest menu (token cleared)', () => {
    const expiredToken = createFakeToken({
        id: 1,
        role: 'customer',
        exp: Math.floor(Date.now() / 1000) - 3600
    });

    // Simulate checkAuthStatus
    let token = normalizeAuthToken(expiredToken);
    let showGuestMenu = false;
    let showUserMenu = false;
    let tokenCleared = false;

    if (token && !isTokenExpired(token)) {
        showUserMenu = true;
    } else {
        if (token) {
            token = null;
            tokenCleared = true;
        }
        showGuestMenu = true;
    }

    assert.strictEqual(showUserMenu, false, 'should NOT show user menu');
    assert.strictEqual(showGuestMenu, true, 'should show guest menu');
    assert.strictEqual(tokenCleared, true, 'token should be cleared');
});

test('valid token → user menu (no clearing)', () => {
    const validToken = createFakeToken({
        id: 1,
        role: 'customer',
        exp: Math.floor(Date.now() / 1000) + 3600
    });

    let token = normalizeAuthToken(validToken);
    let showGuestMenu = false;
    let showUserMenu = false;
    let tokenCleared = false;

    if (token && !isTokenExpired(token)) {
        showUserMenu = true;
    } else {
        if (token) {
            token = null;
            tokenCleared = true;
        }
        showGuestMenu = true;
    }

    assert.strictEqual(showUserMenu, true, 'should show user menu');
    assert.strictEqual(showGuestMenu, false, 'should NOT show guest menu');
    assert.strictEqual(tokenCleared, false, 'token should NOT be cleared');
});

test('no token → guest menu (no clearing needed)', () => {
    let token = normalizeAuthToken(null);
    let showGuestMenu = false;
    let showUserMenu = false;
    let tokenCleared = false;

    if (token && !isTokenExpired(token)) {
        showUserMenu = true;
    } else {
        if (token) {
            token = null;
            tokenCleared = true;
        }
        showGuestMenu = true;
    }

    assert.strictEqual(showUserMenu, false, 'should NOT show user menu');
    assert.strictEqual(showGuestMenu, true, 'should show guest menu');
    assert.strictEqual(tokenCleared, false, 'no token to clear');
});

// --- Simulated admin.js / farmer.js constructor logic ---

console.log('\nadmin.js / farmer.js constructor logic (simulated):');

test('expired token → redirect to login', () => {
    const expiredToken = createFakeToken({
        id: 1,
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) - 3600
    });

    let token = expiredToken; // admin.js uses localStorage.getItem directly
    let shouldRedirect = false;
    let redirectUrl = '';

    if (!token) {
        shouldRedirect = true;
        redirectUrl = '/?login=1';
    } else {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                shouldRedirect = true;
                redirectUrl = '/?login=1&reason=expired_token';
            }
        } catch (_) {
            shouldRedirect = true;
            redirectUrl = '/?login=1&reason=invalid_token';
        }
    }

    assert.strictEqual(shouldRedirect, true, 'should redirect');
    assert.strictEqual(redirectUrl, '/?login=1&reason=expired_token');
});

test('valid token → no redirect (proceed to init)', () => {
    const validToken = createFakeToken({
        id: 1,
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600
    });

    let token = validToken;
    let shouldRedirect = false;

    if (!token) {
        shouldRedirect = true;
    } else {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                shouldRedirect = true;
            }
        } catch (_) {
            shouldRedirect = true;
        }
    }

    assert.strictEqual(shouldRedirect, false, 'should NOT redirect');
});

test('malformed token → redirect with invalid_token reason', () => {
    let token = 'not-a-valid-jwt';
    let shouldRedirect = false;
    let redirectUrl = '';

    if (!token) {
        shouldRedirect = true;
        redirectUrl = '/?login=1';
    } else {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                shouldRedirect = true;
                redirectUrl = '/?login=1&reason=expired_token';
            }
        } catch (_) {
            shouldRedirect = true;
            redirectUrl = '/?login=1&reason=invalid_token';
        }
    }

    assert.strictEqual(shouldRedirect, true, 'should redirect');
    assert.strictEqual(redirectUrl, '/?login=1&reason=invalid_token');
});

test('no token → redirect to login (original behavior preserved)', () => {
    let token = null;
    let shouldRedirect = false;
    let redirectUrl = '';

    if (!token) {
        shouldRedirect = true;
        redirectUrl = '/?login=1';
    }

    assert.strictEqual(shouldRedirect, true, 'should redirect');
    assert.strictEqual(redirectUrl, '/?login=1');
});

// --- Edge cases ---

console.log('\nEdge cases:');

test('token exp exactly equal to now → expired (boundary)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createFakeToken({ id: 1, exp: now });
    // exp < nowSec → false at exact boundary, which means "not expired"
    // This matches the implementation: payload.exp < nowSec
    assert.strictEqual(isTokenExpired(token), false, 'exp == now should NOT be expired (< not <=)');
});

test('token exp 1 second ago → expired', () => {
    const token = createFakeToken({
        id: 1,
        exp: Math.floor(Date.now() / 1000) - 1
    });
    assert.strictEqual(isTokenExpired(token), true);
});

test('token exp 1 second in future → not expired', () => {
    const token = createFakeToken({
        id: 1,
        exp: Math.floor(Date.now() / 1000) + 1
    });
    assert.strictEqual(isTokenExpired(token), false);
});

// --- Summary ---

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
