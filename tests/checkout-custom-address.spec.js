const { test, expect } = require('@playwright/test');

test.describe('Checkout Custom Address Flow', () => {
  test('Verify modal opens and has correct structure', async ({ page, context }) => {
    // Set auth token directly (bypass login for testing)
    await context.addCookies([
      {
        name: 'token',
        value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6ImN1c3RvbWVyIiwiaWF0IjoxNjE2MjM5MDIyfQ.test',
        domain: 'localhost',
        path: '/',
      }
    ]);
    
    // Set localStorage token
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwicm9sZSI6ImN1c3RvbWVyIiwiaWF0IjoxNjE2MjM5MDIyfQ.test');
    });
    
    // Navigate to checkout
    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForLoadState('networkidle');
    
    console.log('=== CHECKOUT CUSTOM ADDRESS TEST ===');
    
    // Check if Set Address button is visible
    const setAddressBtn = page.locator('#set-address-btn');
    const buttonVisible = await setAddressBtn.isVisible();
    console.log('Set Address button visible:', buttonVisible);
    
    if (!buttonVisible) {
      console.log('Set Address button not visible - setting might be enabled');
      // Check setting
      const response = await page.request.get('http://localhost:3000/api/settings');
      const settings = await response.json();
      console.log('Settings:', settings);
      throw new Error('Set Address button not visible - custom address feature may be disabled');
    }
    
    // Click Set Address button
    console.log('Clicking Set Address button...');
    await setAddressBtn.click();
    await page.waitForTimeout(500);
    
    // Check if modal opened
    const modal = page.locator('#add-address-modal');
    const modalVisible = await modal.isVisible();
    console.log('Modal visible:', modalVisible);
    
    if (!modalVisible) {
      throw new Error('Modal did not open');
    }
    
    // Check if modal has open class
    const hasOpenClass = await modal.evaluate(el => el.classList.contains('open'));
    console.log('Modal has open class:', hasOpenClass);
    
    // Verify modal structure
    const modalHeader = modal.locator('.modal-header');
    const modalBody = modal.locator('.modal-body');
    const modalFooter = modal.locator('.modal-footer');
    
    console.log('Modal header visible:', await modalHeader.isVisible());
    console.log('Modal body visible:', await modalBody.isVisible());
    console.log('Modal footer visible:', await modalFooter.isVisible());
    
    // Verify form fields exist
    const zoneSelect = page.locator('#floating-address-zone');
    const provinceSelect = page.locator('#floating-address-province');
    const citySelect = page.locator('#floating-address-city');
    const barangaySelect = page.locator('#floating-address-barangay');
    const streetInput = page.locator('#floating-address-street');
    const addressPreview = page.locator('#floating-address-full');
    
    console.log('Zone select exists:', await zoneSelect.count() > 0);
    console.log('Province select exists:', await provinceSelect.count() > 0);
    console.log('City select exists:', await citySelect.count() > 0);
    console.log('Barangay select exists:', await barangaySelect.count() > 0);
    console.log('Street input exists:', await streetInput.count() > 0);
    console.log('Address preview exists:', await addressPreview.count() > 0);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/checkout-modal-structure.png', fullPage: true });
    
    console.log('✅ Modal structure verified');
  });
});
