const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Farmer Verification E2E', () => {
    test('farmer HTML has verification structure', () => {
        // RED: Test that the verification HTML structure exists in the file
        const farmerHtml = fs.readFileSync(path.join(__dirname, '../frontend/farmer.html'), 'utf8');
        
        // Check that verification subsection exists
        expect(farmerHtml).toContain('id="profile-verification"');
        
        // Check that form exists
        expect(farmerHtml).toContain('id="verification-request-form"');
        
        // Check that benefits section exists
        expect(farmerHtml).toContain('id="verification-benefits-section"');
        
        // Check that verification button exists
        expect(farmerHtml).toContain('id="verification-request-btn"');
        
        // Check that menu text exists
        expect(farmerHtml).toContain('id="verification-menu-text"');
    });

    test('farmer JS has verification methods', () => {
        // RED: Test that the verification methods exist in the JS file
        const farmerJs = fs.readFileSync(path.join(__dirname, '../frontend/js/farmer.js'), 'utf8');
        
        // Check that openVerificationSection method exists
        expect(farmerJs).toContain('openVerificationSection()');
        
        // Check that renderVerificationSubsection method exists
        expect(farmerJs).toContain('renderVerificationSubsection()');
        
        // Check that renderStatusDisplay method exists
        expect(farmerJs).toContain('renderStatusDisplay()');
        
        // Check that renderHistoryTimeline method exists
        expect(farmerJs).toContain('renderHistoryTimeline()');
    });
});
