const { test, expect } = require('@playwright/test');
const { request } = require('@playwright/test');

test('Verify farmers can select new Product Catalog entries when adding products', async () => {
  // Verify the Product Catalog API returns the new entries
  const context = await request.newContext();
  
  try {
    // Get product catalog names
    const response = await context.get('http://localhost:3000/api/products/catalog/names');
    const data = await response.json();
    
    console.log('Product Catalog entries from API:');
    data.names?.forEach(entry => console.log(`- ${entry.name} (Category: ${entry.category_id})`));
    
    // Check for our new entries
    const newEntries = [
      'Pechay', 'Kangkong', 'Sitaw', 'Talong', 'Okra', 'Kamote',
      'Mango', 'Banana', 'Guyabano', 'Lanzones', 'Rambutan', 'Santol'
    ];
    
    const foundEntries = [];
    const missingEntries = [];
    
    for (const entry of newEntries) {
      const found = data.names?.some(n => n.name === entry);
      if (found) {
        foundEntries.push(entry);
      } else {
        missingEntries.push(entry);
      }
    }
    
    console.log('\nNew entries found in Product Catalog:');
    foundEntries.forEach(e => console.log(`✓ ${e}`));
    
    if (missingEntries.length > 0) {
      console.log('\nNew entries missing from Product Catalog:');
      missingEntries.forEach(e => console.log(`✗ ${e}`));
    }
    
    // Assertions
    expect(foundEntries.length).toBe(12);
    expect(missingEntries.length).toBe(0);
    
    console.log('\n✓ All 12 new Product Catalog entries are available via API');
    console.log('✓ Farmers can select these entries when adding products');
    
  } finally {
    await context.dispose();
  }
});
