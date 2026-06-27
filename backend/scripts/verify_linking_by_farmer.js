require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function verifyLinkingByFarmer() {
  console.log('=== Verifying Product Linking by Farmer ===\n');
  
  try {
    // Get all products
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id, is_admin_disabled, farmer_id
      FROM products
      WHERE is_admin_disabled = false
      ORDER BY farmer_id, name, id
    `);

    const products = result.rows;
    console.log(`Found ${products.length} active products\n`);

    // Group by farmer and name
    const productsByFarmerName = {};
    products.forEach(product => {
      const key = `${product.farmer_id}-${product.name.toLowerCase()}`;
      if (!productsByFarmerName[key]) {
        productsByFarmerName[key] = [];
      }
      productsByFarmerName[key].push(product);
    });

    console.log('=== Checking 1:1 Linking by Farmer + Product Name ===\n');

    let validLinks = 0;
    let invalidLinks = 0;
    let missingLinks = 0;
    let invalidRatios = 0;

    for (const [key, group] of Object.entries(productsByFarmerName)) {
      const [farmerId, name] = key.split('-');
      const available = group.filter(p => !p.is_preorder);
      const preorders = group.filter(p => p.is_preorder);

      // Skip if only 1 type exists (1:0 or 0:1 is okay)
      if (available.length === 0 || preorders.length === 0) {
        continue;
      }

      console.log(`Farmer ${farmerId} - Product: ${name}`);
      console.log(`  Available: ${available.length}, Pre-order: ${preorders.length}`);

      // Check if 1:1 ratio
      if (available.length !== 1 || preorders.length !== 1) {
        console.log(`  ⚠️  Invalid ratio: ${available.length}:${preorders.length} (should be 1:1)`);
        invalidRatios++;
        available.forEach(a => console.log(`    Available ID ${a.id}`));
        preorders.forEach(p => console.log(`    Pre-order ID ${p.id}`));
        console.log();
        continue;
      }

      // Check the link
      const avail = available[0];
      const pre = preorders[0];

      if (!avail.linked_product_id || !pre.linked_product_id) {
        console.log(`  ⚠️  Missing link`);
        missingLinks++;
        console.log();
        continue;
      }

      if (avail.linked_product_id !== pre.id || pre.linked_product_id !== avail.id) {
        console.log(`  ✗ Invalid link: Available ID ${avail.id} linked to ${avail.linked_product_id}, Pre-order ID ${pre.id} linked to ${pre.linked_product_id}`);
        invalidLinks++;
        console.log();
        continue;
      }

      console.log(`  ✓ Available ID ${avail.id} ↔ Pre-order ID ${pre.id}`);
      console.log(`  ✓✓✓ Perfect 1:1 link\n`);
      validLinks++;
    }

    console.log('=== Summary ===');
    console.log(`Valid 1:1 links: ${validLinks}`);
    console.log(`Invalid links: ${invalidLinks}`);
    console.log(`Missing links: ${missingLinks}`);
    console.log(`Invalid ratios (not 1:1): ${invalidRatios}`);
    console.log('\n=== Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyLinkingByFarmer();
