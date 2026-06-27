require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function verifyProductLinking() {
  console.log('=== Verifying Product Linking ===\n');
  
  try {
    // Get all products
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id, is_admin_disabled
      FROM products
      WHERE is_admin_disabled = false
      ORDER BY name, id
    `);

    const products = result.rows;
    console.log(`Found ${products.length} active products\n`);

    // Group by name
    const productsByName = {};
    products.forEach(product => {
      const name = product.name.toLowerCase();
      if (!productsByName[name]) {
        productsByName[name] = [];
      }
      productsByName[name].push(product);
    });

    console.log('=== Checking 1:1 Linking by Product Name ===\n');

    let validLinks = 0;
    let invalidLinks = 0;
    let missingLinks = 0;

    for (const [name, group] of Object.entries(productsByName)) {
      const available = group.filter(p => !p.is_preorder);
      const preorders = group.filter(p => p.is_preorder);

      // Skip if only 1 type exists
      if (available.length === 0 || preorders.length === 0) {
        continue;
      }

      console.log(`Product: ${name}`);
      console.log(`  Available: ${available.length}, Pre-order: ${preorders.length}`);

      // Check each product's link
      let allValid = true;

      available.forEach(avail => {
        if (!avail.linked_product_id) {
          console.log(`  ⚠️  Available ID ${avail.id} has no link`);
          allValid = false;
          missingLinks++;
        } else {
          const linked = preorders.find(p => p.id === avail.linked_product_id);
          if (!linked) {
            console.log(`  ✗ Available ID ${avail.id} linked to ${avail.linked_product_id} (not a pre-order of same name)`);
            allValid = false;
            invalidLinks++;
          } else {
            console.log(`  ✓ Available ID ${avail.id} ↔ Pre-order ID ${avail.linked_product_id}`);
            validLinks++;
          }
        }
      });

      preorders.forEach(pre => {
        if (!pre.linked_product_id) {
          console.log(`  ⚠️  Pre-order ID ${pre.id} has no link`);
          allValid = false;
          missingLinks++;
        } else {
          const linked = available.find(p => p.id === pre.linked_product_id);
          if (!linked) {
            console.log(`  ✗ Pre-order ID ${pre.id} linked to ${pre.linked_product_id} (not an available of same name)`);
            allValid = false;
            invalidLinks++;
          } else {
            // Already counted from available side
          }
        }
      });

      if (allValid && available.length === 1 && preorders.length === 1) {
        console.log(`  ✓✓✓ Perfect 1:1 link\n`);
      } else {
        console.log(`  ⚠️  Issue detected\n`);
      }
    }

    console.log('=== Summary ===');
    console.log(`Valid links: ${validLinks}`);
    console.log(`Invalid links: ${invalidLinks}`);
    console.log(`Missing links: ${missingLinks}`);
    console.log('\n=== Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyProductLinking();
