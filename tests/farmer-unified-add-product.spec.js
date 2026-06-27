const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Farmer Unified Add Product Modal - HTML Structure', () => {
  test('should have unified add-product-modal in HTML', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="add-product-modal"');
    expect(htmlContent).toContain('id="add-product-form"');
  });

  test('should NOT have old separate modals in HTML', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).not.toContain('id="add-available-modal"');
    expect(htmlContent).not.toContain('id="add-preorder-modal"');
    expect(htmlContent).not.toContain('id="add-available-form"');
    expect(htmlContent).not.toContain('id="add-preorder-form"');
  });

  test('should have Product Information section', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="product-category"');
    expect(htmlContent).toContain('id="product-name"');
    expect(htmlContent).toContain('id="product-unit"');
    expect(htmlContent).toContain('id="product-price"');
    expect(htmlContent).toContain('id="product-description"');
    expect(htmlContent).toContain('id="product-category-dropdown"');
    expect(htmlContent).toContain('id="product-name-suggestions"');
    expect(htmlContent).toContain('id="product-price-suggestion"');
  });

  test('should have Selling Modes section with cards', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="selling-mode-available"');
    expect(htmlContent).toContain('id="selling-mode-preorder"');
    expect(htmlContent).toContain('id="check-available-mode"');
    expect(htmlContent).toContain('id="check-preorder-mode"');
  });

  test('should have Dynamic Selling Details section', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="selling-details-section"');
    expect(htmlContent).toContain('id="selling-mode-empty"');
    expect(htmlContent).toContain('id="available-details"');
    expect(htmlContent).toContain('id="preorder-details"');
  });

  test('should have Available Details fields', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="available-stock"');
    expect(htmlContent).toContain('id="available-expiry"');
    expect(htmlContent).toContain('id="available-image"');
    expect(htmlContent).toContain('id="available-image-preview"');
  });

  test('should have Pre-order Details fields', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="preorder-max-quantity"');
    expect(htmlContent).toContain('id="preorder-harvest-date"');
    expect(htmlContent).toContain('id="preorder-image"');
    expect(htmlContent).toContain('id="preorder-image-preview"');
  });

  test('should have Location section', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="location-section"');
    expect(htmlContent).toContain('id="product-location-display"');
    expect(htmlContent).toContain('id="product-location"');
    expect(htmlContent).toContain('id="open-product-address-modal"');
  });

  test('should have confirmation modal', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="product-confirmation-modal"');
    expect(htmlContent).toContain('id="close-confirmation-modal"');
  });

  test('should have close button for add-product-modal', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="close-add-product-modal"');
  });

  test('should have submit button', async () => {
    const htmlPath = path.join(__dirname, '../frontend/farmer.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    expect(htmlContent).toContain('id="add-product-submit-btn"');
  });
});
