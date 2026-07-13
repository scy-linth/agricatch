# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: real-world-simulation.spec.js >> Real World Simulation - Access Control & Abuse Testing >> WORKFLOW - Complete Admin Journey
- Location: tests\real-world-simulation.spec.js:443:3

# Error details

```
TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e4]:
      - text: 
      - link "AgriCatch Logo Agri Catch Freshly Harvested! Pre-ordered for you!" [ref=e6] [cursor=pointer]:
        - /url: /index.html
        - generic [ref=e7]:
          - img "AgriCatch Logo" [ref=e8]
          - heading "Agri Catch" [level=1] [ref=e9]:
            - generic [ref=e10]: Agri
            - generic [ref=e11]: Catch
        - paragraph [ref=e12]: Freshly Harvested! Pre-ordered for you!
      - navigation [ref=e13]:
        - link " Home" [ref=e14] [cursor=pointer]:
          - /url: "#home"
          - generic [ref=e15]: 
          - generic [ref=e16]: Home
        - link " Featured" [ref=e17] [cursor=pointer]:
          - /url: "#featured"
          - generic [ref=e18]: 
          - generic [ref=e19]: Featured
        - link " Products" [ref=e20] [cursor=pointer]:
          - /url: "#available-now"
          - generic [ref=e21]: 
          - generic [ref=e22]: Products
        - link " About" [ref=e23] [cursor=pointer]:
          - /url: "#about"
          - generic [ref=e24]: 
          - generic [ref=e25]: About
        - link " Contact" [ref=e26] [cursor=pointer]:
          - /url: "#contact"
          - generic [ref=e27]: 
          - generic [ref=e28]: Contact
      - generic [ref=e29]:
        - text: 
        - list:   
        - button "Login" [ref=e31] [cursor=pointer]
        - text:          
  - generic [ref=e32]:
    - img [ref=e35]
    - generic [ref=e38]:
      - heading "Fresh Harvest, Direct from Farms!" [level=2] [ref=e39]
      - paragraph [ref=e40]: Discover the finest agricultural products directly from local farmers. Quality guaranteed, farm-fresh delivery.
      - generic [ref=e41]:
        - button " Shop Available Products" [ref=e42] [cursor=pointer]:
          - generic [ref=e43]: 
          - text: Shop Available Products
        - button " Browse Preorders" [ref=e44] [cursor=pointer]:
          - generic [ref=e45]: 
          - text: Browse Preorders
  - generic [ref=e47]:
    - heading "🔥 Best Selling This Week" [level=2] [ref=e49]
    - generic [ref=e50]:
      - text: 
      - generic [ref=e54] [cursor=pointer]:
        - img "Mangga" [ref=e55]
        - generic [ref=e56]:
          - generic [ref=e57]: Available Now
          - heading "Mangga" [level=3] [ref=e58]
          - generic [ref=e59]:
            - text: Saja Jasa
            - generic "Verified Farmer" [ref=e60]: 
          - generic [ref=e61]: ₱60.00 per kg
          - generic [ref=e62]:
            - generic "Stock available" [ref=e63]:
              - text: 🔥
              - generic [ref=e64]: 
              - generic [ref=e65]: 47 kg available
            - generic "Average rating 0.0 out of 5" [ref=e67]:
              - generic [ref=e68]: 
              - generic [ref=e69]: "0.0"
            - generic [ref=e70]: 📍 Ships from your local area
            - generic [ref=e71]:
              - text: 
              - generic [ref=e72]: Sold 30
          - generic [ref=e73]:
            - button "Add to Cart" [ref=e74]
            - button "Add to wishlist" [ref=e75]:
              - generic: 
      - text: 
    - button "Go to slide 1" [ref=e77] [cursor=pointer]
  - generic [ref=e79]:
    - generic [ref=e80]:
      - heading "Browse Marketplace" [level=2] [ref=e81]
      - paragraph [ref=e82]: Browse fresh agricultural products directly from local farmers.
    - generic [ref=e83]:
      - generic [ref=e84]:
        - generic: 
        - textbox "Search products..." [ref=e85]
      - generic [ref=e86]:
        - button "All" [ref=e87] [cursor=pointer]:
          - generic [ref=e88]: All
        - button "Vegetables" [ref=e89] [cursor=pointer]:
          - generic [ref=e90]: Vegetables
        - button "Fruits" [ref=e91] [cursor=pointer]:
          - generic [ref=e92]: Fruits
        - button "Rice" [ref=e93] [cursor=pointer]:
          - generic [ref=e94]: Rice
      - generic [ref=e95]:
        - generic [ref=e96]: "Sort by:"
        - combobox "Sort by:" [ref=e97] [cursor=pointer]:
          - option "Latest" [selected]
          - option "Top Sales"
          - 'option "Price: Low to High"'
          - 'option "Price: High to Low"'
  - generic [ref=e99]:
    - heading "🌾 Fresh Products Ready for Delivery" [level=2] [ref=e101]
    - generic [ref=e102]:
      - generic [ref=e103] [cursor=pointer]:
        - img "Sitaw" [ref=e104]
        - generic [ref=e105]:
          - generic [ref=e106]: Available Now
          - heading "Sitaw" [level=3] [ref=e107]
          - generic [ref=e108]: ₱25.00 per kg
          - generic [ref=e109]: "🗓  Best Before: Not Specified"
          - generic [ref=e110]:
            - generic "Stock available" [ref=e111]:
              - text: 🔥
              - generic [ref=e112]: 5609 kg available
            - generic "0 reviews, average 0.0 out of 5" [ref=e114]:
              - generic [ref=e115]: 
              - generic [ref=e116]: "0.0"
            - generic "Shipping origin" [ref=e117]: 📍 Ships from your local area
            - generic [ref=e118]:
              - text: 
              - generic [ref=e119]: Sold 0
          - generic [ref=e120]:
            - button "Add to Cart" [ref=e121]
            - button "Add to wishlist" [ref=e122]:
              - generic: 
      - generic [ref=e123] [cursor=pointer]:
        - img "Ampalaya" [ref=e124]
        - generic [ref=e125]:
          - generic [ref=e126]: Available Now
          - heading "Ampalaya" [level=3] [ref=e127]
          - generic [ref=e128]: ₱15.00 per kg
          - generic [ref=e129]: "🗓  Best Before: Not Specified"
          - generic [ref=e130]:
            - generic "Stock available" [ref=e131]:
              - text: 🔥
              - generic [ref=e132]: 96 kg available
            - generic "0 reviews, average 0.0 out of 5" [ref=e134]:
              - generic [ref=e135]: 
              - generic [ref=e136]: "0.0"
            - generic "Shipping origin" [ref=e137]: 📍 Ships from your local area
            - generic [ref=e138]:
              - text: 
              - generic [ref=e139]: Sold 0
          - generic [ref=e140]:
            - button "Add to Cart" [ref=e141]
            - button "Add to wishlist" [ref=e142]:
              - generic: 
      - generic [ref=e143] [cursor=pointer]:
        - img "Mangga" [ref=e144]
        - generic [ref=e145]:
          - generic [ref=e146]: Available Now
          - heading "Mangga" [level=3] [ref=e147]
          - generic [ref=e148]: ₱60.00 per kg
          - generic [ref=e149]: "🗓  Best Before: Not Specified"
          - generic [ref=e150]:
            - generic "Stock available" [ref=e151]:
              - text: 🔥
              - generic [ref=e152]: 47 kg available
            - generic "0 reviews, average 0.0 out of 5" [ref=e154]:
              - generic [ref=e155]: 
              - generic [ref=e156]: "0.0"
            - generic "Shipping origin" [ref=e157]: 📍 Ships from your local area
            - generic [ref=e158]:
              - text: 
              - generic [ref=e159]: Sold 30
          - generic [ref=e160]:
            - button "Add to Cart" [ref=e161]
            - button "Add to wishlist" [ref=e162]:
              - generic: 
      - generic [ref=e163] [cursor=pointer]:
        - img "Papaya" [ref=e164]
        - generic [ref=e165]:
          - generic [ref=e166]: Available Now
          - heading "Papaya" [level=3] [ref=e167]
          - generic [ref=e168]: ₱23.98 per kg
          - generic [ref=e169]: "🗓  Best Before: Not Specified"
          - generic [ref=e170]:
            - generic "Stock available" [ref=e171]:
              - text: 🔥
              - generic [ref=e172]: 0 kg available
            - generic "0 reviews, average 0.0 out of 5" [ref=e174]:
              - generic [ref=e175]: 
              - generic [ref=e176]: "0.0"
            - generic "Shipping origin" [ref=e177]: 📍 Ships from your local area
            - generic [ref=e178]:
              - text: 
              - generic [ref=e179]: Sold 0
          - generic [ref=e180]:
            - button "Add to Cart" [disabled]
            - button "Add to wishlist" [ref=e181]:
              - generic: 
  - generic [ref=e183]:
    - generic [ref=e184]:
      - heading "📅 Reserve Before Harvest" [level=2] [ref=e185]
      - paragraph [ref=e186]: Secure products before they are harvested.
    - generic [ref=e187]:
      - generic [ref=e188] [cursor=pointer]:
        - img "Patatas" [ref=e189]
        - generic [ref=e190]:
          - generic [ref=e191]: HARVEST SOON
          - heading "Patatas" [level=3] [ref=e192]
          - generic [ref=e193]: ₱63.00 per kg
          - generic [ref=e194]:
            - text: "📅  Expected Harvest:"
            - strong [ref=e195]: To Be Announced
          - generic [ref=e196]:
            - generic "Preorder capacity" [ref=e197]:
              - text: 🔥
              - generic [ref=e198]: 55 kg remaining
            - generic "0 reviews, average 0.0 out of 5" [ref=e200]:
              - generic [ref=e201]: 
              - generic [ref=e202]: "0.0"
            - generic "Shipping origin" [ref=e203]: 📍 Ships from your local area
            - generic [ref=e204]:
              - text: 
              - generic [ref=e205]: Sold 0
          - generic [ref=e206]:
            - button "Reserve" [ref=e207]
            - button "Add to wishlist" [ref=e208]:
              - generic: 
      - generic [ref=e209] [cursor=pointer]:
        - img "Mango" [ref=e210]
        - generic [ref=e211]:
          - generic [ref=e212]: HARVEST SOON
          - heading "Mango" [level=3] [ref=e213]
          - generic [ref=e214]: ₱55.00 per kg
          - generic [ref=e215]:
            - text: "📅  Expected Harvest:"
            - strong [ref=e216]: To Be Announced
          - generic [ref=e217]:
            - generic "Preorder capacity" [ref=e218]:
              - text: 🔥
              - generic [ref=e219]: 45 kg remaining
            - generic "0 reviews, average 0.0 out of 5" [ref=e221]:
              - generic [ref=e222]: 
              - generic [ref=e223]: "0.0"
            - generic "Shipping origin" [ref=e224]: 📍 Ships from your local area
            - generic [ref=e225]:
              - text: 
              - generic [ref=e226]: Sold 0
          - generic [ref=e227]:
            - button "Reserve" [ref=e228]
            - button "Add to wishlist" [ref=e229]:
              - generic: 
      - generic [ref=e230] [cursor=pointer]:
        - img "Lanzones" [ref=e231]
        - generic [ref=e232]:
          - generic [ref=e233]: HARVEST SOON
          - heading "Lanzones" [level=3] [ref=e234]
          - generic [ref=e235]: ₱55.50 per kg
          - generic [ref=e236]:
            - text: "📅  Expected Harvest:"
            - strong [ref=e237]: To Be Announced
          - generic [ref=e238]:
            - generic "Preorder capacity" [ref=e239]:
              - text: 🔥
              - generic [ref=e240]: 23 kg remaining
            - generic "0 reviews, average 0.0 out of 5" [ref=e242]:
              - generic [ref=e243]: 
              - generic [ref=e244]: "0.0"
            - generic "Shipping origin" [ref=e245]: 📍 Ships from your local area
            - generic [ref=e246]:
              - text: 
              - generic [ref=e247]: Sold 0
          - generic [ref=e248]:
            - button "Reserve" [ref=e249]
            - button "Add to wishlist" [ref=e250]:
              - generic: 
      - generic [ref=e251] [cursor=pointer]:
        - img "Kangkong" [ref=e252]
        - generic [ref=e253]:
          - generic [ref=e254]: HARVEST SOON
          - heading "Kangkong" [level=3] [ref=e255]
          - generic [ref=e256]: ₱35.00 per kg
          - generic [ref=e257]:
            - text: "📅  Expected Harvest:"
            - strong [ref=e258]: Jul 28, 2026
          - generic [ref=e259]:
            - generic "Preorder capacity" [ref=e260]:
              - text: 🔥
              - generic [ref=e261]: 120 kg remaining
            - generic "0 reviews, average 0.0 out of 5" [ref=e263]:
              - generic [ref=e264]: 
              - generic [ref=e265]: "0.0"
            - generic "Shipping origin" [ref=e266]: 📍 Ships from your local area
            - generic [ref=e267]:
              - text: 
              - generic [ref=e268]: Sold 0
          - generic [ref=e269]:
            - button "Reserve" [ref=e270]
            - button "Add to wishlist" [ref=e271]:
              - generic: 
      - generic [ref=e272] [cursor=pointer]:
        - img "Lanzones" [ref=e273]
        - generic [ref=e274]:
          - generic [ref=e275]: HARVEST SOON
          - heading "Lanzones" [level=3] [ref=e276]
          - generic [ref=e277]: ₱64.00 per kg
          - generic [ref=e278]:
            - text: "📅  Expected Harvest:"
            - strong [ref=e279]: Jul 28, 2026
          - generic [ref=e280]:
            - generic "Preorder capacity" [ref=e281]:
              - text: 🔥
              - generic [ref=e282]: 65 kg remaining
            - generic "0 reviews, average 0.0 out of 5" [ref=e284]:
              - generic [ref=e285]: 
              - generic [ref=e286]: "0.0"
            - generic "Shipping origin" [ref=e287]: 📍 Ships from your local area
            - generic [ref=e288]:
              - text: 
              - generic [ref=e289]: Sold 0
          - generic [ref=e290]:
            - button "Reserve" [ref=e291]
            - button "Add to wishlist" [ref=e292]:
              - generic: 
  - text: 
  - generic [ref=e293]:
    - generic [ref=e294]:
      - heading "🛒 Shopping Cart" [level=3] [ref=e295]
      - button "Close cart" [ref=e296] [cursor=pointer]:
        - generic [ref=e297]: 
    - generic [ref=e299]:
      - generic [ref=e300]:
        - button "Select all items" [ref=e301] [cursor=pointer]: ○
        - generic [ref=e302]: Select All
      - generic [ref=e304]:
        - strong [ref=e305]: Total
        - strong [ref=e306]: ₱0.00
      - button "Checkout" [disabled]
  - text:                           
  - generic [ref=e309]:
    - generic [ref=e310]:
      - heading "About AgriCatch" [level=2] [ref=e311]
      - paragraph [ref=e312]: We connect local farmers directly with consumers, ensuring you get the freshest agricultural products at fair prices. Our platform supports sustainable farming practices and helps local communities thrive.
      - list [ref=e313]:
        - listitem [ref=e314]:
          - generic [ref=e315]: 
          - text: Farm-fresh products guaranteed
        - listitem [ref=e316]:
          - generic [ref=e317]: 
          - text: Direct from local farmers
        - listitem [ref=e318]:
          - generic [ref=e319]: 
          - text: Cash on delivery payment
        - listitem [ref=e320]:
          - generic [ref=e321]: 
          - text: Quality assurance
    - img "Farm fresh products" [ref=e323]
  - generic [ref=e325]:
    - heading "Contact Us" [level=2] [ref=e326]
    - generic [ref=e327]:
      - generic [ref=e328]:
        - generic [ref=e329]:
          - generic [ref=e330]: 
          - generic [ref=e331]: +63 929 819 6629
        - generic [ref=e332]:
          - generic [ref=e333]: 
          - generic [ref=e334]: agricatchph@gmail.com
        - generic [ref=e335]:
          - generic [ref=e336]: 
          - generic [ref=e337]: Metro Manila, Philippines
        - paragraph [ref=e339]: When you reach out to us through this website, your message is carefully reviewed and routed to the appropriate department that can best assist you. While we may not be able to respond to every inquiry individually, but we assure you that all submissions are received and reviewed.
      - generic [ref=e340]:
        - generic [ref=e341]:
          - generic [ref=e342]:
            - generic [ref=e343]: Name
            - textbox "Name" [ref=e344]
          - generic [ref=e345]:
            - generic [ref=e346]: Email
            - textbox "Email" [ref=e347]
        - generic [ref=e348]:
          - generic [ref=e349]: Subject
          - textbox "Subject" [ref=e350]
        - generic [ref=e351]:
          - generic [ref=e352]: Message
          - textbox "Message" [ref=e353]
          - generic [ref=e354]: Maximum 500 characters only
        - button "Send Message" [ref=e355] [cursor=pointer]
  - contentinfo [ref=e356]:
    - generic [ref=e357]:
      - generic [ref=e358]:
        - generic [ref=e359]:
          - heading "AgriCatch" [level=3] [ref=e360]
          - paragraph [ref=e361]: Fresh from the farm! Pre-ordered for you! Your trusted source for fresh agricultural products.
        - generic [ref=e362]:
          - heading "Quick Links" [level=3] [ref=e363]
          - list [ref=e364]:
            - listitem [ref=e365]:
              - link "Home" [ref=e366] [cursor=pointer]:
                - /url: "#home"
            - listitem [ref=e367]:
              - link "Featured" [ref=e368] [cursor=pointer]:
                - /url: "#featured"
            - listitem [ref=e369]:
              - link "Products" [ref=e370] [cursor=pointer]:
                - /url: "#products"
            - listitem [ref=e371]:
              - link "About" [ref=e372] [cursor=pointer]:
                - /url: "#about"
            - listitem [ref=e373]:
              - link "Contact" [ref=e374] [cursor=pointer]:
                - /url: "#contact"
      - paragraph [ref=e376]: © 2026 AgriCatch. All rights reserved.
  - button "Open cart" [ref=e377] [cursor=pointer]:
    - generic [ref=e378]: 
```

