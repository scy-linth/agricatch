const { test, expect } = require('@playwright/test');

test.describe('Farmer Edit Product Date Debug', () => {
  test('Debug Best Before date display in edit modal', async ({ page }) => {
    // Get token via API
    const tokenResponse = await page.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'dhelhilis@gmail.com',
        password: 'password123'
      }
    });
    const tokenData = await tokenResponse.json();
    const token = tokenData.token;

    // Capture console logs from the page
    const pageLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DEBUG')) {
        pageLogs.push(text);
      }
    });

    // Navigate to farmer page with token
    await page.goto('/farmer.html');
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
    }, token);
    await page.reload();

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Click on My Products link in sidebar - use href selector
    await page.click('aside a[href="#products"]');
    await page.waitForTimeout(3000);

    // Take screenshot to see what's on the page
    await page.screenshot({ path: 'test-results/farmer-products-page.png', fullPage: true });

    // Find all products - try different selectors
    const pageContent = await page.evaluate(() => {
      const productCards = document.querySelectorAll('.product-card');
      const products = [];
      productCards.forEach(card => {
        const id = card.dataset.productId;
        const isPreorder = card.dataset.isPreorder === 'true';
        const name = card.querySelector('.product-name')?.textContent || '';
        products.push({ id, isPreorder, name });
      });
      
      // Also check for any product-related elements
      const allElements = document.querySelectorAll('[data-product-id]');
      const allProducts = [];
      allElements.forEach(el => {
        const id = el.dataset.productId;
        const name = el.querySelector('.product-name')?.textContent || el.textContent?.substring(0, 50) || '';
        allProducts.push({ id, name });
      });
      
      // Check for tabs
      const tabs = document.querySelectorAll('.tab-btn, .product-tabs button');
      const tabInfo = Array.from(tabs).map(t => ({ text: t.textContent, active: t.classList.contains('active') }));
      
      return {
        productCards: products,
        allProductElements: allProducts,
        totalProductCards: productCards.length,
        totalElementsWithDataId: allElements.length,
        tabs: tabInfo
      };
    });

    console.log('Page content:', pageContent);

    // Get unique product IDs from the elements
    const productIds = [...new Set(pageContent.allProductElements.map(p => p.id))];
    console.log('Product IDs found:', productIds);

    // Use the first product ID (or try to find pakwan-related)
    const targetProductId = productIds[0];
    if (!targetProductId) {
      console.log('No product ID found');
      return;
    }

    console.log('Editing product ID:', targetProductId);

    // Click edit button using the product ID - the element itself is the button
    await page.click(`[data-product-id="${targetProductId}"]:has-text("Edit")`);
    await page.waitForSelector('#edit-product-modal.open', { state: 'visible' });

    // Wait for values to populate
    await page.waitForTimeout(1000);

    // Check the expiry date input value
    const expiryValue = await page.evaluate(() => {
      const expiryEl = document.getElementById('edit-expiry-date');
      const expiryGroup = document.getElementById('edit-available-expiry-group');
      return {
        value: expiryEl ? expiryEl.value : 'element not found',
        display: expiryGroup ? expiryGroup.style.display : 'group not found',
        visible: expiryEl ? (expiryEl.offsetParent !== null) : false,
        disabled: expiryEl ? expiryEl.disabled : false,
        readonly: expiryEl ? expiryEl.readOnly : false
      };
    });

    console.log('Expiry date input state:', expiryValue);

    // Take screenshot
    await page.screenshot({ path: 'test-results/farmer-edit-date-debug.png', fullPage: false });

    // Check the product data from API
    const productData = await page.evaluate(async ({ id, token }) => {
      const response = await fetch(`http://localhost:3000/api/products/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      return data.product;
    }, { id: targetProductId, token });

    console.log('Product data from API:', {
      id: productData.id,
      name: productData.name,
      is_preorder: productData.is_preorder,
      expiry_date: productData.expiry_date,
      preorder_availability_date: productData.preorder_availability_date
    });

    // Print all captured debug logs
    console.log('\n=== PAGE DEBUG LOGS ===');
    pageLogs.forEach(log => console.log(log));
    console.log('=== END PAGE DEBUG LOGS ===');
  });
});
