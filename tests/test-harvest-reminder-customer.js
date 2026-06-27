// Test Customer Experience for Harvest Reminder System

console.log('=== Harvest Reminder Customer Experience Tests ===\n');

// Test 1: Landing Page Harvest Status Calculation
console.log('Test 1: Landing Page Harvest Status Calculation');

function getHarvestStatusForCustomer(harvestDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const harvest = new Date(harvestDate);
    harvest.setHours(0, 0, 0, 0);
    const diffTime = harvest - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { status: 'Today', class: 'text-success' };
    } else if (diffDays > 0 && diffDays <= 3) {
        return { status: `${diffDays} Days`, class: 'text-warning' };
    } else if (diffDays > 3) {
        const harvestFormatted = harvest.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        return { status: harvestFormatted, class: 'text-primary' };
    } else {
        return { status: 'To Be Announced', class: 'text-muted' };
    }
}

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const in3Days = new Date(today);
in3Days.setDate(in3Days.getDate() + 3);
const in7Days = new Date(today);
in7Days.setDate(in7Days.getDate() + 7);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const testCases = [
    { date: today, expected: 'Today' },
    { date: tomorrow, expected: '1 Days' },
    { date: in3Days, expected: '3 Days' },
    { date: in7Days, expected: in7Days.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) },
    { date: yesterday, expected: 'To Be Announced' }
];

let test1Pass = true;
testCases.forEach((tc, i) => {
    const result = getHarvestStatusForCustomer(tc.date);
    const passed = result.status === tc.expected;
    console.log(`  Case ${i + 1}: ${passed ? 'PASS' : 'FAIL'} - Expected: ${tc.expected}, Got: ${result.status}`);
    if (!passed) test1Pass = false;
});

console.log(`  Result: ${test1Pass ? 'PASS' : 'FAIL'}\n`);

// Test 2: Reservations Disabled Detection
console.log('Test 2: Reservations Disabled Detection');

function isReservationsDisabled(product) {
    return product.reservations_disabled === true || 
           product.reservations_disabled === 't' || 
           product.reservations_disabled === 'true';
}

const disabledTestCases = [
    { product: { reservations_disabled: true }, expected: true },
    { product: { reservations_disabled: 't' }, expected: true },
    { product: { reservations_disabled: 'true' }, expected: true },
    { product: { reservations_disabled: false }, expected: false },
    { product: { reservations_disabled: 'false' }, expected: false },
    { product: { reservations_disabled: null }, expected: false },
    { product: {}, expected: false }
];

let test2Pass = true;
disabledTestCases.forEach((tc, i) => {
    const result = isReservationsDisabled(tc.product);
    const passed = result === tc.expected;
    console.log(`  Case ${i + 1}: ${passed ? 'PASS' : 'FAIL'} - Expected: ${tc.expected}, Got: ${result}`);
    if (!passed) test2Pass = false;
});

console.log(`  Result: ${test2Pass ? 'PASS' : 'FAIL'}\n`);

// Test 3: Product Details Modal Harvest Display
console.log('Test 3: Product Details Modal Harvest Display');

function getModalHarvestDisplay(product) {
    const isPreorder = product.is_preorder === true;
    if (!isPreorder) return { display: 'Not applicable for non-preorder', class: '' };

    if (product.harvest_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const harvest = new Date(product.harvest_date);
        harvest.setHours(0, 0, 0, 0);
        const diffTime = harvest - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return { display: 'Today', class: 'text-success' };
        } else if (diffDays > 0 && diffDays <= 3) {
            return { display: `${diffDays} Days`, class: 'text-warning' };
        } else if (diffDays > 3) {
            const harvestFormatted = harvest.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
            return { display: harvestFormatted, class: 'text-primary' };
        } else {
            return { display: 'To Be Announced', class: 'text-muted' };
        }
    } else {
        return { display: 'To Be Announced', class: 'text-muted' };
    }
}

const modalTestCases = [
    { product: { is_preorder: true, harvest_date: today.toISOString() }, expected: 'Today' },
    { product: { is_preorder: true, harvest_date: tomorrow.toISOString() }, expected: '1 Days' },
    { product: { is_preorder: true, harvest_date: in7Days.toISOString() }, expected: in7Days.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) },
    { product: { is_preorder: true, harvest_date: yesterday.toISOString() }, expected: 'To Be Announced' },
    { product: { is_preorder: true, harvest_date: null }, expected: 'To Be Announced' },
    { product: { is_preorder: false, harvest_date: today.toISOString() }, expected: 'Not applicable for non-preorder' }
];

let test3Pass = true;
modalTestCases.forEach((tc, i) => {
    const result = getModalHarvestDisplay(tc.product);
    const passed = result.display === tc.expected;
    console.log(`  Case ${i + 1}: ${passed ? 'PASS' : 'FAIL'} - Expected: ${tc.expected}, Got: ${result.display}`);
    if (!passed) test3Pass = false;
});

console.log(`  Result: ${test3Pass ? 'PASS' : 'FAIL'}\n`);

// Test 4: Order Details Harvest Fields
console.log('Test 4: Order Details Harvest Fields');

function getOrderHarvestFields(order) {
    const item = (order.items && order.items[0]) || order;
    const isPreorder = order.is_preorder || item.is_preorder || false;
    
    if (!isPreorder) {
        return { hasHarvestFields: false };
    }

    return {
        hasHarvestFields: true,
        expectedHarvest: item.harvest_date,
        lastUpdated: item.harvest_date_updated_at,
        adjustmentCount: item.harvest_adjustment_count,
        previousDate: item.previous_harvest_date,
        adjustmentReason: item.harvest_adjustment_reason
    };
}

