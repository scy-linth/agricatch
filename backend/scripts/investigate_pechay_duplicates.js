require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function investigatePechayDuplicates() {
  console.log('=== Investigating Pechay Product Duplicates ===\n');
  
  try {
    // Get all Pechay products
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id, image_url, status
      FROM products
      WHERE name ILIKE '%pechay%'
      ORDER BY id
    `);
    
    console.log(`Found ${result.rows.length} Pechay products:\n`);
    
    result.rows.forEach(product => {
      console.log(`ID: ${product.id}`);
      console.log(`  Name: ${product.name}`);
      console.log(`  Is Pre-order: ${product.is_preorder}`);
      console.log(`  Is Available: ${product.is_available}`);
      console.log(`  Linked Product ID: ${product.linked_product_id || 'NULL'}`);
      console.log(`  Image URL: ${product.image_url || 'NULL'}`);
      console.log(`  Status: ${product.status || 'NULL'}`);
      console.log();
    });
    
    // Check for linked relationships
    console.log('=== Checking Linked Relationships ===\n');
    
    result.rows.forEach(product => {
      if (product.linked_product_id) {
        const linked = result.rows.find(p => p.id === product.linked_product_id);
        if (linked) {
          console.log(`Product ${product.id} (${product.is_preorder ? 'Pre-order' : 'Available'}) is linked to Product ${linked.id} (${linked.is_preorder ? 'Pre-order' : 'Available'})`);
        } else {
          console.log(`Product ${product.id} has linked_product_id ${product.linked_product_id} but linked product not found in Pechay list`);
        }
      }
    });
    
    // Identify the impostor
    console.log('\n=== Identifying Impostor ===\n');
    
    const preorders = result.rows.filter(p => p.is_preorder);
    const available = result.rows.filter(p => !p.is_preorder);
    
    console.log(`Pre-order Pechay products: ${preorders.length}`);
    console.log(`Available Now Pechay products: ${available.length}\n`);
    
    if (preorders.length > 1) {
      console.log('⚠️  Multiple pre-order Pechay products found!');
      preorders.forEach(p => {
        console.log(`  - ID ${p.id}: linked_product_id = ${p.linked_product_id || 'NULL'}`);
      });
    }
    
    if (available.length > 1) {
      console.log('⚠️  Multiple Available Now Pechay products found!');
      available.forEach(p => {
        console.log(`  - ID ${p.id}: linked_product_id = ${p.linked_product_id || 'NULL'}`);
      });
    }
    
    // Find the impostor (pre-order without proper link)
    const impostors = preorders.filter(p => !p.linked_product_id);
    if (impostors.length > 0) {
      console.log('\n🚨 IMPOSTOR(S) FOUND (Pre-order without linked_product_id):');
      impostors.forEach(p => {
        console.log(`  - ID ${p.id}: ${p.name}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

investigatePechayDuplicates();
