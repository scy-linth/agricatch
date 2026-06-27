require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function deleteImpostorProducts() {
  console.log('=== Deleting Impostor Products ===\n');
  
  try {
    // Delete impostor Pechay products
    const impostorIds = [79, 83];
    
    for (const id of impostorIds) {
      console.log(`Deleting product ID ${id}...`);
      
      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING name, is_preorder', [id]);
      
      if (result.rows.length > 0) {
        const deleted = result.rows[0];
        console.log(`✓ Deleted: ${deleted.name} (${deleted.is_preorder ? 'Pre-order' : 'Available'})`);
      } else {
        console.log(`✗ Product ID ${id} not found`);
      }
    }
    
    console.log('\n=== Verification ===');
    
    // Verify remaining Pechay products
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id
      FROM products
      WHERE name ILIKE '%pechay%'
      ORDER BY id
    `);
    
    console.log(`\nRemaining Pechay products: ${result.rows.length}`);
    result.rows.forEach(product => {
      console.log(`  ID ${product.id}: ${product.is_preorder ? 'Pre-order' : 'Available'} - linked to ${product.linked_product_id || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

deleteImpostorProducts();
