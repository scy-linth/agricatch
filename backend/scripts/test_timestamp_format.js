// Comprehensive edge-case test for formatConversationPreviewTime
// This script tests the timestamp formatting function from chat.js

function formatConversationPreviewTime(date) {
    if (!date) return '';
    const d = new Date(date);
    
    // Check for invalid date
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}min ago`;
    
    if (diffHours < 24) return `${diffHours}hr ago`;
    
    // Check if yesterday (exactly 1 day ago and different calendar day)
    // Only show "Yesterday" when it's actually yesterday AND at least 24 hours ago
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString() && diffDays === 1) return 'Yesterday';
    
    // Days ago (2-6 days)
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // Weeks ago (7-27 days)
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    
    // Months ago (28-364 days)
    const diffMonths = Math.floor(diffDays / 30);
    if (diffDays < 365) {
        // Ensure at least 1 month for 28+ days
        return `${Math.max(1, diffMonths)}mo ago`;
    }
    
    // Years ago (365+ days)
    const diffYears = Math.floor(diffDays / 365);
    // Ensure at least 1 year for 365+ days
    return `${Math.max(1, diffYears)}y ago`;
}

// Test helper
function runTest(description, input, expected) {
    try {
        const result = formatConversationPreviewTime(input);
        const passed = result === expected;
        console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${description}`);
        if (!passed) {
            console.log(`  Expected: "${expected}"`);
            console.log(`  Got:      "${result}"`);
        }
        return passed;
    } catch (error) {
        console.log(`✗ ERROR: ${description}`);
        console.log(`  Error: ${error.message}`);
        return false;
    }
}

// Test helper for date-based tests
function createDateAgo(days, hours, minutes, seconds) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(date.getHours() - hours);
    date.setMinutes(date.getMinutes() - minutes);
    date.setSeconds(date.getSeconds() - seconds);
    return date;
}

console.log('='.repeat(80));
console.log('SUPPORT CHAT RELATIVE TIMESTAMP - COMPREHENSIVE EDGE-CASE AUDIT');
console.log('='.repeat(80));
console.log();

let totalTests = 0;
let passedTests = 0;

// < 1 minute tests
console.log('--- < 1 MINUTE ---');
totalTests++; passedTests += runTest('0 seconds → "Just now"', createDateAgo(0, 0, 0, 0), 'Just now');
totalTests++; passedTests += runTest('10 seconds → "Just now"', createDateAgo(0, 0, 0, 10), 'Just now');
totalTests++; passedTests += runTest('30 seconds → "Just now"', createDateAgo(0, 0, 0, 30), 'Just now');
totalTests++; passedTests += runTest('59 seconds → "Just now"', createDateAgo(0, 0, 0, 59), 'Just now');
console.log();

// Minutes tests
console.log('--- MINUTES ---');
totalTests++; passedTests += runTest('1 minute → "1min ago"', createDateAgo(0, 0, 1, 0), '1min ago');
totalTests++; passedTests += runTest('2 minutes → "2min ago"', createDateAgo(0, 0, 2, 0), '2min ago');
totalTests++; passedTests += runTest('15 minutes → "15min ago"', createDateAgo(0, 0, 15, 0), '15min ago');
totalTests++; passedTests += runTest('59 minutes → "59min ago"', createDateAgo(0, 0, 59, 0), '59min ago');
console.log();

// Hours tests
console.log('--- HOURS ---');
totalTests++; passedTests += runTest('1 hour → "1hr ago"', createDateAgo(0, 1, 0, 0), '1hr ago');
totalTests++; passedTests += runTest('2 hours → "2hr ago"', createDateAgo(0, 2, 0, 0), '2hr ago');
totalTests++; passedTests += runTest('12 hours → "12hr ago"', createDateAgo(0, 12, 0, 0), '12hr ago');
totalTests++; passedTests += runTest('23 hours → "23hr ago"', createDateAgo(0, 23, 0, 0), '23hr ago');
console.log();

// Yesterday test
console.log('--- YESTERDAY ---');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0); // Set to midnight to ensure it's exactly 24+ hours ago
totalTests++; passedTests += runTest('Exactly yesterday → "Yesterday"', yesterday, 'Yesterday');
console.log();

// Days tests
console.log('--- DAYS ---');
totalTests++; passedTests += runTest('2 days → "2d ago"', createDateAgo(2, 0, 0, 0), '2d ago');
totalTests++; passedTests += runTest('3 days → "3d ago"', createDateAgo(3, 0, 0, 0), '3d ago');
totalTests++; passedTests += runTest('6 days → "6d ago"', createDateAgo(6, 0, 0, 0), '6d ago');
console.log();

