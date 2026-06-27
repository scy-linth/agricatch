require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function verifyProductLinks() {
  try {
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id
      FROM products
      WHERE is_admin_disabled = false
      ORDER BY name
    `);

    console.log('=== Active Products ===');
    result.rows.forEach(p => {
      const type = p.is_preorder ? 'Pre-order' : 'Available';
      console.log(`${p.name} ID ${p.id} (${type}) linked to ${p.linked_product_id || 'NULL'}`);
    });

    // Check for issues
    const productsByName = {};
    result.rows.forEach(product => {
      const name = product.name.toLowerCase();
      if (!productsByName[name]) {
        productsByName[name] = [];
      }
      productsByName[name].push(product);
    });

    console.log('\n=== Issues ===');
    let hasIssues = false;

    for (const [name, group] of Object.entries(productsByName)) {
      const available = group.filter(p => !p.is_preorder);
      const preorders = group.filter(p => p.is_preorder);

      if (available.length !== 1 || preorders.length !== 1) {
        console.log(`⚠️  ${name}: Available=${available.length}, Pre-order=${preorders.length}`);
        hasIssues = true;
      }

      if (available.length === 1 && preorders.length === 1) {
        const avail = available[0];
        const pre = preorders[0];
        if (avail.linked_product_id !== pre.id || pre.linked_product_id !== avail.id) {
          console.log(`⚠️  ${name}: Not properly linked`);
          hasIssues = true;
        }
      }
    }

    if (!hasIssues) {
      console.log('✓ All products properly linked 1:1');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyProductLinks();
