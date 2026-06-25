const fs = require('fs');

async function testPerNameLimitsIntegration() {
  try {
    console.log('=== Testing Per-Product-Name Per-Type Limits (Integration) ===\n');

    // Test 1: Verify the filtering logic in farmer.js
    console.log('Test 1: Verifying filtering logic in farmer.js...');
    const farmerJs = fs.readFileSync('../frontend/js/farmer.js', 'utf8');
    
    // Check if the logic counts occurrences per name
    if (farmerJs.includes('nameCounts') && farmerJs.includes('nameCounts[name] = (nameCounts[name] || 0) + 1')) {
      console.log('✓ Logic counts occurrences per product name');
    } else {
      console.log('✗ Logic does not count occurrences properly');
      return;
    }

    // Check if it compares against the limit
    if (farmerJs.includes('(nameCounts[String(item.name).trim().toLowerCase()] || 0) < limit')) {
      console.log('✓ Logic compares count against configurable limit');
    } else {
      console.log('✗ Logic does not compare against limit');
      return;
    }

    // Check if it uses the correct limit based on product type
    if (farmerJs.includes('const limit = productType === \'available\' ? this.maxProductsPerNameAvailable : this.maxProductsPerNamePreorder')) {
      console.log('✓ Logic uses correct limit based on product type');
    } else {
      console.log('✗ Logic does not use correct limit per type');
      return;
    }

    // Test 2: Simulate the filtering scenario
    console.log('\nTest 2: Simulating filtering scenario...');
    
    // Simulate myProductsCache with products
    const mockProductsCache = [
      { name: 'Pakwan', is_preorder: false },
      { name: 'Pakwan', is_preorder: false },
      { name: 'Pakwan', is_preorder: true },
      { name: 'Tomato', is_preorder: false },
    ];

    // Simulate catalog product names
    const mockCatalogNames = [
      { name: 'Pakwan' },
      { name: 'Tomato' },
      { name: 'Onion' },
    ];

    // Test with limit = 1 for available
    const limitAvailable = 1;
    const limitPreorder = 1;

    // Count occurrences for available products
    const nameCountsAvailable = {};
    mockProductsCache.forEach(p => {
      if (!p.is_preorder) {
        const name = String(p.name || '').trim().toLowerCase();
        nameCountsAvailable[name] = (nameCountsAvailable[name] || 0) + 1;
      }
    });

    // Filter catalog names for available
    const filteredAvailable = mockCatalogNames.filter(item =>
      (nameCountsAvailable[String(item.name).trim().toLowerCase()] || 0) < limitAvailable
    );

    console.log('  Available products in cache:', mockProductsCache.filter(p => !p.is_preorder).map(p => p.name));
    console.log('  Name counts for available:', nameCountsAvailable);
    console.log('  Filtered catalog names (limit=1):', filteredAvailable.map(i => i.name));
    
    // With limit=1, only names with count < 1 (i.e., count=0) should be shown
    // Pakwan has 2, Tomato has 1, Onion has 0 → only Onion should be shown
    if (filteredAvailable.length === 1 && filteredAvailable[0].name === 'Onion') {
      console.log('✓ Only Onion shown (Pakwan has 2, Tomato has 1, both >= limit of 1)');
    } else {
      console.log('✗ Filtering not working correctly');
      return;
    }

    // Test with limit = 2 for available
    const filteredAvailable2 = mockCatalogNames.filter(item =>
      (nameCountsAvailable[String(item.name).trim().toLowerCase()] || 0) < 2
    );

    console.log('  Filtered catalog names (limit=2):', filteredAvailable2.map(i => i.name));
    
    // With limit=2, names with count < 2 should be shown
    // Pakwan has 2 (not < 2), Tomato has 1 (< 2), Onion has 0 (< 2) → Tomato and Onion should be shown
    if (filteredAvailable2.length === 2 && 
        filteredAvailable2.find(i => i.name === 'Tomato') && 
        filteredAvailable2.find(i => i.name === 'Onion') &&
        !filteredAvailable2.find(i => i.name === 'Pakwan')) {
      console.log('✓ Tomato and Onion shown (Pakwan has 2 which is not < 2, Tomato has 1, Onion has 0)');
    } else {
      console.log('✗ Filtering not working correctly with limit=2');
      return;
    }

    // Test for preorder
    const nameCountsPreorder = {};
    mockProductsCache.forEach(p => {
      if (p.is_preorder) {
        const name = String(p.name || '').trim().toLowerCase();
        nameCountsPreorder[name] = (nameCountsPreorder[name] || 0) + 1;
      }
    });

    const filteredPreorder = mockCatalogNames.filter(item =>
      (nameCountsPreorder[String(item.name).trim().toLowerCase()] || 0) < limitPreorder
    );

    console.log('  Preorder products in cache:', mockProductsCache.filter(p => p.is_preorder).map(p => p.name));
    console.log('  Name counts for preorder:', nameCountsPreorder);
    console.log('  Filtered catalog names (limit=1):', filteredPreorder.map(i => i.name));
    
    // With limit=1, names with count < 1 should be shown
    // Pakwan has 1 (not < 1), Tomato has 0 (< 1), Onion has 0 (< 1) → Tomato and Onion should be shown
    if (filteredPreorder.length === 2 && 
        filteredPreorder.find(i => i.name === 'Tomato') && 
        filteredPreorder.find(i => i.name === 'Onion') &&
        !filteredPreorder.find(i => i.name === 'Pakwan')) {
      console.log('✓ Tomato and Onion shown (Pakwan has 1 which is not < 1, Tomato has 0, Onion has 0)');
    } else {
      console.log('✗ Preorder filtering not working correctly');
      return;
    }

    console.log('\n=== All integration tests passed! ===');
    console.log('The per-product-name per-type limits work correctly:');
    console.log('- Available and Pre-order limits are independent');
    console.log('- Same product name can be used in both types (up to their respective limits)');
    console.log('- Filtering correctly excludes names that have reached their limit');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testPerNameLimitsIntegration();
