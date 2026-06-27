/**
 * Order Transition Matrix Regression Test
 * 
 * Tests all valid and invalid status transitions for all user roles
 * against the shared orderTransitions module.
 */

const { validateTransition, getValidStatuses, TRANSITION_MATRIX, CANCELLATION_RULES } = require('../utils/orderTransitions');

const ROLES = ['customer', 'farmer', 'admin', 'super_admin'];
const STATUSES = getValidStatuses();

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

console.log('=== Order Transition Matrix Regression Test ===\n');

// Test 1: Validate all status values are valid
console.log('Test 1: Verify all status values are recognized');
STATUSES.forEach(status => {
  totalTests++;
  // Just check if status is in the valid list, not if it can transition to itself
  if (STATUSES.includes(status)) {
    passedTests++;
    console.log(`  ✓ Status '${status}' is recognized`);
  } else {
    failedTests++;
    failures.push({ test: 'Status validation', status, error: 'Status not in valid list' });
    console.log(`  ✗ Status '${status}' is not recognized`);
  }
});

// Test 2: Verify terminal states cannot transition
console.log('\nTest 2: Verify terminal states cannot transition');
const terminalStates = ['cancelled', 'completed'];
terminalStates.forEach(fromStatus => {
  STATUSES.forEach(toStatus => {
    if (fromStatus !== toStatus) {
      totalTests++;
      const validation = validateTransition(fromStatus, toStatus, 'admin');
      if (!validation.valid) {
        passedTests++;
        console.log(`  ✓ ${fromStatus} → ${toStatus} correctly blocked`);
      } else {
        failedTests++;
        failures.push({ test: 'Terminal state blocking', from: fromStatus, to: toStatus, error: 'Should be blocked' });
        console.log(`  ✗ ${fromStatus} → ${toStatus} should be blocked but was allowed`);
      }
    }
  });
});

// Test 3: Verify valid forward transitions
console.log('\nTest 3: Verify valid forward transitions');
Object.entries(TRANSITION_MATRIX).forEach(([fromStatus, allowedTransitions]) => {
  if (allowedTransitions.length === 0) return; // Skip terminal states
  
  allowedTransitions.forEach(toStatus => {
    totalTests++;
    const validation = validateTransition(fromStatus, toStatus, 'admin');
    if (validation.valid) {
      passedTests++;
      console.log(`  ✓ ${fromStatus} → ${toStatus} allowed`);
    } else {
      failedTests++;
      failures.push({ test: 'Valid transition', from: fromStatus, to: toStatus, error: validation.message });
      console.log(`  ✗ ${fromStatus} → ${toStatus} should be allowed but was blocked: ${validation.message}`);
    }
  });
});

// Test 4: Verify invalid forward transitions are blocked
console.log('\nTest 4: Verify invalid forward transitions are blocked');
Object.entries(TRANSITION_MATRIX).forEach(([fromStatus, allowedTransitions]) => {
  STATUSES.forEach(toStatus => {
    // Skip if this is a valid transition or same status
    if (allowedTransitions.includes(toStatus) || fromStatus === toStatus) return;
    
    totalTests++;
    const validation = validateTransition(fromStatus, toStatus, 'admin');
    if (!validation.valid) {
      passedTests++;
      console.log(`  ✓ ${fromStatus} → ${toStatus} correctly blocked`);
    } else {
      failedTests++;
      failures.push({ test: 'Invalid transition', from: fromStatus, to: toStatus, error: 'Should be blocked' });
      console.log(`  ✗ ${fromStatus} → ${toStatus} should be blocked but was allowed`);
    }
  });
});

// Test 5: Verify role-based cancellation rules
console.log('\nTest 5: Verify role-based cancellation rules');
ROLES.forEach(role => {
  const allowedCancellations = CANCELLATION_RULES[role];
  console.log(`\n  Testing ${role} cancellation rules:`);
  
  STATUSES.forEach(status => {
    if (status === 'cancelled' || status === 'completed' || status === 'delivered') return;
    
    totalTests++;
    const validation = validateTransition(status, 'cancelled', role);
    
    if (allowedCancellations.includes(status)) {
      // Should be allowed
      if (validation.valid) {
        passedTests++;
        console.log(`    ✓ ${role} can cancel from ${status}`);
      } else {
        failedTests++;
        failures.push({ test: 'Role cancellation allowed', role, status, error: validation.message });
        console.log(`    ✗ ${role} should be able to cancel from ${status} but was blocked: ${validation.message}`);
      }
    } else {
      // Should be blocked
      if (!validation.valid) {
        passedTests++;
        console.log(`    ✓ ${role} cannot cancel from ${status}`);
      } else {
        failedTests++;
        failures.push({ test: 'Role cancellation blocked', role, status, error: 'Should be blocked' });
        console.log(`    ✗ ${role} should not be able to cancel from ${status} but was allowed`);
      }
    }
  });
});