# Test source

```ts
  347 |       console.log(`  - Modals: ${audit.modals}`);
  348 |     }
  349 | 
  350 |     // Save evidence
  351 |     const fs = require('fs');
  352 |     fs.writeFileSync(
  353 |       `${evidenceDir}/ui-consistency-audit.json`,
  354 |       JSON.stringify(auditResults, null, 2)
  355 |     );
  356 |   });
  357 | 
  358 |   // ============================================
  359 |   // COMPLETE CUSTOMER WORKFLOW
  360 |   // ============================================
  361 |   test('WORKFLOW - Complete Customer Journey', async () => {
  362 |     console.log('\n=== COMPLETE CUSTOMER WORKFLOW ===');
  363 |     
  364 |     // Step 1: Browse products
  365 |     await page.goto('http://localhost:3000/index.html');
  366 |     await page.waitForLoadState('networkidle');
  367 |     await page.screenshot({ path: `${screenshotDir}/workflow-customer-01-browse.png`, fullPage: true });
  368 |     console.log('Step 1: Browsing products');
  369 | 
  370 |     // Step 2: View product details
  371 |     const productCards = page.locator('.product-card, .card');
  372 |     if (await productCards.count() > 0) {
  373 |       await productCards.first().click();
  374 |       await page.waitForTimeout(2000);
  375 |       await page.screenshot({ path: `${screenshotDir}/workflow-customer-02-product-details.png`, fullPage: true });
  376 |       console.log('Step 2: Viewing product details');
  377 | 
  378 |       // Step 3: Add to cart
  379 |       const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn');
  380 |       if (await addToCartBtn.count() > 0) {
  381 |         await addToCartBtn.first().click();
  382 |         await page.waitForTimeout(2000);
  383 |         await page.screenshot({ path: `${screenshotDir}/workflow-customer-03-add-to-cart.png`, fullPage: true });
  384 |         console.log('Step 3: Added to cart');
  385 |       }
  386 |     }
  387 | 
  388 |     // Step 4: Navigate to checkout
  389 |     await page.goto('http://localhost:3000/checkout.html');
  390 |     await page.waitForTimeout(2000);
  391 |     await page.screenshot({ path: `${screenshotDir}/workflow-customer-04-checkout.png`, fullPage: true });
  392 |     console.log('Step 4: On checkout page');
  393 | 
  394 |     // Step 5: Check orders page
  395 |     await page.goto('http://localhost:3000/orders.html');
  396 |     await page.waitForTimeout(2000);
  397 |     await page.screenshot({ path: `${screenshotDir}/workflow-customer-05-orders.png`, fullPage: true });
  398 |     console.log('Step 5: On orders page');
  399 |   });
  400 | 
  401 |   // ============================================
  402 |   // COMPLETE FARMER WORKFLOW
  403 |   // ============================================
  404 |   test('WORKFLOW - Complete Farmer Journey', async () => {
  405 |     console.log('\n=== COMPLETE FARMER WORKFLOW ===');
  406 |     
  407 |     await page.goto('http://localhost:3000/farmer.html');
  408 |     await page.waitForLoadState('networkidle');
  409 |     await page.screenshot({ path: `${screenshotDir}/workflow-farmer-01-dashboard.png`, fullPage: true });
  410 |     console.log('Step 1: On farmer dashboard');
  411 | 
  412 |     // Try to navigate to products section
  413 |     const productsNav = page.locator('[data-section="products"], #products-nav, a[href*="#products"]');
  414 |     if (await productsNav.count() > 0) {
  415 |       await productsNav.first().click();
  416 |       await page.waitForTimeout(2000);
  417 |       await page.screenshot({ path: `${screenshotDir}/workflow-farmer-02-products.png`, fullPage: true });
  418 |       console.log('Step 2: Navigated to products');
  419 | 
  420 |       // Try to add product button
  421 |       const addProductBtn = page.locator('#add-product-btn, .add-product-btn');
  422 |       if (await addProductBtn.count() > 0) {
  423 |         await addProductBtn.first().click();
  424 |         await page.waitForTimeout(2000);
  425 |         await page.screenshot({ path: `${screenshotDir}/workflow-farmer-03-add-product-modal.png`, fullPage: true });
  426 |         console.log('Step 3: Add product modal opened');
  427 |       }
  428 |     }
  429 | 
  430 |     // Navigate to orders
  431 |     const ordersNav = page.locator('[data-section="orders"], #orders-nav, a[href*="#orders"]');
  432 |     if (await ordersNav.count() > 0) {
  433 |       await ordersNav.first().click();
  434 |       await page.waitForTimeout(2000);
  435 |       await page.screenshot({ path: `${screenshotDir}/workflow-farmer-04-orders.png`, fullPage: true });
  436 |       console.log('Step 4: Navigated to orders');
  437 |     }
  438 |   });
  439 | 
  440 |   // ============================================
  441 |   // COMPLETE ADMIN WORKFLOW
  442 |   // ============================================
  443 |   test('WORKFLOW - Complete Admin Journey', async () => {
  444 |     console.log('\n=== COMPLETE ADMIN WORKFLOW ===');
  445 |     
  446 |     await page.goto('http://localhost:3000/admin.html');
> 447 |     await page.waitForLoadState('networkidle');
      |                ^ TimeoutError: page.waitForLoadState: Timeout 30000ms exceeded.
  448 |     await page.screenshot({ path: `${screenshotDir}/workflow-admin-01-dashboard.png`, fullPage: true });
  449 |     console.log('Step 1: On admin dashboard');
  450 | 
  451 |     // Try to navigate to users section
  452 |     const usersNav = page.locator('[data-section="users"], #users-nav, a[href*="#users"]');
  453 |     if (await usersNav.count() > 0) {
  454 |       await usersNav.first().click();
  455 |       await page.waitForTimeout(2000);
  456 |       await page.screenshot({ path: `${screenshotDir}/workflow-admin-02-users.png`, fullPage: true });
  457 |       console.log('Step 2: Navigated to users');
  458 |     }
  459 | 
  460 |     // Try to navigate to approvals
  461 |     const approvalsNav = page.locator('[data-section="approvals"], #approvals-nav, a[href*="#approvals"]');
  462 |     if (await approvalsNav.count() > 0) {
  463 |       await approvalsNav.first().click();
  464 |       await page.waitForTimeout(2000);
  465 |       await page.screenshot({ path: `${screenshotDir}/workflow-admin-03-approvals.png`, fullPage: true });
  466 |       console.log('Step 3: Navigated to approvals');
  467 |     }
  468 | 
  469 |     // Try to navigate to orders
  470 |     const ordersNav = page.locator('[data-section="orders"], #orders-nav, a[href*="#orders"]');
  471 |     if (await ordersNav.count() > 0) {
  472 |       await ordersNav.first().click();
  473 |       await page.waitForTimeout(2000);
  474 |       await page.screenshot({ path: `${screenshotDir}/workflow-admin-04-orders.png`, fullPage: true });
  475 |       console.log('Step 4: Navigated to orders');
  476 |     }
  477 |   });
  478 | 
  479 |   // ============================================
  480 |   // ABUSE TESTING - Rapid Actions
  481 |   // ============================================
  482 |   test('ABUSE - Rapid Button Clicks', async () => {
  483 |     console.log('\n=== ABUSE TESTING - RAPID CLICKS ===');
  484 |     
  485 |     await page.goto('http://localhost:3000/index.html');
  486 |     await page.waitForLoadState('networkidle');
  487 | 
  488 |     const productCards = page.locator('.product-card, .card');
  489 |     if (await productCards.count() > 0) {
  490 |       await productCards.first().click();
  491 |       await page.waitForTimeout(1000);
  492 | 
  493 |       const addToCartBtn = page.locator('#add-to-cart-btn, .add-to-cart-btn');
  494 |       if (await addToCartBtn.count() > 0) {
  495 |         // Rapid click 10 times
  496 |         for (let i = 0; i < 10; i++) {
  497 |           await addToCartBtn.first().click();
  498 |           await page.waitForTimeout(100);
  499 |         }
  500 |         
  501 |         await page.waitForTimeout(2000);
  502 |         await page.screenshot({ path: `${screenshotDir}/abuse-rapid-clicks.png`, fullPage: true });
  503 |         console.log('Rapid clicks test completed');
  504 | 
  505 |         // Check for errors or warnings
  506 |         const errors = page.locator('.error, .alert-danger');
  507 |         const errorCount = await errors.count();
  508 |         console.log(`Errors after rapid clicks: ${errorCount}`);
  509 |       }
  510 |     }
  511 |   });
  512 | 
  513 |   // ============================================
  514 |   // ABUSE TESTING - Invalid Data
  515 |   // ============================================
  516 |   test('ABUSE - Invalid Data Input', async () => {
  517 |     console.log('\n=== ABUSE TESTING - INVALID DATA ===');
  518 |     
  519 |     await page.goto('http://localhost:3000/checkout.html');
  520 |     await page.waitForTimeout(2000);
  521 | 
  522 |     // Try to find form inputs and submit invalid data
  523 |     const inputs = page.locator('input, textarea, select');
  524 |     const inputCount = await inputs.count();
  525 |     console.log(`Found ${inputCount} form inputs`);
  526 | 
  527 |     for (let i = 0; i < Math.min(inputCount, 5); i++) {
  528 |       const input = inputs.nth(i);
  529 |       const inputType = await input.getAttribute('type');
  530 |       
  531 |       if (inputType !== 'hidden' && inputType !== 'submit') {
  532 |         await input.fill('INVALID_TEST_DATA_<>{}');
  533 |       }
  534 |     }
  535 | 
  536 |     await page.screenshot({ path: `${screenshotDir}/abuse-invalid-data.png`, fullPage: true });
  537 |     console.log('Invalid data test completed');
  538 |   });
  539 | });
  540 | 
```