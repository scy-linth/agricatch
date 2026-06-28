require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkBrokenLinkedProducts() {
  console.log('=== BROKEN LINKED PRODUCTS CHECK ===\n');

  try {
    // Check 1: Products with linked_product_id pointing to non-existent product
    const invalidLinked = await pool.query(`
      SELECT p.id, p.name, p.linked_product_id
      FROM products p
      WHERE p.linked_product_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.id = p.linked_product_id)
    `);
    console.log(`1. Products with invalid linked_product_id: ${invalidLinked.rows.length}`);
    if (invalidLinked.rows.length > 0) {
      invalidLinked.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}) links to non-existent product ${p.linked_product_id}`);
      });
    }

    // Check 2: Circular linked products (A links to B, B links to A)
    const circular = await pool.query(`
      SELECT p1.id, p1.name, p1.linked_product_id, p2.id as linked_id, p2.name as linked_name
      FROM products p1
      JOIN products p2 ON p1.linked_product_id = p2.id
      WHERE p2.linked_product_id = p1.id
    `);
    console.log(`2. Circular linked product pairs: ${circular.rows.length}`);
    if (circular.rows.length > 0) {
      circular.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}) <-> Product ${p.linked_id} (${p.linked_name})`);
      });
    }

    // Check 3: Products linking to themselves
    const selfLinked = await pool.query(`
      SELECT id, name, linked_product_id
      FROM products
      WHERE linked_product_id = id
    `);
    console.log(`3. Products linking to themselves: ${selfLinked.rows.length}`);
    if (selfLinked.rows.length > 0) {
      selfLinked.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}) links to itself`);
      });
    }

    // Check 4: Linked products with different farmers (should be same farmer)
    const differentFarmers = await pool.query(`
      SELECT p1.id, p1.name, p1.farmer_id, p1.linked_product_id, p2.farmer_id as linked_farmer_id
      FROM products p1
      JOIN products p2 ON p1.linked_product_id = p2.id
      WHERE p1.farmer_id != p2.farmer_id
    `);
    console.log(`4. Linked products with different farmers: ${differentFarmers.rows.length}`);
    if (differentFarmers.rows.length > 0) {
      differentFarmers.rows.forEach(p => {
        console.log(`   - Product ${p.id} (farmer ${p.farmer_id}) links to product ${p.linked_product_id} (farmer ${p.linked_farmer_id})`);
      });
    }

    // Check 5: Available products linked to unavailable products (may be intentional)
    const availableLinkedUnavailable = await pool.query(`
      SELECT p1.id, p1.name, p1.is_available, p1.linked_product_id, p2.is_available as linked_available
      FROM products p1
      JOIN products p2 ON p1.linked_product_id = p2.id
      WHERE p1.is_available = true AND p2.is_available = false
    `);
    console.log(`5. Available products linked to unavailable products: ${availableLinkedUnavailable.rows.length}`);
    if (availableLinkedUnavailable.rows.length > 0) {
      availableLinkedUnavailable.rows.forEach(p => {
        console.log(`   - Available product ${p.id} (${p.name}) links to unavailable product ${p.linked_product_id}`);
      });
    }

    const totalIssues = invalidLinked.rows.length + circular.rows.length + selfLinked.rows.length + 
                       differentFarmers.rows.length + availableLinkedUnavailable.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total broken linked product issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No broken linked products detected');
    } else {
      console.log('✗ Broken linked products detected - review above issues');
    }

  } catch (error) {
    console.error('Error checking broken linked products:', error);
  } finally {
    await pool.end();
  }
}

checkBrokenLinkedProducts();
