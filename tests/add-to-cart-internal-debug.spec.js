const { test, expect } = require('@playwright/test');

/**
 * Internal Function Debug for Add to Cart
 * Injects logging inside the addToCart function
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - Internal Function Debug', async ({ page }) => {
  console.log('\n=== ADD TO CART INTERNAL FUNCTION DEBUG ===\n');
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Open product details
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();
  await page.waitForTimeout(1000);
  
  // Inject logging into the addToCart function
  console.log('Step 1: Inject logging into addToCart function');
  const injectionResult = await page.evaluate(() => {
    const originalAddToCart = window.app.addToCart;
    let executionLog = [];
    
    window.app.addToCart = async function(productId, quantity = 1) {
      executionLog.push(`START: addToCart called with productId=${productId}, quantity=${quantity}`);
      
      // Validate productId
      if (!productId || productId === 'null' || productId === 'undefined') {
        executionLog.push('VALIDATION_FAILED: Invalid productId');
        console.error('[ERROR] Invalid productId in addToCart:', productId);
        this.showMessage('Invalid product ID', 'error');
        return;
      }
      executionLog.push('VALIDATION_PASSED');
      
      const addToCartBtn = event?.target?.closest('.add-to-cart-btn');
      executionLog.push(`BUTTON_FOUND: ${!!addToCartBtn}`);
      
      try {
        executionLog.push('TRY_BLOCK_START');
        
        const apiBase = window.app.apiBase;
        const token = window.app.token;
        const sessionId = window.app.sessionId;
        
        executionLog.push(`API_BASE: ${apiBase}`);
        executionLog.push(`TOKEN_EXISTS: ${!!token}`);
        executionLog.push(`SESSION_ID: ${sessionId}`);
        
        executionLog.push('FETCH_START');
        const response = await fetch(`${apiBase}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                productId,
                quantity,
                sessionId
            })
        });
        
        executionLog.push(`FETCH_COMPLETE: status=${response.status}`);
        
        const data = await response.json();
        executionLog.push(`DATA_PARSED: ${JSON.stringify(data).substring(0, 100)}`);
        
        if (response.ok) {
            executionLog.push('SUCCESS_PATH');
            
            if (addToCartBtn) {
                addToCartBtn.classList.add('adding');
                setTimeout(() => addToCartBtn.classList.remove('adding'), 400);
                executionLog.push('ANIMATION_TRIGGERED');
            }
            
            const cartCountEl = document.getElementById('cart-count');
            const count = data.summary ? (data.summary.itemCount || 0) : 0;
            executionLog.push(`CART_COUNT_BEFORE_UPDATE: ${cartCountEl ? cartCountEl.textContent : 'NOT_FOUND'}`);
            executionLog.push(`NEW_CART_COUNT: ${count}`);
            
            if (cartCountEl) {
                cartCountEl.textContent = count;
                cartCountEl.style.display = count > 0 ? 'inline-flex' : 'none';
                cartCountEl.classList.remove('bounce');
                void cartCountEl.offsetWidth;
                cartCountEl.classList.add('bounce');
                executionLog.push('CART_COUNT_UPDATED');
            }
            
            this.showMessage('Item added to cart!', 'success', { position: 'center' });
            executionLog.push('SUCCESS_MESSAGE_SHOWN');
            
            const cartSidebar = document.getElementById('cart-sidebar');
            if (cartSidebar && cartSidebar.classList.contains('open')) {
                this.renderCart(data);
                executionLog.push('CART_RENDERED');
            }
        } else {
            executionLog.push(`ERROR_PATH: ${data.message}`);
            this.showMessage(data.message || 'Failed to add item to cart', 'error');
        }
      } catch (error) {
        executionLog.push(`CATCH_BLOCK: ${error.message}`);
        console.error('Error adding to cart:', error);
        this.showMessage('Failed to add item to cart', 'error');
      }
      
      executionLog.push('END');
      window.__addToCartLog = executionLog;
      return executionLog;
    };
    
    return { success: true };
  });
  
  console.log(`  Injection result: ${JSON.stringify(injectionResult)}`);
  
  // Click the button
  console.log('\nStep 2: Click Add to Cart button');
  const addToCartBtn = page.locator('.add-to-cart-btn').first();
  await addToCartBtn.click({ force: true });
  await page.waitForTimeout(2000);
  
  // Get the execution log
  console.log('\nStep 3: Get execution log');
  const executionLog = await page.evaluate(() => window.__addToCartLog);
  
  if (executionLog) {
    console.log('\nExecution Log:');
    executionLog.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
  } else {
    console.log('  No execution log found - function may not have been called');
  }
  
  // Check cart count
  console.log('\nStep 4: Check cart count');
  const cartCount = await page.locator('.cart-count').first();
  const count = await cartCount.count() > 0 ? await cartCount.textContent() : 'NOT_FOUND';
  console.log(`  Cart count: ${count}`);
  
  // Screenshot
  await page.screenshot({ path: 'test-results/add-to-cart-internal-debug.png', fullPage: true });
  console.log('\nScreenshot saved: test-results/add-to-cart-internal-debug.png');
});
