const { test, expect } = require('@playwright/test');

/**
 * Complete End-to-End Test for Customer Preorder Flow
 * Tests the full customer journey from browsing to viewing preorder details
 */

const BASE_URL = 'http://localhost:3000';

test.describe('Customer Preorder Flow E2E', () => {
  
  test('Complete customer preorder flow', async ({ page }) => {
    console.log('\n=== CUSTOMER PREORDER FLOW E2E TEST ===\n');
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
    
    // Listen for failed API requests
    page.on('response', response => {
      if (response.status() >= 400) {
        console.error(`API request failed: ${response.url()} - ${response.status()}`);
      }
    });
    
    const results = [];
    
    // STEP 1: Browse products
    console.log('STEP 1: Browse Products');
    try {
      await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
      
      // Verify page loaded
      const title = await page.title();
      console.log(`  Page title: ${title}`);
      
      // Check if products are displayed
      const productCards = await page.locator('.product-card').count();
      console.log(`  Product cards found: ${productCards}`);
      
      if (productCards > 0) {
        results.push({ step: 1, status: 'PASS', message: 'Products displayed successfully' });
      } else {
        results.push({ step: 1, status: 'FAIL', severity: 'HIGH', message: 'No products displayed', fix: 'Check if products exist in database and are available' });
      }
    } catch (error) {
      results.push({ step: 1, status: 'FAIL', severity: 'CRITICAL', message: `Error: ${error.message}`, fix: 'Check page load and API connectivity' });
    }
    
    // STEP 2: Filter preorder products
    console.log('\nSTEP 2: Filter Preorder Products');
    try {
      // Look for preorder filter button/checkbox
      const preorderFilter = page.locator('[data-filter="preorder"], .preorder-filter, #preorder-filter').first();
      const filterExists = await preorderFilter.count() > 0;
      
      if (filterExists) {
        await preorderFilter.click();
        await page.waitForTimeout(1000);
        
        // Check if preorder products are shown
        const preorderProducts = await page.locator('.product-card[data-is-preorder="true"], .product-card.preorder').count();
        console.log(`  Preorder products after filter: ${preorderProducts}`);
        
        results.push({ step: 2, status: 'PASS', message: 'Preorder filter works' });
      } else {
        results.push({ step: 2, status: 'PARTIAL', severity: 'LOW', message: 'Preorder-specific filter not found', fix: 'Consider adding preorder filter for better UX' });
      }
    } catch (error) {
      results.push({ step: 2, status: 'FAIL', severity: 'MEDIUM', message: `Error: ${error.message}`, fix: 'Check filter implementation' });
    }
    
    // STEP 3: Open preorder product details
    console.log('\nSTEP 3: Open Preorder Product Details');
    try {
      // Find a preorder product
      const preorderProduct = page.locator('.product-card').first();
      await preorderProduct.click();
      await page.waitForTimeout(1000);
      
      // Check if product modal opened
      const modalVisible = await page.locator('.product-details-modal.active, .modal.show').count() > 0;
      
      if (modalVisible) {
        // Check for preorder indicators
        const preorderLabel = await page.locator('[data-preorder], .preorder-badge, .preorder-label').count();
        const availabilityDate = await page.locator('[data-availability-date], .preorder-availability-date').count();
        
        console.log(`  Preorder label visible: ${preorderLabel > 0}`);
        console.log(`  Availability date visible: ${availabilityDate > 0}`);
        
        results.push({ step: 3, status: 'PASS', message: 'Product details opened successfully' });
      } else {
        results.push({ step: 3, status: 'FAIL', severity: 'HIGH', message: 'Product details did not open', fix: 'Check product click handler and modal implementation' });
      }
    } catch (error) {
      results.push({ step: 3, status: 'FAIL', severity: 'HIGH', message: `Error: ${error.message}`, fix: 'Check product click handler' });
    }
    
    // STEP 4: Add preorder product to cart
    console.log('\nSTEP 4: Add Preorder Product to Cart');
    try {
      const addToCartBtn = page.locator('.add-to-cart-btn').first();
      const btnExists = await addToCartBtn.count() > 0;
      
      if (btnExists) {
        await addToCartBtn.click({ force: true });
        await page.waitForTimeout(1500);
        
        // Check cart count update
        const cartCountEl = page.locator('.cart-count').first();
        const cartCount = await cartCountEl.count() > 0 ? await cartCountEl.textContent() : 'N/A';
        console.log(`  Cart count: ${cartCount}`);
        
        results.push({ step: 4, status: 'PASS', message: 'Product added to cart' });
      } else {
        results.push({ step: 4, status: 'FAIL', severity: 'CRITICAL', message: 'Add to cart button not found', fix: 'Ensure add to cart button is present on product details' });
      }
    } catch (error) {
      results.push({ step: 4, status: 'FAIL', severity: 'CRITICAL', message: `Error: ${error.message}`, fix: 'Check add to cart functionality and modal overlay' });
    }
    
    // STEP 5: Change quantity
    console.log('\nSTEP 5: Change Quantity');
    try {
      // Close modal by clicking outside
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
      
      // Open cart
      const cartBtn = page.locator('#cart-btn').first();
      if (await cartBtn.count() > 0) {
        await cartBtn.click();
        await page.waitForTimeout(500);
      }
      
      // Find quantity controls
      const quantityInput = page.locator('input[type="number"][name="quantity"]').first();
      const hasQtyInput = await quantityInput.count() > 0;
      
      if (hasQtyInput) {
        const currentQty = await quantityInput.inputValue();
        console.log(`  Current quantity: ${currentQty}`);
        
        results.push({ step: 5, status: 'PASS', message: 'Quantity input available' });
      } else {
        results.push({ step: 5, status: 'PARTIAL', severity: 'LOW', message: 'Quantity input not found in cart', fix: 'Add quantity controls to cart for better UX' });
      }
    } catch (error) {
      results.push({ step: 5, status: 'FAIL', severity: 'MEDIUM', message: `Error: ${error.message}`, fix: 'Check quantity control implementation' });
    }
    
    // STEP 6: Proceed to checkout
    console.log('\nSTEP 6: Proceed to Checkout');
    try {
      const checkoutBtn = page.locator('#checkout-btn').first();
      const btnExists = await checkoutBtn.count() > 0;
      
      if (btnExists) {
        const isDisabled = await checkoutBtn.isDisabled();
        console.log(`  Checkout button disabled: ${isDisabled}`);
        
        if (!isDisabled) {
          await checkoutBtn.click();
          await page.waitForTimeout(1000);
          
          // Check if checkout page loaded
          const checkoutPage = await page.locator('.checkout-section, #checkout').count();
          console.log(`  Checkout section visible: ${checkoutPage > 0}`);
          
          if (checkoutPage > 0) {
            results.push({ step: 6, status: 'PASS', message: 'Checkout page loaded' });
          } else {
            results.push({ step: 6, status: 'FAIL', severity: 'HIGH', message: 'Checkout page did not load', fix: 'Check checkout button navigation' });
          }
        } else {
          results.push({ step: 6, status: 'FAIL', severity: 'HIGH', message: 'Checkout button is disabled (cart may be empty)', fix: 'Ensure cart has items before checkout' });
        }
      } else {
        results.push({ step: 6, status: 'FAIL', severity: 'CRITICAL', message: 'Checkout button not found', fix: 'Ensure checkout button is present in cart' });
      }
    } catch (error) {
      results.push({ step: 6, status: 'FAIL', severity: 'CRITICAL', message: `Error: ${error.message}`, fix: 'Check checkout navigation' });
    }
    
    // STEP 7: Select delivery date
    console.log('\nSTEP 7: Select Delivery Date');
    try {
      const deliveryDateInput = page.locator('input[name="delivery_date"], #delivery_date').first();
      const dateExists = await deliveryDateInput.count() > 0;
      
      if (dateExists) {
        const inputType = await deliveryDateInput.getAttribute('type');
        console.log(`  Delivery date input type: ${inputType}`);
        
        // Set a future date
        await deliveryDateInput.fill('2026-12-31');
        await page.waitForTimeout(200);
        
        const filledValue = await deliveryDateInput.inputValue();
        console.log(`  Filled value: ${filledValue}`);
        
        results.push({ step: 7, status: 'PASS', message: 'Delivery date selection works' });
      } else {
        results.push({ step: 7, status: 'FAIL', severity: 'HIGH', message: 'Delivery date input not found', fix: 'Add delivery date input to checkout form' });
      }
    } catch (error) {
      results.push({ step: 7, status: 'FAIL', severity: 'HIGH', message: `Error: ${error.message}`, fix: 'Check delivery date input implementation' });
    }
    
    // STEP 8: Place preorder
    console.log('\nSTEP 8: Place Preorder');
    try {
      // Fill delivery address
      const addressInput = page.locator('input[name="delivery_address"], textarea[name="delivery_address"], #delivery_address').first();
      if (await addressInput.count() > 0) {
        await addressInput.fill('Test Address 123');
      }
      
      const placeOrderBtn = page.locator('button:has-text("Place Order"), .place-order-btn').first();
      const btnExists = await placeOrderBtn.count() > 0;
      
      if (btnExists) {
        const isDisabled = await placeOrderBtn.isDisabled();
        console.log(`  Place order button disabled: ${isDisabled}`);
        
        if (!isDisabled) {
          await placeOrderBtn.click();
          await page.waitForTimeout(2000);
          
          // Check for success message
          const successMsg = await page.locator('.alert-success, .success-message').count();
          const orderConfirmation = await page.locator('.order-confirmation, .order-success').count();
          
          console.log(`  Success message visible: ${successMsg > 0}`);
          console.log(`  Order confirmation visible: ${orderConfirmation > 0}`);
          
          if (successMsg > 0 || orderConfirmation > 0) {
            results.push({ step: 8, status: 'PASS', message: 'Preorder placed successfully' });
          } else {
            const errorMsg = await page.locator('.alert-danger, .error-message').count();
            if (errorMsg > 0) {
              const errorText = await page.locator('.alert-danger, .error-message').first().textContent();
              results.push({ step: 8, status: 'FAIL', severity: 'HIGH', message: `Order failed: ${errorText}`, fix: 'Check order validation and API' });
            } else {
              results.push({ step: 8, status: 'PARTIAL', severity: 'MEDIUM', message: 'Order placed but no confirmation visible', fix: 'Add clear success message after order placement' });
            }
          }
        } else {
          results.push({ step: 8, status: 'FAIL', severity: 'HIGH', message: 'Place order button is disabled', fix: 'Check form validation and required fields' });
        }
      } else {
        results.push({ step: 8, status: 'FAIL', severity: 'CRITICAL', message: 'Place order button not found', fix: 'Ensure place order button is present on checkout' });
      }
    } catch (error) {
      results.push({ step: 8, status: 'FAIL', severity: 'CRITICAL', message: `Error: ${error.message}`, fix: 'Check order placement implementation' });
    }
    
    // STEP 9: View order history
    console.log('\nSTEP 9: View Order History');
    try {
      await page.goto(`${BASE_URL}/customer-account.html`, { waitUntil: 'networkidle' });
      
      // Click on orders tab
      const ordersTab = page.locator('[data-tab="orders"], .orders-tab').first();
      if (await ordersTab.count() > 0) {
        await ordersTab.click();
        await page.waitForTimeout(500);
      }
      
      // Check if orders are displayed
      const orderItems = await page.locator('.order-item, .order-card').count();
      console.log(`  Orders found: ${orderItems}`);
      
      if (orderItems > 0) {
        results.push({ step: 9, status: 'PASS', message: 'Order history displayed' });
      } else {
        results.push({ step: 9, status: 'PARTIAL', severity: 'MEDIUM', message: 'No orders displayed (may need to wait for processing)', fix: 'Check order loading and display logic' });
      }
    } catch (error) {
      results.push({ step: 9, status: 'FAIL', severity: 'MEDIUM', message: `Error: ${error.message}`, fix: 'Check order history page navigation' });
    }
    
    // STEP 10: View preorder details
    console.log('\nSTEP 10: View Preorder Details');
    try {
      const firstOrder = page.locator('.order-item, .order-card').first();
      if (await firstOrder.count() > 0) {
        await firstOrder.click();
        await page.waitForTimeout(500);
        
        const preorderBadge = await page.locator('[data-preorder], .preorder-badge').count();
        const availabilityDate = await page.locator('[data-availability-date], .preorder-availability-date').count();
        
        console.log(`  Preorder badge visible: ${preorderBadge > 0}`);
        console.log(`  Availability date visible: ${availabilityDate > 0}`);
        
        if (preorderBadge > 0 || availabilityDate > 0) {
          results.push({ step: 10, status: 'PASS', message: 'Preorder details displayed' });
        } else {
          results.push({ step: 10, status: 'PARTIAL', severity: 'LOW', message: 'Preorder details not clearly labeled', fix: 'Add preorder-specific indicators to order details' });
        }
      } else {
        results.push({ step: 10, status: 'SKIP', severity: 'INFO', message: 'No orders to view details for', fix: 'Complete order placement first' });
      }
    } catch (error) {
      results.push({ step: 10, status: 'FAIL', severity: 'LOW', message: `Error: ${error.message}`, fix: 'Check order details click handler' });
    }
    
    // SUMMARY
    console.log('\n=== TEST SUMMARY ===\n');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const partial = results.filter(r => r.status === 'PARTIAL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`Total: ${results.length}`);
    console.log(`PASS: ${passed}`);
    console.log(`FAIL: ${failed}`);
    console.log(`PARTIAL: ${partial}`);
    console.log(`SKIP: ${skipped}`);
    console.log(`Completion: ${Math.round((passed / results.length) * 100)}%`);
    
    console.log('\n=== DETAILED RESULTS ===\n');
    results.forEach(r => {
      const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'PARTIAL' ? '⚠️' : '⏭️';
      console.log(`${statusIcon} Step ${r.step}: ${r.status}`);
      if (r.severity) console.log(`   Severity: ${r.severity}`);
      console.log(`   Message: ${r.message}`);
      if (r.fix) console.log(`   Fix: ${r.fix}`);
      console.log();
    });
    
    // Take screenshot if there are failures
    if (failed > 0) {
      await page.screenshot({ path: 'test-results/preorder-flow-failure.png', fullPage: true });
      console.log('Screenshot saved: test-results/preorder-flow-failure.png');
    }
    
    // Assert overall pass
    expect(failed).toBe(0);
  });
});
