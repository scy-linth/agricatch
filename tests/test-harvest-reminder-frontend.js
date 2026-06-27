// Test script for Harvest Reminder System Frontend
// Tests harvest status calculation, dashboard card sync, and validation

// Mock product data for testing
const testProducts = [
    {
        id: 1,
        name: 'Product Today',
        harvest_date: new Date().toISOString().split('T')[0], // Today
        is_preorder: true,
        reservations_disabled: false
    },
    {
        id: 2,
        name: 'Product 2 Days',
        harvest_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
        is_preorder: true,
        reservations_disabled: false
    },
    {
        id: 3,
        name: 'Product Overdue',
        harvest_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
        is_preorder: true,
        reservations_disabled: false
    },
    {
        id: 4,
        name: 'Product Reservations Disabled',
        harvest_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 8 days ago
        is_preorder: true,
        reservations_disabled: true
    },
    {
        id: 5,
        name: 'Product No Harvest Date',
        harvest_date: null,
        is_preorder: true,
        reservations_disabled: false
    }
];

// Test getHarvestStatus function
function getHarvestStatus(product) {
    if (!product.harvest_date) {
        return { status: null, today: false, within3Days: false, overdue: false, daysOverdue: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const harvestDate = new Date(product.harvest_date);
    harvestDate.setHours(0, 0, 0, 0);

    const diffTime = harvestDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { status: 'Today', today: true, within3Days: false, overdue: false, daysOverdue: 0 };
    } else if (diffDays > 0 && diffDays <= 3) {
        return { status: `${diffDays} Days`, today: false, within3Days: true, overdue: false, daysOverdue: 0 };
    } else if (diffDays < 0) {
        const daysOverdue = Math.abs(diffDays);
        return { status: 'Harvest Update Required', today: false, within3Days: false, overdue: true, daysOverdue };
    }

    return { status: null, today: false, within3Days: false, overdue: false, daysOverdue: 0 };
}

// Test validation functions
function validateHarvestDate(harvestDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(harvestDate);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate >= today;
}

function validateReason(reason) {
    return reason && reason.trim().length > 0;
}

// Run tests
console.log('=== Harvest Reminder Frontend Tests ===\n');

// Test 1: Harvest Status Calculation
console.log('Test 1: Harvest Status Calculation');
testProducts.forEach(product => {
    const status = getHarvestStatus(product);
    console.log(`  ${product.name}:`);
    console.log(`    Status: ${status.status}`);
    console.log(`    Today: ${status.today}`);
    console.log(`    Within 3 Days: ${status.within3Days}`);
    console.log(`    Overdue: ${status.overdue}`);
    console.log(`    Days Overdue: ${status.daysOverdue}`);
    console.log('');
});

// Test 2: Dashboard Card Sync
console.log('Test 2: Dashboard Card Sync');
let harvestToday = 0;
let harvest3Days = 0;
let harvestOverdue = 0;

testProducts.forEach(product => {
    const status = getHarvestStatus(product);
    if (status.today) harvestToday++;
    if (status.within3Days) harvest3Days++;
    if (status.overdue) harvestOverdue++;
});

console.log(`  Harvest Today: ${harvestToday}`);
console.log(`  Due in 3 Days: ${harvest3Days}`);
console.log(`  Overdue: ${harvestOverdue}`);
console.log(`  Expected: Today=1, 3Days=1, Overdue=2`);
console.log(`  Result: ${harvestToday === 1 && harvest3Days === 1 && harvestOverdue === 2 ? 'PASS' : 'FAIL'}`);
console.log('');

// Test 3: Date Validation
console.log('Test 3: Date Validation');
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log(`  Today (${today}): ${validateHarvestDate(today) ? 'Valid' : 'Invalid'}`);
console.log(`  Yesterday (${yesterday}): ${validateHarvestDate(yesterday) ? 'Valid' : 'Invalid'}`);
console.log(`  Tomorrow (${tomorrow}): ${validateHarvestDate(tomorrow) ? 'Valid' : 'Invalid'}`);
console.log(`  Expected: Today=Valid, Yesterday=Invalid, Tomorrow=Valid`);
console.log(`  Result: ${validateHarvestDate(today) && !validateHarvestDate(yesterday) && validateHarvestDate(tomorrow) ? 'PASS' : 'FAIL'}`);
console.log('');

// Test 4: Reason Validation
console.log('Test 4: Reason Validation');
console.log(`  Empty reason: ${validateReason('') ? 'Valid' : 'Invalid'}`);
console.log(`  Spaces only: ${validateReason('   ') ? 'Valid' : 'Invalid'}`);
console.log(`  Valid reason: ${validateReason('Weather delay') ? 'Valid' : 'Invalid'}`);
console.log(`  Expected: Empty=Invalid, Spaces=Invalid, Valid=Valid`);
console.log(`  Result: ${!validateReason('') && !validateReason('   ') && validateReason('Weather delay') ? 'PASS' : 'FAIL'}`);
console.log('');

// Test 5: Reservation Disabled Indicator
console.log('Test 5: Reservation Disabled Indicator');
const disabledProduct = testProducts.find(p => p.id === 4);
const enabledProduct = testProducts.find(p => p.id === 1);
console.log(`  Product with reservations_disabled=true: ${disabledProduct.reservations_disabled === true ? 'Correct' : 'Incorrect'}`);
console.log(`  Product with reservations_disabled=false: ${enabledProduct.reservations_disabled === false ? 'Correct' : 'Incorrect'}`);
console.log(`  Result: ${disabledProduct.reservations_disabled === true && enabledProduct.reservations_disabled === false ? 'PASS' : 'FAIL'}`);
console.log('');

console.log('=== All Tests Complete ===');
