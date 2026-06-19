const { test, expect } = require('@playwright/test');

test.describe('Verification Details Modal Buttons', () => {
  test('approve button in modal has correct event listener', async () => {
    const fs = require('fs');
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that approve-from-details-btn has event listener
    expect(adminJs).toContain("document.getElementById('approve-from-details-btn')");
    expect(adminJs).toContain("closeVerificationDetailsModal()");
    expect(adminJs).toContain("openReviewModal(requestId, 'approve')");
  });

  test('reject button in modal has correct event listener', async () => {
    const fs = require('fs');
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that reject-from-details-btn has event listener
    expect(adminJs).toContain("document.getElementById('reject-from-details-btn')");
    expect(adminJs).toContain("closeVerificationDetailsModal()");
    expect(adminJs).toContain("openReviewModal(requestId, 'reject')");
  });

  test('modal buttons exist in HTML', async () => {
    const fs = require('fs');
    const adminHtml = fs.readFileSync('./frontend/admin.html', 'utf8');
    
    // Check that buttons exist in modal footer
    expect(adminHtml).toContain('id="reject-from-details-btn"');
    expect(adminHtml).toContain('id="unverify-from-details-btn"');
    expect(adminHtml).toContain('id="approve-from-details-btn"');
  });

  test('openReviewModal function exists and is defined', async () => {
    const fs = require('fs');
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that openReviewModal function exists
    expect(adminJs).toContain('openReviewModal(requestId, action)');
    expect(adminJs).toContain('this.currentReviewRequestId = requestId');
  });

  test('closeVerificationDetailsModal function exists', async () => {
    const fs = require('fs');
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that closeVerificationDetailsModal function exists
    expect(adminJs).toContain('closeVerificationDetailsModal()');
    expect(adminJs).toContain("document.getElementById('verification-details-modal').classList.remove('open')");
  });

  test('approve/reject buttons set dataset.requestId correctly', async () => {
    const fs = require('fs');
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that dataset.requestId is set when showing buttons
    expect(adminJs).toContain("approveBtn.dataset.requestId = request.id");
    expect(adminJs).toContain("rejectBtn.dataset.requestId = request.id");
  });
});
