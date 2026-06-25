const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Farmer Separate Add Product Modals - HTML Structure', () => {
  test('should have separate available and preorder modals in HTML', async () => {
    // Read the farmer.html file directly
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check that both modals exist in the HTML
    expect(htmlContent).toContain('id="add-available-modal"');
    expect(htmlContent).toContain('id="add-preorder-modal"');
    expect(htmlContent).toContain('id="add-product-modal"');
  });

  test('should have all required form fields in available modal', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check available form fields
    expect(htmlContent).toContain('id="add-available-form"');
    expect(htmlContent).toContain('id="available-name"');
    expect(htmlContent).toContain('id="available-category"');
    expect(htmlContent).toContain('id="available-price"');
    expect(htmlContent).toContain('id="available-stock"');
    expect(htmlContent).toContain('id="available-expiry"');
    expect(htmlContent).toContain('id="available-description"');
    expect(htmlContent).toContain('id="available-location-display"');
    expect(htmlContent).toContain('id="available-image"');
    expect(htmlContent).toContain('id="available-image-preview"');
    expect(htmlContent).toContain('id="available-unit"');
  });

  test('should have all required form fields in preorder modal', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check preorder form fields
    expect(htmlContent).toContain('id="add-preorder-form"');
    expect(htmlContent).toContain('id="preorder-name"');
    expect(htmlContent).toContain('id="preorder-category"');
    expect(htmlContent).toContain('id="preorder-price"');
    expect(htmlContent).toContain('id="preorder-harvest-date"');
    expect(htmlContent).toContain('id="preorder-max-quantity"');
    expect(htmlContent).toContain('id="preorder-description"');
    expect(htmlContent).toContain('id="preorder-location-display"');
    expect(htmlContent).toContain('id="preorder-image"');
    expect(htmlContent).toContain('id="preorder-image-preview"');
    expect(htmlContent).toContain('id="preorder-unit"');
  });

  test('should have close buttons for both modals', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check close buttons
    expect(htmlContent).toContain('id="close-add-available-modal"');
    expect(htmlContent).toContain('id="close-add-preorder-modal"');
  });

  test('should have address modal buttons for both modals', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check address modal buttons
    expect(htmlContent).toContain('id="open-available-address-modal"');
    expect(htmlContent).toContain('id="open-preorder-address-modal"');
  });

  test('should have category dropdowns for both modals', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check category dropdowns
    expect(htmlContent).toContain('id="available-category-dropdown"');
    expect(htmlContent).toContain('id="preorder-category-dropdown"');
  });

  test('should have product name suggestion lists for both modals', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check suggestion lists
    expect(htmlContent).toContain('id="available-name-suggestions"');
    expect(htmlContent).toContain('id="preorder-name-suggestions"');
  });

  test('should have price suggestion hints for both modals', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Check price hints
    expect(htmlContent).toContain('id="available-price-suggestion"');
    expect(htmlContent).toContain('id="preorder-price-suggestion"');
  });
});
