const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Admin Verification E2E', () => {
    test('admin HTML has verification structure', () => {
        // RED: Test that the verification HTML structure exists in the file
        const adminHtml = fs.readFileSync(path.join(__dirname, '../frontend/admin.html'), 'utf8');
        
        // Check that verification requests section exists
        expect(adminHtml).toContain('id="verification-requests"');
        
        // Check that stats elements exist
        expect(adminHtml).toContain('id="verification-pending-count"');
        expect(adminHtml).toContain('id="verification-approved-today"');
        expect(adminHtml).toContain('id="verification-rejected-today"');
        
        // Check that filter tabs exist
        expect(adminHtml).toContain('verification-tabs');
        expect(adminHtml).toContain('data-status="all"');
        expect(adminHtml).toContain('data-status="pending"');
        expect(adminHtml).toContain('data-status="approved"');
        expect(adminHtml).toContain('data-status="rejected"');
        
        // Check that table exists
        expect(adminHtml).toContain('id="verification-requests-table"');
        
        // Check that sidebar has Requests heading
        expect(adminHtml).toContain('Requests');
        
        // Check that verification requests link exists
        expect(adminHtml).toContain('href="#verification-requests"');
    });

    test('admin JS has verification methods', () => {
        // RED: Test that the verification methods exist in the JS file
        const adminJs = fs.readFileSync(path.join(__dirname, '../frontend/js/admin.js'), 'utf8');
        
        // Check that loadVerificationRequests method exists
        expect(adminJs).toContain('loadVerificationRequests');
        
        // Check that updateVerificationStats method exists
        expect(adminJs).toContain('updateVerificationStats');
        
        // Check that renderVerificationRequestsTable method exists
        expect(adminJs).toContain('renderVerificationRequestsTable');
        
        // Check that handleReviewAction method exists
        expect(adminJs).toContain('handleReviewAction');
    });
});
