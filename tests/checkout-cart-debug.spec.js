const { test, expect } = require('@playwright/test');

test.describe('Checkout Page Cart Debug', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    // Login via API to get token (bypasses CAPTCHA)
    const loginResponse = await request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'customer@gmail.com',
        password: 'customercustomer'
      }
    });

    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      authToken = loginData.token;
      console.log('=== Login successful, token obtained ===');
    } else {
      console.log('=== Login failed, using test customer credentials ===');
      const errorText = await loginResponse.text();
      console.log('Login error:', errorText);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Set token in localStorage before navigating
    if (authToken) {
      await page.goto('http://localhost:3000/index.html');
      await page.evaluate((token) => {
        localStorage.setItem('token', token);
      }, authToken);
    }

    // Navigate to checkout page
    await page.goto('http://localhost:3000/checkout.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('Check cart loading and item IDs', async ({ page }) => {
    console.log('=== Checking Cart Loading ===');
    
    // Wait for checkout form to appear
    await page.waitForSelector('#checkout-form', { timeout: 10000 }).catch(() => {
      console.log('Checkout form not found - user might not be logged in');
    });
    
    // Check if loading screen is present
    const loadingEl = await page.locator('#checkout-loading').isVisible();
    console.log('Loading element visible:', loadingEl);
    
    // Wait for loading to complete
    await page.waitForTimeout(2000);
    
    // Check if form is displayed
    const formVisible = await page.locator('#checkout-form').isVisible();
    console.log('Checkout form visible:', formVisible);
    
    if (formVisible) {
      // Get all cart items
      const cartItems = await page.locator('.co-item').all();
      console.log('Number of cart items:', cartItems.length);
      
      // Log each item's details
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const itemName = await item.locator('.co-item-name').textContent();
        const itemPrice = await item.locator('.co-item-meta').first().textContent();
        console.log(`Item ${i + 1}: ${itemName.trim()} - ${itemPrice.trim()}`);
        
        // Check if remove button exists and get its onclick attribute
        const removeBtn = item.locator('.co-remove-btn-qty');
        const removeBtnExists = await removeBtn.count() > 0;
        console.log(`  Remove button exists: ${removeBtnExists}`);
        
        if (removeBtnExists) {
          const onclick = await removeBtn.getAttribute('onclick');
          console.log(`  Remove button onclick: ${onclick}`);
        }
      }
    } else {
      console.log('Form not visible - checking for error message');
      const errorToast = await page.locator('.toast').isVisible();
      console.log('Error toast visible:', errorToast);
    }
  });

  test('Test quantity update and monitor network requests', async ({ page }) => {
    console.log('=== Testing Quantity Update ===');
    
    // Setup network monitoring
    const failedRequests = [];
    page.on('response', (response) => {
      if (response.status() === 404) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
        console.log(`404 Error: ${response.request().method()} ${response.url()}`);
      }
    });
    
    // Wait for cart to load
    await page.waitForSelector('#checkout-form', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Get first cart item
    const firstItem = page.locator('.co-item').first();
    const itemCount = await firstItem.count();
    
    if (itemCount === 0) {
      console.log('No cart items found');
      return;
    }
    
    console.log('Found cart item, testing quantity update');
    
    // Get current quantity
    const qtyInput = firstItem.locator('.co-qty-input');
    const currentQty = await qtyInput.inputValue();
    console.log('Current quantity:', currentQty);
    
    // Click plus button
    const plusBtn = firstItem.locator('.co-qty-btn').last();
    await plusBtn.click();
    
    // Wait for network requests
    await page.waitForTimeout(1000);
    
    // Check for failed requests
    console.log('Failed requests during quantity update:', failedRequests.length);
    failedRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} - ${req.status}`);
    });
    
    // Check if quantity updated
    const newQty = await qtyInput.inputValue();
    console.log('New quantity:', newQty);
  });

  test('Test remove item and monitor network requests', async ({ page }) => {
    console.log('=== Testing Remove Item ===');
    
    // Setup network monitoring
    const failedRequests = [];
    page.on('response', (response) => {
      if (response.status() === 404) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
        console.log(`404 Error: ${response.request().method()} ${response.url()}`);
      }
    });
    
    // Wait for cart to load
    await page.waitForSelector('#checkout-form', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Get first cart item
    const firstItem = page.locator('.co-item').first();
    const itemCount = await firstItem.count();
    
    if (itemCount === 0) {
      console.log('No cart items found');
      return;
    }
    
    console.log('Found cart item, testing remove');
    
    // Get remove button onclick to extract cart ID
    const removeBtn = firstItem.locator('.co-remove-btn-qty');
    const onclick = await removeBtn.getAttribute('onclick');
    console.log('Remove button onclick:', onclick);
    
    // Click remove button
    await removeBtn.click();
    
    // Wait for modal to appear
    await page.waitForSelector('#deleteConfirmModal', { state: 'visible', timeout: 5000 });
    console.log('Delete confirmation modal appeared');
    
    // Click confirm button
    const confirmBtn = page.locator('#confirm-delete-btn');
    await confirmBtn.click();
    
    // Wait for network requests
    await page.waitForTimeout(2000);
    
    // Check for failed requests
    console.log('Failed requests during remove:', failedRequests.length);
    failedRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} - ${req.status}`);
    });
    
    // Check if item was removed
    const remainingItems = await page.locator('.co-item').count();
    console.log('Remaining items:', remainingItems);
  });

  test('Check API response for cart endpoint', async ({ page, request }) => {
    console.log('=== Testing Cart API Directly ===');
    
    // Get token from localStorage (if user is logged in)
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    if (!token) {
      console.log('No token found - user not logged in');
      return;
    }
    
    console.log('Token found, testing cart API');
    
    // Make direct API call to cart endpoint
    const response = await request.get('http://localhost:3000/api/cart', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Cart API response status:', response.status());
    
    if (response.ok()) {
      const data = await response.json();
      console.log('Cart items count:', data.cartItems?.length || 0);
      
      if (data.cartItems && data.cartItems.length > 0) {
        data.cartItems.forEach((item, index) => {
          console.log(`Item ${index + 1}: ID=${item.id}, Name=${item.name}, Quantity=${item.quantity}`);
        });
      }
    } else {
      console.log('Cart API failed:', response.status());
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
  });
});
