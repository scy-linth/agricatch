const { test, expect } = require('@playwright/test');

test('Farmer Product Management Verification', async ({ page, context }) => {
  // Login as farmer first
  await page.goto('http://localhost:3000/index.html');
  await page.click('button:has-text("Login")');
  await page.waitForSelector('#auth-modal.modal.open', { timeout: 5000 });
  await page.fill('input[placeholder*="Email"]', 'testfarmer@test.com');
  await page.fill('input[placeholder*="Password"]', 'testfarmer123');
  await page.click('button:has-text("Login")');
  
  // Wait for navigation to farmer dashboard
  await page.waitForURL('**/farmer.html', { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for farmer.js to initialize
  await page.waitForFunction(() => window.farmerDashboard !== undefined, { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Navigate to products section via JavaScript (direct showSection call)
  await page.evaluate(() => {
    if (window.farmerDashboard && window.farmerDashboard.showSection) {
      window.farmerDashboard.showSection('products');
    }
  });
  
  // Wait for products to load
  await page.waitForTimeout(3000);
  
  console.log('\n=== FARMER PRODUCT MANAGEMENT VERIFICATION ===\n');
  
  // 1. Product Management Page Verification
  console.log('1. Product Management Page');
  
  // Check tabs
  const tabs = await page.locator('#products-tabs .nav-link').all();
  console.log(`   Tabs found: ${tabs.length}`);
  for (const tab of tabs) {
    const text = await tab.textContent();
    console.log(`   - ${text.trim()}`);
  }
  
  // Check search
  const searchInput = await page.locator('#products-search').count();
  console.log(`   Search input: ${searchInput > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  
  // Check filters
  const categoryFilter = await page.locator('#products-category-filter').count();
  console.log(`   Category filter: ${categoryFilter > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  
  // Check pagination
  const availablePagination = await page.locator('#available-products-pagination').count();
  const preorderPagination = await page.locator('#preorder-products-pagination').count();
  console.log(`   Available products pagination: ${availablePagination > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`   Preorder products pagination: ${preorderPagination > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  
  // 2. Available Products Verification
  console.log('\n2. Available Products');
  
  const availableTable = await page.locator('#available-products-table tbody tr').count();
  console.log(`   Available products rows: ${availableTable}`);
  
  if (availableTable > 0) {
    const firstRow = page.locator('#available-products-table tbody tr').first();
    const cells = await firstRow.locator('td').all();
    console.log(`   Columns in first row: ${cells.length}`);
    
    // Check for image
    const hasImage = await firstRow.locator('img').count() > 0;
    console.log(`   Product image: ${hasImage ? 'EXISTS' : 'NOT FOUND'}`);
    
    // Check for action buttons
    const actionButtons = await firstRow.locator('button').count();
    console.log(`   Action buttons: ${actionButtons}`);
  }
  
  // 3. Pre-order Products Verification
  console.log('\n3. Pre-order Products');
  
  const preorderTable = await page.locator('#preorder-products-table tbody tr').count();
  console.log(`   Preorder products rows: ${preorderTable}`);
  
  if (preorderTable > 0) {
    const firstRow = page.locator('#preorder-products-table tbody tr').first();
    
    // Check for pre-order badge
    const hasBadge = await firstRow.locator('.badge').count() > 0;
    console.log(`   Pre-order badge: ${hasBadge ? 'EXISTS' : 'NOT FOUND'}`);
    
    // Check for harvest date
    const hasHarvestDate = await firstRow.textContent().then(text => text.includes('Expected Harvest') || text.includes('Harvest'));
    console.log(`   Harvest date info: ${hasHarvestDate ? 'EXISTS' : 'NOT FOUND'}`);
    
    // Check for disabled reservation button
    const disabledButtons = await firstRow.locator('button:disabled').count();
    console.log(`   Disabled reservation buttons: ${disabledButtons}`);
  }
  
  // 4. Product Actions Verification
  console.log('\n4. Product Actions');
  
  // Check for Add Product button
  const addProductBtn = await page.locator('button:has-text("Add Product")').count();
  console.log(`   Add Product button: ${addProductBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  
  // Check for action buttons in table rows
  if (availableTable > 0) {
    const firstRow = page.locator('#available-products-table tbody tr').first();
    const editBtn = await firstRow.locator('button:has-text("Edit")').count();
    const deleteBtn = await firstRow.locator('button:has-text("Delete")').count();
    const disableBtn = await firstRow.locator('button:has-text("Disable")').count();
    console.log(`   Edit button: ${editBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`   Delete button: ${deleteBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`   Disable button: ${disableBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  }
  
  // Check for Harvest Now and Update Harvest Date (preorder specific)
  if (preorderTable > 0) {
    const firstRow = page.locator('#preorder-products-table tbody tr').first();
    const harvestNowBtn = await firstRow.locator('button:has-text("Harvest Now")').count();
    const updateHarvestBtn = await firstRow.locator('button:has-text("Update")').count();
    const convertBtn = await firstRow.locator('button:has-text("Convert")').count();
    console.log(`   Harvest Now button: ${harvestNowBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`   Update Harvest Date button: ${updateHarvestBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`   Convert Inventory button: ${convertBtn > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  }
  
  // 5. Product Modals Verification
  console.log('\n5. Product Modals');
  
  const addProductModal = await page.locator('#add-product-modal').count();
  const editProductModal = await page.locator('#edit-product-modal').count();
  console.log(`   Add Product modal: ${addProductModal > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`   Edit Product modal: ${editProductModal > 0 ? 'EXISTS' : 'NOT FOUND'}`);
  
  // 6. Visual Integrity
  console.log('\n6. Visual Integrity');
  
  // Check for broken images
  const images = await page.locator('#products img').all();
  let brokenImages = 0;
  for (const img of images) {
    const naturalWidth = await img.evaluate(el => el.naturalWidth);
    if (naturalWidth === 0) brokenImages++;
  }
  console.log(`   Total images: ${images.length}`);
  console.log(`   Broken images: ${brokenImages}`);
  
  // Check console errors
  const logs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });
  await page.waitForTimeout(1000);
  console.log(`   Console errors: ${logs.length}`);
  if (logs.length > 0) {
    logs.forEach(log => console.log(`   - ${log}`));
  }
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/farmer-products-verification.png', fullPage: true });
  console.log('\nScreenshot saved to test-results/farmer-products-verification.png');
  
  console.log('\n=== VERIFICATION COMPLETE ===\n');
});
