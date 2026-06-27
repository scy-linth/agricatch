require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function verifyMarketplaceVisibility() {
  console.log('=== Verifying Marketplace Visibility for Scenario 1 ===\n');
  
  // Get all available products
  console.log('1. Fetching available products from marketplace...');
  const response = await fetch(`${API_BASE}/products?status=approved&is_available=true`);
  
  if (!response.ok) {
    console.error('✗ Failed to fetch products:', await response.text());
    return;
  }

  const data = await response.json();
  const products = data.products || data;
  
  console.log(`✓ Found ${products.length} available products\n`);
  
  // Find our test product
  const testProduct = products.find(p => p.name === 'Test Scenario 1 Product');
  
  if (testProduct) {
    console.log('✓ Test product found in marketplace!');
    console.log('  Product ID:', testProduct.id);
    console.log('  Product Name:', testProduct.name);
    console.log('  Price:', testProduct.price);
    console.log('  Stock:', testProduct.stock);
    console.log('  Status:', testProduct.status);
    console.log('  Image URL:', testProduct.image_url);
    console.log('  Farmer ID:', testProduct.farmer_id);
    console.log('\n✓✓✓ MARKETPLACE VISIBILITY VERIFIED');
  } else {
    console.log('✗ Test product NOT found in marketplace');
    console.log('Available products:');
    products.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, Status: ${p.status})`);
    });
  }
}

verifyMarketplaceVisibility().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
