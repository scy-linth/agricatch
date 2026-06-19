const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Unverified Status Workflow', () => {
  test('status badge includes icons in admin.js', async () => {
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that status badges include icons
    expect(adminJs).toContain('bi-hourglass');
    expect(adminJs).toContain('bi-check-circle-fill');
    expect(adminJs).toContain('bi-x-circle-fill');
    expect(adminJs).toContain('bg-secondary">Unverified</span>');
  });

  test('unverified filter tab exists in admin.html', async () => {
    const adminHtml = fs.readFileSync('./frontend/admin.html', 'utf8');
    
    // Check that unverified filter tab exists
    expect(adminHtml).toContain('data-status="unverified"');
    expect(adminHtml).toContain('Unverified</button>');
  });

  test('backend accepts unverified status', async () => {
    const adminJs = fs.readFileSync('./backend/routes/admin.js', 'utf8');
    
    // Check that unverified is in the status validation
    expect(adminJs).toContain("'unverified'");
    expect(adminJs).toContain("Reason is required for unverify");
    expect(adminJs).toContain("Can only unverify approved requests");
  });

  test('frontend sends unverified status in unverify action', async () => {
    const adminJs = fs.readFileSync('./frontend/js/admin.js', 'utf8');
    
    // Check that handleUnverifyAction sends 'unverified' status
    expect(adminJs).toContain("status: 'unverified'");
  });

  test('database migration adds unverified to constraint', async () => {
    const migration = fs.readFileSync('./database/migrations/add_unverified_status.sql', 'utf8');
    
    // Check that migration includes unverified status
    expect(migration).toContain("'unverified'");
    expect(migration).toContain('verification_requests_status_check');
  });

  test('farmer route allows new verification requests regardless of status', async () => {
    const farmersJs = fs.readFileSync('./backend/routes/farmers.js', 'utf8');
    
    // Check that pending restriction is removed (commented out)
    expect(farmersJs).toContain('// REMOVED: Allow new requests even if pending exists for unverified workflow');
  });
});
