const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('farmer verification HTML structure', () => {
    const farmerHtml = fs.readFileSync(path.join(__dirname, '../frontend/farmer.html'), 'utf8');
    
    // Test verification button exists
    expect(farmerHtml).toContain('id="verification-request-btn"');
    expect(farmerHtml).toContain('id="verification-menu-text"');
    
    // Test verification subsection exists
    expect(farmerHtml).toContain('id="profile-verification"');
    
    // Test benefits section exists
    expect(farmerHtml).toContain('id="verification-benefits-section"');
    
    // Test form exists
    expect(farmerHtml).toContain('id="verification-request-form"');
    
    // Test status display section exists
    expect(farmerHtml).toContain('id="verification-status-display-section"');
    
    // Test history section exists
    expect(farmerHtml).toContain('id="verification-history-section"');
    
    // Test mobile responsiveness CSS exists
    expect(farmerHtml).toContain('@media (max-width: 768px)');
    expect(farmerHtml).toContain('#verification-benefits-section .row');
});

test('admin verification HTML structure', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '../frontend/admin.html'), 'utf8');
    
    // Test sidebar renamed to Requests
    expect(adminHtml).toContain('Requests');
    
    // Test verification requests link exists
    expect(adminHtml).toContain('href="#verification-requests"');
    
    // Test verification requests section exists
    expect(adminHtml).toContain('id="verification-requests"');
    
    // Test stats dashboard elements exist
    expect(adminHtml).toContain('id="verification-pending-count"');
    expect(adminHtml).toContain('id="verification-approved-today"');
    expect(adminHtml).toContain('id="verification-rejected-today"');
    
    // Test filter tabs exist
    expect(adminHtml).toContain('verification-tabs');
    expect(adminHtml).toContain('data-status="all"');
    expect(adminHtml).toContain('data-status="pending"');
    expect(adminHtml).toContain('data-status="approved"');
    expect(adminHtml).toContain('data-status="rejected"');
    
    // Test requests table exists
    expect(adminHtml).toContain('id="verification-requests-table"');
});

test('farmer verification JS logic', () => {
    const farmerJs = fs.readFileSync(path.join(__dirname, '../frontend/js/farmer.js'), 'utf8');
    
    // Test openVerificationSection method exists
    expect(farmerJs).toContain('openVerificationSection()');
    expect(farmerJs).toContain("showSection('profile', 'verification')");
    
    // Test renderVerificationSubsection method exists
    expect(farmerJs).toContain('renderVerificationSubsection()');
    
    // Test renderStatusDisplay method exists
    expect(farmerJs).toContain('renderStatusDisplay()');
    
    // Test renderHistoryTimeline method exists
    expect(farmerJs).toContain('renderHistoryTimeline()');
    
    // Test activateProfileTab handles verification
    expect(farmerJs).toContain("if (tab === 'verification')");
});

test('admin verification JS logic', () => {
    const adminJs = fs.readFileSync(path.join(__dirname, '../frontend/js/admin.js'), 'utf8');
    
    // Test loadVerificationRequests method exists
    expect(adminJs).toContain('loadVerificationRequests');
    
    // Test updateVerificationStats method exists
    expect(adminJs).toContain('updateVerificationStats');
    
    // Test renderVerificationRequestsTable method exists
    expect(adminJs).toContain('renderVerificationRequestsTable');
    
    // Test handleReviewAction method exists
    expect(adminJs).toContain('handleReviewAction');
});

test('mobile responsiveness CSS', () => {
    const adminCss = fs.readFileSync(path.join(__dirname, '../frontend/css/agricatch-admin.css'), 'utf8');
    
    // Test verification tabs styling exists
    expect(adminCss).toContain('.verification-tabs');
    expect(adminCss).toContain('.verification-tabs .tab-btn');
    
    // Test mobile responsiveness exists
    expect(adminCss).toContain('@media (max-width: 768px)');
    expect(adminCss).toContain('#verification-requests .row');
});
