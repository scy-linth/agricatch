require('dotenv').config();
const { pool } = require('../utils/db');

async function cleanupProductSyncDryRun() {
  try {
    console.log('=== Product Sync Cleanup - DRY RUN ===\n');
    console.log('This will show what will be deleted WITHOUT actually deleting.\n');
    
    // Get all products grouped by name and type
    const productGroups = await pool.query(`
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
        console.log(`⚠ ${productName}:`);
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
    
    if (productsToDelete.length > 0) {
      console.log(`\nProducts to delete: ${productsToDelete.join(', ')}`);
      
      // Check what will be deleted from each table
      for (const productId of productsToDelete) {
        const cartCount = await pool.query('SELECT COUNT(*) FROM cart WHERE product_id = $1', [productId]);
        const wishlistCount = await pool.query('SELECT COUNT(*) FROM wishlist WHERE product_id = $1', [productId]);
        const reviewsCount = await pool.query('SELECT COUNT(*) FROM reviews WHERE product_id = $1', [productId]);
        const notificationsCount = await pool.query('SELECT COUNT(*) FROM notifications WHERE product_id = $1', [productId]);
        
        console.log(`\nProduct ID ${productId}:`);
        console.log(`  Cart entries: ${cartCount.rows[0].count}`);
        console.log(`  Wishlist entries: ${wishlistCount.rows[0].count}`);
        console.log(`  Reviews: ${reviewsCount.rows[0].count}`);
        console.log(`  Notifications: ${notificationsCount.rows[0].count}`);
      }
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('Error during dry run:', error);
    await pool.end();
    process.exit(1);
  }
}

cleanupProductSyncDryRun();
