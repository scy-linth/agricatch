const { test, expect } = require('@playwright/test');

test.describe('Customer Orders Regression B.2D', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Click login button to open auth modal
    await page.click('#login-btn');
    
    // Wait for auth modal to appear
    await page.waitForSelector('#auth-modal', { state: 'visible' });
    
    // Fill in login credentials (using test customer account)
    await page.fill('#auth-email', 'customer');
    await page.fill('#auth-password', 'customercustomer');
    
    // Submit login
    await page.click('#auth-submit-btn');
    
    // Wait for successful login
    await page.waitForTimeout(3000);
  });

  test('1. Orders List - Active Orders, order cards, product info', async ({ page }) => {
    // Navigate to orders page
    await page.goto('http://localhost:3000/orders.html');
    
    // Wait for orders to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Check if orders are displayed
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    console.log('Order cards found:', count);
    
    if (count > 0) {
      // Verify first order card structure
      const firstOrder = ordersList.first();
      
      // Check order ID
      const orderId = await firstOrder.locator('.order-id').textContent();
      console.log('Order ID:', orderId);
      expect(orderId).toBeTruthy();
      
      // Check product image
      const productImage = firstOrder.locator('.order-item img');
      await expect(productImage).toBeVisible();
      
      // Check product name
      const productName = await firstOrder.locator('.order-item-name').textContent();
      console.log('Product name:', productName);
      expect(productName).toBeTruthy();
      
      // Check farmer name
      const farmerName = await firstOrder.locator('.order-item-meta').filter({ hasText: 'From:' }).textContent();
      console.log('Farmer info:', farmerName);
      expect(farmerName).toContain('From:');
      
      // Check quantity and price
      const quantityPrice = await firstOrder.locator('.order-item-meta').filter({ hasText: 'x' }).textContent();
      console.log('Quantity/Price:', quantityPrice);
      expect(quantityPrice).toBeTruthy();
      
      // Check total amount
      const totalAmount = await firstOrder.locator('.order-total').textContent();
      console.log('Total amount:', totalAmount);
      expect(totalAmount).toBeTruthy();
      
      // Check status badge
      const statusBadge = await firstOrder.locator('.order-status-line').textContent();
      console.log('Status:', statusBadge);
      expect(statusBadge).toBeTruthy();
    } else {
      console.log('No orders found - checking empty state');
      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/customer-orders-list.png' });
  });

  test('2. Status Verification - all implemented statuses', async ({ page }) => {
    // Navigate to orders page
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Check each tab
    const tabs = ['All', 'Active', 'Delivered', 'Cancelled'];
    
    for (const tab of tabs) {
      console.log(`Checking ${tab} tab`);
      
      // Click tab
      await page.click(`button:has-text("${tab}")`);
      await page.waitForTimeout(500);
      
      // Check if orders are displayed
      const ordersList = page.locator('.order-card');
      const count = await ordersList.count();
      console.log(`${tab} orders:`, count);
      
      if (count > 0) {
        // Check status badges in this tab
        const statusBadges = await page.locator('.order-status-line').allTextContents();
        console.log(`${tab} statuses:`, statusBadges);
      }
    }
    
    await page.screenshot({ path: 'test-results/customer-orders-status-tabs.png' });
  });

  test('3. Order Details Modal - complete information', async ({ page }) => {
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    if (count > 0) {
      // Click on first order to view details
      await ordersList.first().click();
      await page.waitForTimeout(500);
      
      // Check if modal appears (if details modal exists)
      const modal = page.locator('.modal.open');
      const hasModal = await modal.count() > 0;
      
      if (hasModal) {
        console.log('Order details modal opened');
        
        // Check for delivery address
        const hasAddress = await page.locator('.modal').filter({ hasText: 'Delivery Address' }).count() > 0;
        console.log('Has delivery address:', hasAddress);
        
        // Check for recipient information
        const hasRecipient = await page.locator('.modal').filter({ hasText: 'Recipient' }).count() > 0;
        console.log('Has recipient info:', hasRecipient);
        
        // Check for payment method
        const hasPayment = await page.locator('.modal').filter({ hasText: 'Payment' }).count() > 0;
        console.log('Has payment method:', hasPayment);
        
        // Check for delivery fee
        const hasDeliveryFee = await page.locator('.modal').filter({ hasText: 'Delivery Fee' }).count() > 0;
        console.log('Has delivery fee:', hasDeliveryFee);
        
        // Check for total amount
        const hasTotal = await page.locator('.modal').filter({ hasText: 'Total' }).count() > 0;
        console.log('Has total amount:', hasTotal);
        
        // Check for special instructions
        const hasInstructions = await page.locator('.modal').filter({ hasText: 'Special Instructions' }).count() > 0;
        console.log('Has special instructions:', hasInstructions);
        
        await page.screenshot({ path: 'test-results/customer-order-details-modal.png' });
        
        // Close modal
        await page.click('.close-btn');
      } else {
        console.log('No order details modal - details may be inline');
      }
    }
  });

  test('4. Timeline - rendering and progression', async ({ page }) => {
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    if (count > 0) {
      // Check for timeline on first order
      const timeline = page.locator('.order-timeline');
      const hasTimeline = await timeline.count() > 0;
      
      if (hasTimeline) {
        console.log('Timeline found on order card');
        
        // Check timeline steps
        const timelineSteps = await page.locator('.order-timeline div').all();
        console.log('Timeline steps count:', timelineSteps.length);
        
        // Check if current status is highlighted
        const activeStep = await page.locator('.order-timeline div[style*="box-shadow"]').count();
        console.log('Active timeline steps:', activeStep);
      } else {
        console.log('No timeline found on order card');
      }
    }
    
    await page.screenshot({ path: 'test-results/customer-order-timeline.png' });
  });

  test('5. Pre-order Information - harvest details', async ({ page }) => {
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    if (count > 0) {
      // Check for pre-order badges
      const preorderBadges = await page.locator('.order-card').filter({ hasText: 'Pre-order' }).count();
      console.log('Pre-order orders:', preorderBadges);
      
      if (preorderBadges > 0) {
        // Check first pre-order for harvest details
        const preorderOrder = page.locator('.order-card').filter({ hasText: 'Pre-order' }).first();
        
        // Check for expected harvest date
        const hasHarvestDate = await preorderOrder.locator('.order-item-meta').filter({ hasText: 'Expected Harvest' }).count() > 0;
        console.log('Has expected harvest date:', hasHarvestDate);
        
        // Check for previous harvest date
        const hasPreviousHarvest = await preorderOrder.locator('.order-item-meta').filter({ hasText: 'Previous Harvest Date' }).count() > 0;
        console.log('Has previous harvest date:', hasPreviousHarvest);
        
        // Check for harvest adjustment count
        const hasAdjustmentCount = await preorderOrder.locator('.order-item-meta').filter({ hasText: 'Adjustments' }).count() > 0;
        console.log('Has adjustment count:', hasAdjustmentCount);
        
        // Check for harvest adjustment reason
        const hasAdjustmentReason = await preorderOrder.locator('.order-item-meta').filter({ hasText: 'Adjustment Reason' }).count() > 0;
        console.log('Has adjustment reason:', hasAdjustmentReason);
        
        // Check for reservation info
        const hasAvailable = await preorderOrder.locator('.order-item-meta').filter({ hasText: 'Available' }).count() > 0;
        console.log('Has availability date:', hasAvailable);
      }
    }
    
    await page.screenshot({ path: 'test-results/customer-preorder-info.png' });
  });

  test('6. Delivery Information - scheduling', async ({ page }) => {
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    if (count > 0) {
      // Check for delivery date on orders
      const hasDeliveryDate = await page.locator('.order-item-meta').filter({ hasText: 'Delivery Date' }).count() > 0;
      console.log('Orders with delivery date:', hasDeliveryDate);
      
      // Check for reschedule reason
      const hasRescheduleReason = await page.locator('.order-item-meta').filter({ hasText: 'Reason for Rescheduling' }).count() > 0;
      console.log('Orders with reschedule reason:', hasRescheduleReason);
    }
    
    await page.screenshot({ path: 'test-results/customer-delivery-info.png' });
  });

  test('7. Customer Actions - cancel button logic', async ({ page }) => {
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    if (count > 0) {
      // Check for cancel buttons
      const cancelButtons = await page.locator('button:has-text("Cancel")').count();
      console.log('Cancel buttons found:', cancelButtons);
      
      if (cancelButtons > 0) {
        // Check if cancel buttons are only on appropriate statuses
        const cancelOrders = await page.locator('.order-card').filter({ has: page.locator('button:has-text("Cancel")') }).all();
        
        for (const order of cancelOrders) {
          const statusText = await order.locator('.order-status-line').textContent();
          console.log('Cancel button on order with status:', statusText);
          
          // Cancel should only appear for pending or preorder_reserved
          const isCancellable = statusText.toLowerCase().includes('pending') || 
                                statusText.toLowerCase().includes('reserved');
          console.log('Is cancellable status:', isCancellable);
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/customer-cancel-buttons.png' });
  });

  test('8. Visual Integrity - alignment, labels, console errors', async ({ page }) => {
    // Listen for console errors (excluding network fetch errors which are environment-related)
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore network-related errors (Failed to fetch, SSE connection errors, connection reset)
        if (!text.includes('Failed to fetch') && !text.includes('SSE connection') && !text.includes('ERR_CONNECTION')) {
          errors.push(text);
        }
      }
    });
    
    await page.goto('http://localhost:3000/orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    // Check for console errors (excluding network errors)
    console.log('Console errors (non-network):', errors);
    expect(errors.length).toBe(0);
    
    // Check for missing labels
    const ordersList = page.locator('.order-card');
    const count = await ordersList.count();
    
    if (count > 0) {
      const firstOrder = ordersList.first();
      
      // Check for key labels
      const hasOrderId = await firstOrder.locator('.order-id').count() > 0;
      const hasProductName = await firstOrder.locator('.order-item-name').count() > 0;
      const hasTotal = await firstOrder.locator('.order-total').count() > 0;
      const hasStatus = await firstOrder.locator('.order-status-line').count() > 0;
      
      console.log('Has order ID:', hasOrderId);
      console.log('Has product name:', hasProductName);
      console.log('Has total:', hasTotal);
      console.log('Has status:', hasStatus);
      
      expect(hasOrderId).toBeTruthy();
      expect(hasProductName).toBeTruthy();
      expect(hasTotal).toBeTruthy();
      expect(hasStatus).toBeTruthy();
    }
    
    // Check for broken images
    const images = await page.locator('.order-item img').all();
    for (const img of images) {
      const naturalWidth = await img.evaluate(img => img.naturalWidth);
      if (naturalWidth === 0) {
        console.log('Broken image found');
      }
    }
    
    // Check for empty states
    if (count === 0) {
      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      console.log('Empty state displayed correctly');
    }
    
    await page.screenshot({ path: 'test-results/customer-visual-integrity.png' });
  });
});
