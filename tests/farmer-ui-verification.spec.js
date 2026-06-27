const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Farmer Product Management UI Verification', () => {
  test('Verify UI structure via HTML inspection', async ({ page }) => {
    // Read the farmer.html file directly to verify structure
    const htmlContent = fs.readFileSync('./frontend/farmer.html', 'utf8');
    
    // Verify KPI cards structure
    expect(htmlContent).toContain('kpi-available');
    expect(htmlContent).toContain('kpi-preorder');
    expect(htmlContent).toContain('kpi-approval');
    console.log('✓ KPI cards structure verified in HTML');
    
    // Verify Filter structure
    expect(htmlContent).toContain('filter-available');
    expect(htmlContent).toContain('filter-preorder');
    expect(htmlContent).toContain('filter-approval');
    console.log('✓ Filter structure verified in HTML');
    
    // Verify Tab counts
    expect(htmlContent).toContain('tab-available-count');
    expect(htmlContent).toContain('tab-preorder-count');
    expect(htmlContent).toContain('tab-approval-count');
    console.log('✓ Tab count elements verified in HTML');
    
    // Verify Product table
    expect(htmlContent).toContain('available-products-table');
    expect(htmlContent).toContain('preorder-products-table');
    expect(htmlContent).toContain('requests-table');
    console.log('✓ Product tables verified in HTML');
    
    // Verify Edit Product modal
    expect(htmlContent).toContain('edit-product-modal');
    console.log('✓ Edit Product modal verified in HTML');
    
    // Verify Product Request Details modal
    expect(htmlContent).toContain('request-product-modal');
    console.log('✓ Product Request Details modal verified in HTML');
    
    // Verify Image upload preview areas
    expect(htmlContent).toContain('image-preview');
    console.log('✓ Image preview areas verified in HTML');
    
    // Verify button classes for hierarchy
    expect(htmlContent).toContain('btn-primary');
    expect(htmlContent).toContain('btn-secondary');
    expect(htmlContent).toContain('btn-ac-green');
    console.log('✓ Button hierarchy classes verified in HTML');
    
    // Verify responsive layout classes
    expect(htmlContent).toContain('col-md-');
    expect(htmlContent).toContain('col-sm-');
    expect(htmlContent).toContain('col-auto');
    console.log('✓ Responsive layout classes verified in HTML');
  });
});
