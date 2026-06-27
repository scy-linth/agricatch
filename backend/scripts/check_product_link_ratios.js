require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function checkProductLinkRatios() {
  console.log('=== Checking Product Link Ratios ===\n');
  
  try {
    // Get all products grouped by name
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id, farmer_id
      FROM products
      WHERE is_admin_disabled = false
      ORDER BY name, id
    `);
    
    // Group by name
    const productsByName = {};
    result.rows.forEach(product => {
      const name = product.name.toLowerCase();
      if (!productsByName[name]) {
        productsByName[name] = [];
      }
      productsByName[name].push(product);
    });
    
    console.log(`Found ${Object.keys(productsByName).length} unique product names\n`);
    
    // Check each product group
    const invalidGroups = [];
    
    for (const [name, products] of Object.entries(productsByName)) {
      const available = products.filter(p => !p.is_preorder);
      const preorders = products.filter(p => p.is_preorder);
      
      // Skip if only 1 type exists
      if (available.length === 0 || preorders.length === 0) {
        continue;
      }
      
      // Check 1:1 ratio
      if (available.length !== 1 || preorders.length !== 1) {
        invalidGroups.push({
          name,
          available,
          preorders,
          issue: available.length > 1 ? 'Multiple Available' : 'Multiple Pre-order'
        });
      }
    }
    
    if (invalidGroups.length === 0) {
      console.log('✓ All products have valid 1:1 ratios\n');
    } else {
      console.log(`⚠️  Found ${invalidGroups.length} product groups with invalid ratios:\n`);
      
      invalidGroups.forEach(group => {
        console.log(`Product: ${group.name}`);
        console.log(`  Issue: ${group.issue}`);
        console.log(`  Available Now (${group.available.length}):`);
        group.available.forEach(p => {
          console.log(`    - ID ${p.id}: linked to ${p.linked_product_id || 'NULL'}`);
        });
        console.log(`  Pre-order (${group.preorders.length}):`);
        group.preorders.forEach(p => {
          console.log(`    - ID ${p.id}: linked to ${p.linked_product_id || 'NULL'}`);
        });
        console.log();
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkProductLinkRatios();
