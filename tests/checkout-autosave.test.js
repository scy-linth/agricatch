// Test for checkout auto-save functionality
const assert = require('assert');

// Mock localStorage for testing
class LocalStorageMock {
    constructor() {
        this.store = {};
    }

    getItem(key) {
        return this.store[key] || null;
    }

    setItem(key, value) {
        this.store[key] = String(value);
    }

    removeItem(key) {
        delete this.store[key];
    }

    clear() {
        this.store = {};
    }
}

// Mock CheckoutPage class for testing
class TestCheckoutPage {
    constructor(token) {
        this.token = token;
        this.checkoutStorageKey = this.getCheckoutStorageKey();
        this.selectedAddress = null;
    }

    getCheckoutStorageKey() {
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const userId = payload.user_id || payload.id || payload.sub;
            return userId ? `checkout_draft_${userId}` : null;
        } catch (error) {
            console.error('Error getting user ID from token:', error);
            return null;
        }
    }

    saveDraftCheckoutInfo(firstname, middlename, lastname, phone, specialInstructions, address) {
        if (!this.checkoutStorageKey) return;

        const checkoutInfo = {
            firstname,
            middlename,
            lastname,
            phone,
            specialInstructions,
            address: this.selectedAddress,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(this.checkoutStorageKey, JSON.stringify(checkoutInfo));
            return true;
        } catch (error) {
            console.error('Error saving draft checkout info:', error);
            return false;
        }
    }

    loadSavedCheckoutInfo() {
        if (!this.checkoutStorageKey) return null;

        try {
            const savedData = localStorage.getItem(this.checkoutStorageKey);
            if (!savedData) return null;

            return JSON.parse(savedData);
        } catch (error) {
            console.error('Error loading saved checkout info:', error);
            return null;
        }
    }

    clearDraftCheckoutInfo() {
        if (!this.checkoutStorageKey) return false;
        try {
            localStorage.removeItem(this.checkoutStorageKey);
            return true;
        } catch (error) {
            console.error('Error clearing draft checkout info:', error);
            return false;
        }
    }
}

// Setup mock localStorage
global.localStorage = new LocalStorageMock();

// Test 1: Storage key generation
console.log('Test 1: Storage key generation');
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjMsInJvbGUiOiJjdXN0b21lciJ9.signature';
const checkoutPage = new TestCheckoutPage(mockToken);
assert.strictEqual(checkoutPage.checkoutStorageKey, 'checkout_draft_123', 'Storage key should be checkout_draft_123');
console.log('✓ Storage key generated correctly');

// Test 2: Save draft checkout info
console.log('\nTest 2: Save draft checkout info');
const saveResult = checkoutPage.saveDraftCheckoutInfo(
    'Juan',
    'Santos',
    'Dela Cruz',
    '912 345 6789',
    'Leave at gate',
    '123 Main St, Barangay 1, Manila, Metro Manila'
);
assert.strictEqual(saveResult, true, 'Save should return true');
console.log('✓ Draft info saved successfully');

// Test 3: Load saved checkout info
console.log('\nTest 3: Load saved checkout info');
const loadedInfo = checkoutPage.loadSavedCheckoutInfo();
assert.strictEqual(loadedInfo.firstname, 'Juan', 'First name should match');
assert.strictEqual(loadedInfo.middlename, 'Santos', 'Middle name should match');
assert.strictEqual(loadedInfo.lastname, 'Dela Cruz', 'Last name should match');
assert.strictEqual(loadedInfo.phone, '912 345 6789', 'Phone should match');
assert.strictEqual(loadedInfo.specialInstructions, 'Leave at gate', 'Special instructions should match');
assert.ok(loadedInfo.savedAt, 'Saved timestamp should exist');
console.log('✓ Draft info loaded successfully');

// Test 4: Clear draft checkout info
console.log('\nTest 4: Clear draft checkout info');
const clearResult = checkoutPage.clearDraftCheckoutInfo();
assert.strictEqual(clearResult, true, 'Clear should return true');
const afterClear = checkoutPage.loadSavedCheckoutInfo();
assert.strictEqual(afterClear, null, 'No data should remain after clear');
console.log('✓ Draft info cleared successfully');

// Test 5: Handle invalid token
console.log('\nTest 5: Handle invalid token');
const invalidCheckoutPage = new TestCheckoutPage('invalid.token');
assert.strictEqual(invalidCheckoutPage.checkoutStorageKey, null, 'Storage key should be null for invalid token');
console.log('✓ Invalid token handled correctly (error caught as expected)');

// Test 6: User-specific storage isolation
console.log('\nTest 6: User-specific storage isolation');
const user1Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiY3VzdG9tZXIifQ.signature';
const user2Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJyb2xlIjoiY3VzdG9tZXIifQ.signature';
const user1Checkout = new TestCheckoutPage(user1Token);
const user2Checkout = new TestCheckoutPage(user2Token);

user1Checkout.saveDraftCheckoutInfo('User1', '', 'One', '911 111 1111', '', null);
user2Checkout.saveDraftCheckoutInfo('User2', '', 'Two', '922 222 2222', '', null);

const user1Data = user1Checkout.loadSavedCheckoutInfo();
const user2Data = user2Checkout.loadSavedCheckoutInfo();

assert.strictEqual(user1Data.firstname, 'User1', 'User 1 data should be isolated');
assert.strictEqual(user2Data.firstname, 'User2', 'User 2 data should be isolated');
assert.notStrictEqual(user1Data.phone, user2Data.phone, 'User data should not overlap');
console.log('✓ User-specific storage isolation works correctly');

console.log('\n✅ All tests passed!');
