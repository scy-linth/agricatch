const { test, expect } = require('@playwright/test');

test.describe('Checkout Cart API Debug', () => {
  test('Add item via API then test checkout', async ({ page, request }) => {
    console.log('=== Starting Checkout API Debug Test ===');
    
    // Setup console logging
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text });
      if (text.includes('[Checkout]') || text.includes('404')) {
        console.log(`[Browser Console] ${text}`);
      }
    });

    // Setup network monitoring
    const networkRequests = [];
    page.on('response', response => {
      if (response.url().includes('/api/cart')) {
        console.log(`[Network Response] ${response.status()} ${response.url()}`);
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    // Step 1: Login via API (bypasses CAPTCHA by using direct database query or test mode)
    // For now, let's try to get an existing token or create a test user
    console.log('=== Attempting to get token via API ===');
    
    // Try to login with test credentials (bypass CAPTCHA with test mode header)
    const loginResponse = await request.post('http://localhost:3000/api/auth/login', {
      headers: {
        'x-test-mode': 'true'
      },
      data: {
        email: 'customer@gmail.com',
        password: 'customercustomer'
      }
    });

    let token;
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      token = loginData.token;
      console.log('=== Login successful via API ===');
    } else {
      console.log('=== API login failed (CAPTCHA), trying alternative ===');
      const errorText = await loginResponse.text();
      console.log('Login error:', errorText);
      
      // If CAPTCHA blocks, we need to temporarily disable it in backend
      console.log('=== CAPTCHA is blocking API login ===');
      console.log('=== Please temporarily disable CAPTCHA in backend to run this test ===');
      console.log('=== Or provide a valid token from a manual login ===');
      return;
    }

    // Step 2: Get available products
    console.log('=== Getting available products ===');
    const productsResponse = await request.get('http://localhost:3000/api/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!productsResponse.ok()) {
      console.log('Failed to get products');
      return;
    }

    const productsData = await productsResponse.json();
    const availableProducts = productsData.products?.filter(p => p.status === 'approved' && p.stock_quantity > 0) || [];
    console.log(`Available products: ${availableProducts.length}`);

    if (availableProducts.length === 0) {
      console.log('No available products to add to cart');
      return;
    }

    const firstProduct = availableProducts[0];
    console.log(`Adding product: ${firstProduct.name} (ID: ${firstProduct.id})`);

    // Step 3: Add product to cart via API
    const addResponse = await request.post('http://localhost:3000/api/cart', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        product_id: firstProduct.id,
        quantity: 1
      }
    });

    console.log(`Add to cart response: ${addResponse.status}`);
    if (!addResponse.ok()) {
      const errorText = await addResponse.text();
      console.log('Add to cart error:', errorText);
    }

    // Step 4: Navigate to checkout with token
    console.log('=== Navigating to checkout ===');
    await page.goto('http://localhost:3000/index.html');
    await page.evaluate((authToken) => {
      localStorage.setItem('token', authToken);
    }, token);

    await page.goto('http://localhost:3000/checkout.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 5: Check checkout state
    const checkoutForm = page.locator('#checkout-form');
    const formVisible = await checkoutForm.isVisible();
    console.log(`=== Checkout form visible: ${formVisible} ===`);

    if (!formVisible) {
      console.log('=== Checkout form not visible ===');
      const loadingEl = page.locator('#checkout-loading');
      const loadingVisible = await loadingEl.isVisible();
      console.log(`Loading element visible: ${loadingVisible}`);
      return;
    }

    // Get cart items
    const cartItems = page.locator('.co-item');
    const itemCount = await cartItems.count();
    console.log(`=== Cart items: ${itemCount} ===`);

    if (itemCount === 0) {
      console.log('=== No cart items ===');
      return;
    }

    // Log each item
    for (let i = 0; i < itemCount; i++) {
      const item = cartItems.nth(i);
      const name = await item.locator('.co-item-name').textContent();
      const removeBtn = item.locator('.co-remove-btn-qty');
      const onclick = await removeBtn.getAttribute('onclick');
      console.log(`Item ${i + 1}: ${name.trim()}`);
      console.log(`  Remove onclick: ${onclick}`);
    }

    // Test quantity update and item total
    const firstItem = cartItems.first();
    const qtyInput = firstItem.locator('.co-qty-input');
    const itemTotalEl = firstItem.locator('.co-item-total');
    const currentQty = await qtyInput.inputValue();
    const currentItemTotal = await itemTotalEl.textContent();
    console.log(`=== Current quantity: ${currentQty} ===`);
    console.log(`=== Current item total: ${currentItemTotal} ===`);

    // Click plus button
    const plusBtn = firstItem.locator('.co-qty-btn').last();
    await plusBtn.click();
    console.log('=== Clicked plus button ===');
    
    // Wait a short time for instant UI update (not API response)
    await page.waitForTimeout(100);

    // Check if item total updated immediately
    const newItemTotal = await itemTotalEl.textContent();
    const newQty = await qtyInput.inputValue();
    console.log(`=== New quantity (instant): ${newQty} ===`);
    console.log(`=== New item total (instant): ${newItemTotal} ===`);
    
    if (currentItemTotal === newItemTotal) {
      console.log('=== FAIL: Item total did not update in real-time ===');
    } else {
      console.log('=== PASS: Item total updated in real-time ===');
    }

    // Wait for API to complete
    await page.waitForTimeout(1000);

    // Check console logs
    console.log('=== Console Logs ===');
    consoleLogs.forEach(log => {
      if (log.text.includes('[Checkout]') || log.text.includes('404') || log.type === 'error') {
        console.log(`  [${log.type}] ${log.text}`);
      }
    });

    console.log('=== Network Requests ===');
    networkRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} - ${req.status}`);
    });

    // Take screenshot
    await page.screenshot({ path: 'test-results/checkout-api-debug.png', fullPage: true });
    console.log('=== Screenshot saved ===');

    // Test visibility change - simulate tab switch
    console.log('=== Testing visibility change ===');
    await page.evaluate(() => {
      // Trigger visibility change event
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    // Wait for refresh
    await page.waitForTimeout(1000);
    
    console.log('=== Visibility change test complete ===');

    // Test delete confirmation modal
    console.log('=== Testing delete confirmation modal ===');
    const itemToDelete = cartItems.first();
    const removeBtn = itemToDelete.locator('.co-remove-btn-qty');
    
    // Click remove button
    await removeBtn.click();
    
    // Wait for modal to appear
    await page.waitForSelector('#deleteConfirmModal', { state: 'visible', timeout: 5000 });
    console.log('=== Delete confirmation modal appeared ===');
    
    // Check modal content
    const modalTitle = await page.locator('#deleteConfirmModal h5').textContent();
    const modalBody = await page.locator('#deleteConfirmModal p').textContent();
    console.log(`Modal title: ${modalTitle}`);
    console.log(`Modal body: ${modalBody}`);
    
    // Check buttons exist
    const cancelBtn = page.locator('#deleteConfirmModal button[data-bs-dismiss="modal"]');
    const confirmBtn = page.locator('#confirm-delete-btn');
    const cancelVisible = await cancelBtn.isVisible();
    const confirmVisible = await confirmBtn.isVisible();
    console.log(`Cancel button visible: ${cancelVisible}`);
    console.log(`Confirm button visible: ${confirmVisible}`);
    
    // Close modal by clicking cancel
    await cancelBtn.click();
    await page.waitForTimeout(500);
    
    const modalHidden = await page.locator('#deleteConfirmModal').isHidden();
    console.log(`Modal hidden after cancel: ${modalHidden}`);
    
    console.log('=== Delete modal test complete ===');

    // Test phone number validation
    console.log('=== Testing phone number validation ===');
    const phoneInput = page.locator('#checkout-phone');
    const phoneVisible = await phoneInput.isVisible();
    console.log(`Phone input visible: ${phoneVisible}`);
    
    if (phoneVisible) {
      // Test invalid phone number
      await phoneInput.fill('123');
      await phoneInput.blur();
      await page.waitForTimeout(500);
      const phoneValue1 = await phoneInput.inputValue();
      console.log(`Phone after '123': ${phoneValue1}`);
      
      // Test valid phone number
      await phoneInput.fill('9123456789');
      await phoneInput.blur();
      await page.waitForTimeout(500);
      const phoneValue2 = await phoneInput.inputValue();
      console.log(`Phone after '9123456789': ${phoneValue2}`);
      
      // Check if it was formatted
      if (phoneValue2 === '912 345 6789') {
        console.log('=== PASS: Phone number formatted correctly ===');
      } else {
        console.log('=== FAIL: Phone number not formatted ===');
      }
    }
    
    console.log('=== Phone validation test complete ===');

    // Test delivery address selection
    console.log('=== Testing delivery address selection ===');
    const addressSelect = page.locator('#checkout-address-select');
    const addressVisible = await addressSelect.isVisible();
    console.log(`Address select visible: ${addressVisible}`);
    
    if (addressVisible) {
      const addressOptions = await addressSelect.locator('option').count();
      console.log(`Address options count: ${addressOptions}`);
      
      if (addressOptions > 0) {
        // Select first address
        await addressSelect.selectOption({ index: 0 });
        await page.waitForTimeout(500);
        const selectedValue = await addressSelect.inputValue();
        console.log(`Selected address ID: ${selectedValue}`);
        console.log('=== PASS: Address selection works ===');
      } else {
        console.log('=== No addresses available to test ===');
      }
    }
    
    console.log('=== Address selection test complete ===');

    // Test payment method selection
    console.log('=== Testing payment method selection ===');
    const paymentMethods = page.locator('input[name="payment_method"]');
    const paymentCount = await paymentMethods.count();
    console.log(`Payment method options: ${paymentCount}`);
    
    if (paymentCount > 0) {
      // Select first payment method
      await paymentMethods.first().check();
      await page.waitForTimeout(500);
      const isChecked = await paymentMethods.first().isChecked();
      console.log(`Payment method selected: ${isChecked}`);
      
      if (isChecked) {
        console.log('=== PASS: Payment method selection works ===');
      } else {
        console.log('=== FAIL: Payment method selection failed ===');
      }
    } else {
      console.log('=== No payment methods available ===');
    }
    
    console.log('=== Payment method test complete ===');

    // Test address display based on setting
    console.log('=== Testing address display based on setting ===');
    
    // Get current setting
    const settingsResponse = await page.request.get('http://localhost:3000/api/settings');
    const settingsData = await settingsResponse.json();
    console.log(`Current use_default_delivery_address: ${settingsData.use_default_delivery_address}`);
    
    if (settingsData.use_default_delivery_address) {
      // Check for Trabajo Market address display
      const addressDisplay = page.locator('.address-display');
      const addressVisible = await addressDisplay.isVisible();
      console.log(`Address display visible: ${addressVisible}`);
      
      if (addressVisible) {
        const addressText = await addressDisplay.textContent();
        console.log(`Address text: ${addressText}`);
        
        if (addressText.includes('Trabajo Market')) {
          console.log('=== PASS: Trabajo Market address displayed when default address is ON ===');
        } else {
          console.log('=== FAIL: Trabajo Market address not found ===');
        }
      }
    } else {
      // Check for Add Address button
      const setAddressBtn = page.locator('#set-address-btn');
      const btnVisible = await setAddressBtn.isVisible();
      console.log(`Set Address button visible: ${btnVisible}`);
      
      if (btnVisible) {
        console.log('=== PASS: Add Address button shown when default address is OFF ===');
      } else {
        console.log('=== FAIL: Add Address button not found ===');
      }
    }
    
    console.log('=== Address display test complete ===');

    // Test auto-fill functionality
    console.log('=== Testing auto-fill functionality ===');
    
    // Check if auto-fill methods exist
    const hasAutoFill = await page.evaluate(() => {
        return typeof window.checkoutPage.autoFillCheckoutForm === 'function' &&
               typeof window.checkoutPage.saveCheckoutInfo === 'function' &&
               typeof window.checkoutPage.getLastCheckoutInfo === 'function' &&
               typeof window.checkoutPage.isTrabajoMarketAddress === 'function';
    });
    
    console.log(`Auto-fill methods exist: ${hasAutoFill}`);
    
    if (hasAutoFill) {
        console.log('=== PASS: Auto-fill methods are available ===');
        
        // Test Trabajo Market detection
        const isTrabajo = await page.evaluate(() => {
            return window.checkoutPage.isTrabajoMarketAddress({
                street: 'M. Dela Fuente St.',
                barangay: 'Sampaloc',
                city: 'Manila',
                province: 'Metro Manila'
            });
        });
        
        console.log(`Trabajo Market detection: ${isTrabajo}`);
        
        if (isTrabajo) {
            console.log('=== PASS: Trabajo Market address detected correctly ===');
        } else {
            console.log('=== FAIL: Trabajo Market address not detected ===');
        }
        
        // Test non-Trabajo address
        const isNotTrabajo = await page.evaluate(() => {
            return window.checkoutPage.isTrabajoMarketAddress({
                street: '123 Main St',
                barangay: 'Barangay 1',
                city: 'Quezon City',
                province: 'Metro Manila'
            });
        });
        
        console.log(`Non-Trabajo address detection: ${isNotTrabajo}`);
        
        if (!isNotTrabajo) {
            console.log('=== PASS: Non-Trabajo address not detected as Trabajo ===');
        } else {
            console.log('=== FAIL: Non-Trabajo address incorrectly detected ===');
        }
    } else {
        console.log('=== FAIL: Auto-fill methods not available ===');
    }
    
    console.log('=== Auto-fill test complete ===');
  });
});
