require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');

// Test script for subscription approve/reject/expire endpoints
// Usage: node backend/scripts/test_subscription_actions.js <subscription_id> <action>
// Actions: approve, reject, expire

const subscriptionId = process.argv[2];
const action = process.argv[3];

if (!subscriptionId || !action) {
  console.log('Usage: node backend/scripts/test_subscription_actions.js <subscription_id> <action>');
  console.log('Actions: approve, reject, expire');
  process.exit(1);
}

// You need to provide a valid admin token
// Get this from localStorage token in your browser admin panel
const token = process.env.TEST_TOKEN || 'YOUR_ADMIN_TOKEN_HERE';

if (token === 'YOUR_ADMIN_TOKEN_HERE') {
  console.log('ERROR: Please set TEST_TOKEN environment variable or edit this script with a valid admin token');
  console.log('Get the token from localStorage in your browser console: localStorage.getItem("token")');
  process.exit(1);
}

async function testSubscriptionAction() {
  try {
    // Decode token to verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    console.log(`Testing ${action} for subscription: ${subscriptionId}`);
    console.log('---');

    const url = `http://localhost:3000/api/admin/subscriptions/${subscriptionId}/${action}`;
    const body = action === 'reject' || action === 'expire' ? JSON.stringify({ reason: 'Test from script' }) : undefined;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });

    console.log(`Response status: ${response.status}`);
    const bodyText = await response.text();
    console.log('Response body:', bodyText);

    if (response.ok) {
      console.log('\n✅ SUCCESS: Subscription action completed without errors');
    } else {
      console.log('\n❌ FAILED: Subscription action returned error');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\n❌ FAILED: Request failed with exception');
  }
}

testSubscriptionAction();
