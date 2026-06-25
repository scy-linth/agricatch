const { test, expect } = require('@playwright/test');

test.describe('Ships From Format', () => {
  test('should display city and province format on landing page', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for products to load
    await page.waitForSelector('.product-card', { timeout: 15000 });
    
    // Check if any product has the ships from text
    const shipFromElements = await page.locator('.product-ship-from').all();
    
    if (shipFromElements.length > 0) {
      // Get the text from the first ship from element
      const shipFromText = (await shipFromElements[0].textContent()).trim();
      console.log('Ships from text:', shipFromText);
      
      // Check if it follows the expected format (contains comma if city and province are set)
      // The format should be "Ships from {city}, {province}" or "Ships from {location}"
      expect(shipFromText).toMatch(/^Ships from .+/);
      
      // If the product has city and province data, it should contain a comma
      // Otherwise it will fall back to the location field
      if (shipFromText.includes(',')) {
        const parts = shipFromText.replace('Ships from ', '').split(', ');
        expect(parts.length).toBeGreaterThanOrEqual(2);
        console.log('City:', parts[0]);
        console.log('Province:', parts[1]);
      }
    } else {
      console.log('No ship from elements found - products may not have location data yet');
    }
  });

  test('should verify city and province fields in API response', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/products');
    const data = await response.json();
    
    expect(response.ok()).toBeTruthy();
    expect(data.products).toBeDefined();
    
    if (data.products && data.products.length > 0) {
      const firstProduct = data.products[0];
      console.log('First product:', {
        id: firstProduct.id,
        name: firstProduct.name,
        city: firstProduct.city,
        province: firstProduct.province,
        location: firstProduct.location
      });
      
      // Verify that city and province fields exist in the response
      expect(firstProduct).toHaveProperty('city');
      expect(firstProduct).toHaveProperty('province');
    }
  });
});
