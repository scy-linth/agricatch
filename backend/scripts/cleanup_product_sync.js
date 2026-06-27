require('dotenv').config();
const { pool } = require('../utils/db');

async function cleanupProductSync() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== Product Sync Cleanup Script ===\n');
    console.log('This script will:');
    console.log('1. Remove duplicate products (keep only 1 regular + 1 pre-order per name)');
    console.log('2. Delete from cart, wishlist, reviews, notifications');
    console.log('3. Keep orders as historical records\n');
    
    // Get all products grouped by name and type
    const productGroups = await client.query(`
      SELECT 
        name,
        is_preorder,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY id) as product_ids,
        ARRAY_AGG(farmer_id ORDER BY id) as farmer_ids
      FROM products
      WHERE is_available = true
      GROUP BY name, is_preorder
      ORDER BY name, is_preorder
    `);
    
    let productsToDelete = [];
    let productsToKeep = [];
    
    // Process each product name
    const productNames = [...new Set(productGroups.rows.map(r => r.name))];
    
    for (const productName of productNames) {
      const regularProducts = productGroups.rows.find(r => r.name === productName && r.is_preorder === false);
      const preorderProducts = productGroups.rows.find(r => r.name === productName && r.is_preorder === true);
      
      const regularCount = regularProducts ? regularProducts.count : 0;
      const preorderCount = preorderProducts ? preorderProducts.count : 0;
      
      if (regularCount > 1 || preorderCount > 1) {
        console.log(`\n⚠ ${productName}:`);
        console.log(`  Regular: ${regularCount} (keep 1, delete ${regularCount - 1})`);
        console.log(`  Pre-order: ${preorderCount} (keep 1, delete ${preorderCount - 1})`);
        
        // Keep first regular, delete rest
        if (regularProducts) {
          const keepId = regularProducts.product_ids[0];
          const deleteIds = regularProducts.product_ids.slice(1);
          productsToKeep.push(keepId);
          productsToDelete.push(...deleteIds);
          console.log(`  Keeping regular ID: ${keepId}`);
          console.log(`  Deleting regular IDs: ${deleteIds.join(', ')}`);
        }
        
        // Keep first pre-order, delete rest
        if (preorderProducts) {
          const keepId = preorderProducts.product_ids[0];
          const deleteIds = preorderProducts.product_ids.slice(1);
          productsToKeep.push(keepId);
          productsToDelete.push(...deleteIds);
          console.log(`  Keeping pre-order ID: ${keepId}`);
          console.log(`  Deleting pre-order IDs: ${deleteIds.join(', ')}`);
        }
      } else {
        // Already 1:1 or 0:1, keep as is
        if (regularProducts) productsToKeep.push(regularProducts.product_ids[0]);
        if (preorderProducts) productsToKeep.push(preorderProducts.product_ids[0]);
        console.log(`✓ ${productName}: ${regularCount} regular, ${preorderCount} pre-order (OK)`);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Products to keep: ${productsToKeep.length}`);
    console.log(`Products to delete: ${productsToDelete.length}`);
    
    if (productsToDelete.length === 0) {
      console.log('\nNo products to delete. Exiting.');
      await client.query('ROLLBACK');
      return;
    }
    
    // Confirm deletion
    console.log('\n=== Starting Deletion ===');
    
    for (const productId of productsToDelete) {
      console.log(`\nDeleting product ID ${productId}...`);
      
      // Delete from cart
      const cartResult = await client.query('DELETE FROM cart WHERE product_id = $1', [productId]);
      console.log(`  - Deleted from cart: ${cartResult.rowCount} rows`);
      
      // Delete from wishlist
      const wishlistResult = await client.query('DELETE FROM wishlist WHERE product_id = $1', [productId]);
      console.log(`  - Deleted from wishlist: ${wishlistResult.rowCount} rows`);
      
      // Delete from reviews
      const reviewsResult = await client.query('DELETE FROM reviews WHERE product_id = $1', [productId]);
      console.log(`  - Deleted from reviews: ${reviewsResult.rowCount} rows`);
      
      // Delete from notifications
      const notificationsResult = await client.query('DELETE FROM notifications WHERE product_id = $1', [productId]);
      console.log(`  - Deleted from notifications: ${notificationsResult.rowCount} rows`);
      
      // Delete the product
      const productResult = await client.query('DELETE FROM products WHERE id = $1', [productId]);
      console.log(`  - Deleted product: ${productResult.rowCount} rows`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== Cleanup Complete ===');
    console.log(`Deleted ${productsToDelete.length} duplicate products`);
    console.log(`Kept ${productsToKeep.length} products`);
    
    // Show final state
    const finalCheck = await client.query(`
      SELECT 
        name,
        COUNT(*) FILTER (WHERE is_preorder = false) as regular_count,
        COUNT(*) FILTER (WHERE is_preorder = true) as preorder_count
      FROM products
      WHERE is_available = true
      GROUP BY name
      ORDER BY name
    `);
    
    console.log('\n=== Final Product State ===');
    finalCheck.rows.forEach(row => {
      console.log(`${row.name}: ${row.regular_count} regular, ${row.preorder_count} pre-order`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupProductSync();