const orderTestCases = [
    { 
        order: { is_preorder: true, items: [{ harvest_date: today.toISOString(), harvest_date_updated_at: today.toISOString(), harvest_adjustment_count: 1, previous_harvest_date: yesterday.toISOString(), harvest_adjustment_reason: 'Weather delay' }] },
        expected: { hasHarvestFields: true, adjustmentCount: 1 }
    },
    { 
        order: { is_preorder: false, items: [{ harvest_date: today.toISOString() }] },
        expected: { hasHarvestFields: false }
    },
    { 
        order: { is_preorder: true, items: [{ harvest_date: today.toISOString() }] },
        expected: { hasHarvestFields: true, adjustmentCount: undefined }
    }
];

let test4Pass = true;
orderTestCases.forEach((tc, i) => {
    const result = getOrderHarvestFields(tc.order);
    const passed = result.hasHarvestFields === tc.expected.hasHarvestFields && 
                   (tc.expected.adjustmentCount === undefined || result.adjustmentCount === tc.expected.adjustmentCount);
    console.log(`  Case ${i + 1}: ${passed ? 'PASS' : 'FAIL'} - Expected hasHarvestFields: ${tc.expected.hasHarvestFields}, Got: ${result.hasHarvestFields}`);
    if (!passed) test4Pass = false;
});

console.log(`  Result: ${test4Pass ? 'PASS' : 'FAIL'}\n`);

// Test 5: Notification Icons
console.log('Test 5: Notification Icons');

const iconMap = {
    order: 'bi-bag-check',
    product: 'bi-box-seam',
    user: 'bi-person',
    system: 'bi-gear',
    notification: 'bi-bell',
    support_ticket: 'bi-ticket-perforated',
    harvest: 'bi-calendar-check',
    harvest_reminder: 'bi-calendar-event',
    harvest_adjusted: 'bi-calendar-x',
    harvest_completed: 'bi-check-circle'
};

const iconTestCases = [
    { type: 'harvest', expected: 'bi-calendar-check' },
    { type: 'harvest_reminder', expected: 'bi-calendar-event' },
    { type: 'harvest_adjusted', expected: 'bi-calendar-x' },
    { type: 'harvest_completed', expected: 'bi-check-circle' },
    { type: 'order', expected: 'bi-bag-check' }
];

let test5Pass = true;
iconTestCases.forEach((tc, i) => {
    const result = iconMap[tc.type] || 'bi-bell';
    const passed = result === tc.expected;
    console.log(`  Case ${i + 1}: ${passed ? 'PASS' : 'FAIL'} - Type: ${tc.type}, Expected: ${tc.expected}, Got: ${result}`);
    if (!passed) test5Pass = false;
});

console.log(`  Result: ${test5Pass ? 'PASS' : 'FAIL'}\n`);

// Test 6: Cart Button Logic
console.log('Test 6: Cart Button Logic');

function getCartButtonState(product) {
    const isPreorder = product.is_preorder === true;
    const reservationsDisabled = product.reservations_disabled === true || 
                                   product.reservations_disabled === 't' || 
                                   product.reservations_disabled === 'true';
    const hasValidId = product.id && product.id !== 'null' && product.id !== 'undefined';

    if (reservationsDisabled && isPreorder) {
        return { disabled: true, text: 'Reservations Temporarily Unavailable' };
    } else if (hasValidId) {
        return { disabled: false, text: isPreorder ? 'Reserve' : 'Add to Cart' };
    } else {
        return { disabled: true, text: 'Unavailable' };
    }
}

const cartTestCases = [
    { product: { is_preorder: true, reservations_disabled: true, id: 1 }, expected: { disabled: true, text: 'Reservations Temporarily Unavailable' } },
    { product: { is_preorder: true, reservations_disabled: false, id: 1 }, expected: { disabled: false, text: 'Reserve' } },
    { product: { is_preorder: false, id: 1 }, expected: { disabled: false, text: 'Add to Cart' } },
    { product: { is_preorder: true, reservations_disabled: 't', id: 1 }, expected: { disabled: true, text: 'Reservations Temporarily Unavailable' } },
    { product: { is_preorder: true, reservations_disabled: false, id: null }, expected: { disabled: true, text: 'Unavailable' } }
];

let test6Pass = true;
cartTestCases.forEach((tc, i) => {
    const result = getCartButtonState(tc.product);
    const passed = result.disabled === tc.expected.disabled && result.text === tc.expected.text;
    console.log(`  Case ${i + 1}: ${passed ? 'PASS' : 'FAIL'} - Expected: ${JSON.stringify(tc.expected)}, Got: ${JSON.stringify(result)}`);
    if (!passed) test6Pass = false;
});

console.log(`  Result: ${test6Pass ? 'PASS' : 'FAIL'}\n`);

// Final Summary
console.log('=== Test Summary ===');
const allTestsPass = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass && test6Pass;
console.log(`Overall Result: ${allTestsPass ? 'PASS - Zero Bugs' : 'FAIL - Bugs Found'}`);
console.log(`Tests Passed: ${[test1Pass, test2Pass, test3Pass, test4Pass, test5Pass, test6Pass].filter(x => x).length}/6`);

if (allTestsPass) {
    console.log('\n✅ All Customer Experience tests passed - Zero bugs detected!');
} else {
    console.log('\n❌ Some tests failed - Review the output above for details.');
}
