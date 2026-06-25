const { test, expect } = require('@playwright/test');

test('Debug suggested price functionality', async ({ page }) => {
  // Navigate to admin page
  await page.goto('http://localhost:3000/admin.html');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Login as admin (you may need to adjust credentials)
  await page.fill('input[name="email"]', 'admin@agricatch.store');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for login to complete
  await page.waitForURL('**/admin.html', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Navigate to Product Catalog section
  await page.click('text=Product Catalog');
  await page.waitForTimeout(2000);
  
  // Wait for table to load
  await page.waitForSelector('#catalog-names-tbody tr', { timeout: 10000 });
  
  // Find Ampalaya row and click Edit
  const rows = await page.locator('#catalog-names-tbody tr').all();
  console.log(`Found ${rows.length} rows in catalog table`);
  
  for (const row of rows) {
    const text = await row.textContent();
    console.log('Row text:', text);
    if (text.includes('Ampalaya')) {
      await row.locator('button:has-text("Edit")').click();
      console.log('Clicked Edit on Ampalaya');
      break;
    }
  }
  
  // Wait for edit panel to open
  await page.waitForSelector('#catalog-edit-panel.active', { timeout: 5000 });
  
  // Check current value of suggested price input
  const suggestedPriceInput = page.locator('#catalog-edit-suggested-price');
  const currentValue = await suggestedPriceInput.inputValue();
  console.log('Current suggested price value:', currentValue);
  
  // Set suggested price to 15
  await suggestedPriceInput.fill('15');
  console.log('Set suggested price to 15');
  
  // Click Save
  await page.click('#catalog-edit-save');
  console.log('Clicked Save');
  
  // Wait for save to complete
  await page.waitForTimeout(2000);
  
  // Check console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
    console.log('Browser console:', msg.text());
  });
  
  // Wait for panel to close
  await page.waitForSelector('#catalog-edit-panel:not(.active)', { timeout: 5000 });
  
  // Wait for table to refresh
  await page.waitForTimeout(2000);
  
  // Check if suggested price appears in table
  const refreshedRows = await page.locator('#catalog-names-tbody tr').all();
  console.log(`Found ${refreshedRows.length} rows after refresh`);
  
  for (const row of refreshedRows) {
    const text = await row.textContent();
    console.log('Row text after refresh:', text);
    if (text.includes('Ampalaya')) {
      console.log('Ampalaya row after refresh:', text);
      if (text.includes('₱15') || text.includes('15')) {
        console.log('✓ Suggested price 15 found in table');
      } else {
        console.log('✗ Suggested price 15 NOT found in table');
      }
      break;
    }
  }
  
  // Print all console logs
  console.log('All console logs:', logs);
});