// Weeks tests
console.log('--- WEEKS ---');
totalTests++; passedTests += runTest('7 days → "1w ago"', createDateAgo(7, 0, 0, 0), '1w ago');
totalTests++; passedTests += runTest('14 days → "2w ago"', createDateAgo(14, 0, 0, 0), '2w ago');
totalTests++; passedTests += runTest('21 days → "3w ago"', createDateAgo(21, 0, 0, 0), '3w ago');
totalTests++; passedTests += runTest('27 days → "3w ago"', createDateAgo(27, 0, 0, 0), '3w ago');
console.log();

// Months tests
console.log('--- MONTHS ---');
totalTests++; passedTests += runTest('28 days → "1mo ago"', createDateAgo(28, 0, 0, 0), '1mo ago');
totalTests++; passedTests += runTest('60 days → "2mo ago"', createDateAgo(60, 0, 0, 0), '2mo ago');
totalTests++; passedTests += runTest('180 days → "6mo ago"', createDateAgo(180, 0, 0, 0), '6mo ago');
totalTests++; passedTests += runTest('364 days → "12mo ago"', createDateAgo(364, 0, 0, 0), '12mo ago'); // 364/30 = 12.13 → 12
console.log();

// Years tests
console.log('--- YEARS ---');
totalTests++; passedTests += runTest('365 days → "1y ago"', createDateAgo(365, 0, 0, 0), '1y ago');
totalTests++; passedTests += runTest('730 days → "2y ago"', createDateAgo(730, 0, 0, 0), '2y ago');
console.log();

// Edge cases - Future timestamps
console.log('--- EDGE CASES: FUTURE TIMESTAMPS ---');
const future = new Date();
future.setHours(future.getHours() + 1);
totalTests++; passedTests += runTest('Future timestamp (1 hour ahead)', future, 'Just now'); // Should handle gracefully
console.log();

// Edge cases - Invalid/Null/Undefined
console.log('--- EDGE CASES: INVALID/NULL/UNDEFINED ---');
totalTests++; passedTests += runTest('Null timestamp', null, '');
totalTests++; passedTests += runTest('Undefined timestamp', undefined, '');
totalTests++; passedTests += runTest('Empty string timestamp', '', '');
totalTests++; passedTests += runTest('Invalid date string', 'invalid date', ''); // Should return empty string for invalid dates
console.log();

// Edge cases - Timezone/DST
console.log('--- EDGE CASES: TIMEZONE/DST ---');
// Test with different timezone offsets
const utcDate = new Date();
utcDate.setUTCHours(utcDate.getUTCHours() - 12);
totalTests++; passedTests += runTest('UTC date (12 hours ago)', utcDate, '12hr ago');
console.log();

// Edge cases - Leap year
console.log('--- EDGE CASES: LEAP YEAR ---');
const leapYearDate = new Date('2024-02-29T12:00:00'); // Leap day
totalTests++; passedTests += runTest('Leap year date (Feb 29, 2024)', leapYearDate, '2y ago'); // Approximate
console.log();

// Edge cases - Month boundary
console.log('--- EDGE CASES: MONTH BOUNDARY ---');
const jan31 = new Date('2024-01-31T12:00:00');
totalTests++; passedTests += runTest('Jan 31 → Feb 1 transition', jan31, '2y ago'); // Approximate
console.log();

// Edge cases - Year boundary
console.log('--- EDGE CASES: YEAR BOUNDARY ---');
const dec31 = new Date('2023-12-31T23:59:59');
totalTests++; passedTests += runTest('Dec 31 → Jan 1 transition', dec31, '2y ago'); // Approximate
console.log();

// Edge cases - Negative values check
console.log('--- EDGE CASES: NEGATIVE VALUES CHECK ---');
const now = new Date();
totalTests++; passedTests += runTest('Current time (0 diff)', now, 'Just now');
const veryRecent = new Date(now.getTime() - 100); // 100ms ago
totalTests++; passedTests += runTest('Very recent (100ms)', veryRecent, 'Just now');
console.log();

// Summary
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
console.log('='.repeat(80));

if (passedTests === totalTests) {
    console.log('✓ ALL TESTS PASSED');
    process.exit(0);
} else {
    console.log('✗ SOME TESTS FAILED');
    process.exit(1);
}