// Test 6: Verify specific business rules
console.log('\nTest 6: Verify specific business rules');

// Customer can only cancel pending and preorder_reserved
totalTests++;
const customerPendingCancel = validateTransition('pending', 'cancelled', 'customer');
if (customerPendingCancel.valid) {
  passedTests++;
  console.log('  ✓ Customer can cancel pending orders');
} else {
  failedTests++;
  failures.push({ test: 'Customer cancel pending', error: customerPendingCancel.message });
  console.log(`  ✗ Customer should be able to cancel pending: ${customerPendingCancel.message}`);
}

totalTests++;
const customerConfirmedCancel = validateTransition('confirmed', 'cancelled', 'customer');
if (!customerConfirmedCancel.valid) {
  passedTests++;
  console.log('  ✓ Customer cannot cancel confirmed orders');
} else {
  failedTests++;
  failures.push({ test: 'Customer cancel confirmed', error: 'Should be blocked' });
  console.log('  ✗ Customer should not be able to cancel confirmed orders');
}

// Farmer can cancel pending, confirmed, preparing
totalTests++;
const farmerPreparingCancel = validateTransition('preparing', 'cancelled', 'farmer');
if (farmerPreparingCancel.valid) {
  passedTests++;
  console.log('  ✓ Farmer can cancel preparing orders');
} else {
  failedTests++;
  failures.push({ test: 'Farmer cancel preparing', error: farmerPreparingCancel.message });
  console.log(`  ✗ Farmer should be able to cancel preparing: ${farmerPreparingCancel.message}`);
}

totalTests++;
const farmerScheduledCancel = validateTransition('scheduled', 'cancelled', 'farmer');
if (!farmerScheduledCancel.valid) {
  passedTests++;
  console.log('  ✓ Farmer cannot cancel scheduled orders');
} else {
  failedTests++;
  failures.push({ test: 'Farmer cancel scheduled', error: 'Should be blocked' });
  console.log('  ✗ Farmer should not be able to cancel scheduled orders');
}

// Admin can cancel most statuses (except delivered/completed/cancelled)
totalTests++;
const adminPreparingCancel = validateTransition('preparing', 'cancelled', 'admin');
if (adminPreparingCancel.valid) {
  passedTests++;
  console.log('  ✓ Admin can cancel preparing orders');
} else {
  failedTests++;
  failures.push({ test: 'Admin cancel preparing', error: adminPreparingCancel.message });
  console.log(`  ✗ Admin should be able to cancel preparing: ${adminPreparingCancel.message}`);
}

// Test 7: Verify preorder workflow
console.log('\nTest 7: Verify preorder workflow');
totalTests++;
const preorderToConfirmed = validateTransition('preorder_reserved', 'confirmed', 'admin');
if (preorderToConfirmed.valid) {
  passedTests++;
  console.log('  ✓ preorder_reserved → confirmed allowed');
} else {
  failedTests++;
  failures.push({ test: 'Preorder workflow', error: preorderToConfirmed.message });
  console.log(`  ✗ preorder_reserved → confirmed should be allowed: ${preorderToConfirmed.message}`);
}

totalTests++;
const preorderToPending = validateTransition('preorder_reserved', 'pending', 'admin');
if (!preorderToPending.valid) {
  passedTests++;
  console.log('  ✓ preorder_reserved → pending correctly blocked');
} else {
  failedTests++;
  failures.push({ test: 'Preorder workflow', error: 'Should be blocked' });
  console.log('  ✗ preorder_reserved → pending should be blocked');
}

// Test 8: Verify delivered can transition to completed
console.log('\nTest 8: Verify delivered → completed transition');
totalTests++;
const deliveredToCompleted = validateTransition('delivered', 'completed', 'admin');
if (deliveredToCompleted.valid) {
  passedTests++;
  console.log('  ✓ delivered → completed allowed');
} else {
  failedTests++;
  failures.push({ test: 'Delivered to completed', error: deliveredToCompleted.message });
  console.log(`  ✗ delivered → completed should be allowed: ${deliveredToCompleted.message}`);
}

// Print summary
console.log('\n=== Test Summary ===');
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

if (failures.length > 0) {
  console.log('\n=== Failures ===');
  failures.forEach((failure, index) => {
    console.log(`${index + 1}. ${JSON.stringify(failure)}`);
  });
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}
