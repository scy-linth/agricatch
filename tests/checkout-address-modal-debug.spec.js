const { test, expect } = require('@playwright/test');

test.describe('Checkout Address Modal Debug', () => {
  test('Debug modal opening issue', async ({ page, context }) => {
    // Set auth token directly (bypass login for debugging)
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
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    console.log('=== CHECKOUT ADDRESS MODAL DEBUG ===');
    
    // Check if Set Address button exists
    const setAddressBtn = page.locator('#set-address-btn');
    const buttonExists = await setAddressBtn.count() > 0;
    console.log('Set Address button exists:', buttonExists);
    
    if (buttonExists) {
      const buttonVisible = await setAddressBtn.isVisible();
      console.log('Set Address button is visible:', buttonVisible);
      
      if (buttonVisible) {
        // Check button display style
        const displayStyle = await setAddressBtn.evaluate(el => window.getComputedStyle(el).display);
        console.log('Button display style:', displayStyle);
        
        // Click the button to test event delegation fix
        console.log('Clicking Set Address button...');
        await setAddressBtn.click({ force: true });
        
        // Wait a moment for modal to appear
        await page.waitForTimeout(1000);
        
        // Check if modal exists
        const modal = page.locator('#add-address-modal');
        const modalExists = await modal.count() > 0;
        console.log('Modal element exists:', modalExists);
        
        if (modalExists) {
          // Check modal classes
          const modalClasses = await modal.evaluate(el => el.className);
          console.log('Modal classes:', modalClasses);
          
          // Check if modal has 'open' class
          const hasOpenClass = await modal.evaluate(el => el.classList.contains('open'));
          console.log('Modal has open class:', hasOpenClass);
          
          // Check modal computed display
          const modalDisplay = await modal.evaluate(el => window.getComputedStyle(el).display);
          console.log('Modal computed display:', modalDisplay);
          
          // Check if modal is visible
          const modalVisible = await modal.isVisible();
          console.log('Modal is visible:', modalVisible);
          
          // Take screenshot
          await page.screenshot({ path: 'test-results/checkout-modal-debug.png', fullPage: true });
        } else {
          console.error('Modal element not found in DOM');
        }
      } else {
        console.log('Set Address button exists but not visible');
        const displayStyle = await setAddressBtn.evaluate(el => window.getComputedStyle(el).display);
        console.log('Button display style:', displayStyle);
      }
    } else {
      console.log('Set Address button not found in DOM');
      
      // Check if setting is loaded correctly
      const response = await page.request.get('http://localhost:3000/api/settings');
      const settings = await response.json();
      console.log('Settings API response:', settings);
    }
    
    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/checkout-page-debug.png', fullPage: true });
  });
});
