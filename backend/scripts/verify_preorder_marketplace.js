require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';

async function verifyPreorderMarketplace() {
  console.log('=== Verifying Pre-order Marketplace Visibility for Scenario 2 ===\n');
  
  // Get all pre-order products
  console.log('1. Fetching pre-order products from marketplace...');
  const response = await fetch(`${API_BASE}/products?is_preorder=true&status=approved`);
  
  if (!response.ok) {
    console.error('✗ Failed to fetch products:', await response.text());
    return;
  }

  const data = await response.json();
  const products = data.products || data;
  
  console.log(`✓ Found ${products.length} pre-order products\n`);
  
  // Find our test pre-order product
  const testProduct = products.find(p => p.name === 'Test Scenario 2 Pre-order');
  
  if (testProduct) {
    console.log('✓ Test pre-order product found in marketplace!');
    console.log('  Product ID:', testProduct.id);
    console.log('  Product Name:', testProduct.name);
    console.log('  Price:', testProduct.price);
    console.log('  Max Pre-order Quantity:', testProduct.max_preorder_quantity);
    console.log('  Reserved Quantity:', testProduct.reserved_quantity);
    console.log('  Pre-order Availability Date:', testProduct.preorder_availability_date);
    console.log('  Status:', testProduct.status);
    console.log('  Image URL:', testProduct.image_url);
    console.log('  Farmer ID:', testProduct.farmer_id);
    console.log('\n✓✓✓ PRE-ORDER MARKETPLACE VISIBILITY VERIFIED');
  } else {
    console.log('✗ Test pre-order product NOT found in marketplace');
    console.log('Available pre-order products:');
    products.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, Status: ${p.status})`);
    });
  }
}

verifyPreorderMarketplace().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
