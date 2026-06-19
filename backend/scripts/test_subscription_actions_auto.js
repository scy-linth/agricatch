require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');

// Auto-test script for subscription approve/reject/expire endpoints
// This script logs in as admin to get a token, then tests the endpoints

const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';

async function getAdminToken() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });

    const data = await response.json();
    if (response.ok && data.token) {
      console.log('✅ Admin login successful');
      return data.token;
    } else {
      console.log('❌ Admin login failed:', data.message || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

async function getSubscriptionId(token) {
  try {
    const response = await fetch('http://localhost:3000/api/admin/subscriptions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (response.ok && data.subscriptions && data.subscriptions.length > 0) {
      // Get first subscription
      const sub = data.subscriptions[0];
      console.log(`✅ Found subscription: ${sub.id} (status: ${sub.status})`);
      return sub.id;
    } else {
      console.log('❌ No subscriptions found');
      return null;
    }
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return null;
  }
}

async function testAction(token, subscriptionId, action) {
  try {
    console.log(`\n--- Testing ${action.toUpperCase()} ---`);
    const url = `http://localhost:3000/api/admin/subscriptions/${subscriptionId}/${action}`;
    const body = (action === 'reject' || action === 'expire') ? JSON.stringify({ reason: 'Test from auto-script' }) : undefined;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });

    const bodyText = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${bodyText}`);

    if (response.ok) {
      console.log(`✅ ${action.toUpperCase()} successful`);
      return true;
    } else {
      console.log(`❌ ${action.toUpperCase()} failed`);
      return false;
    }
  } catch (error) {
    console.error(`Error testing ${action}:`, error);
    return false;
  }
}

async function main() {
  console.log('=== Subscription Actions Auto-Test ===\n');

  // Step 1: Get admin token
  const token = await getAdminToken();
  if (!token) {
    console.log('\n❌ Cannot proceed without admin token');
    console.log('Tip: Set TEST_ADMIN_USERNAME and TEST_ADMIN_PASSWORD environment variables');
    process.exit(1);
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`Token verified for user: ${decoded.username} (${decoded.role})`);
  } catch (e) {
    console.log('❌ Token verification failed');
    process.exit(1);
  }

  // Step 2: Get a subscription ID
  const subscriptionId = await getSubscriptionId(token);
  if (!subscriptionId) {
    console.log('\n❌ Cannot proceed without a subscription');
    process.exit(1);
  }

  // Step 3: Test actions based on subscription status
  const response = await fetch('http://localhost:3000/api/admin/subscriptions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  const subscription = data.subscriptions.find(s => s.id === subscriptionId);
  const status = subscription?.status || 'unknown';

  console.log(`\nSubscription status: ${status}`);

  let results = [];

  if (status === 'pending') {
    // Test approve
    results.push(await testAction(token, subscriptionId, 'approve'));
  } else if (status === 'active') {
    // Test expire
    results.push(await testAction(token, subscriptionId, 'expire'));
  } else {
    console.log('\n⚠️  Subscription is not in a testable state (pending or active)');
    console.log('Please create a new pending subscription to test approve/reject');
    console.log('Or set an active subscription to test expire');
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

main();
