require('dotenv').config();
const { pool } = require('../utils/db');

async function deleteMeatPoultryCategory() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== Deleting Meat & Poultry Category ===\n');
    
    // Find the category
    const categoryResult = await client.query(
      "SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1)",
      ['Meat & Poultry']
    );
    
    if (categoryResult.rows.length === 0) {
      console.log('Category "Meat & Poultry" not found');
      await client.query('ROLLBACK');
      return;
    }
    
    const categoryId = categoryResult.rows[0].id;
    console.log(`Found category ID: ${categoryId}`);
    
    // Check for products in this category
    const productCount = await client.query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1',
      [categoryId]
    );
    
    if (parseInt(productCount.rows[0].count) > 0) {
      console.log(`⚠ Warning: ${productCount.rows[0].count} products in this category`);
      console.log('Deleting products first...');
      
      // Delete products in this category
      const productsResult = await client.query(
        'SELECT id FROM products WHERE category_id = $1',
        [categoryId]
      );
      
      for (const product of productsResult.rows) {
        // Delete from cart
        await client.query('DELETE FROM cart WHERE product_id = $1', [product.id]);
        // Delete from wishlist
        await client.query('DELETE FROM wishlist WHERE product_id = $1', [product.id]);
        // Delete from reviews
        await client.query('DELETE FROM reviews WHERE product_id = $1', [product.id]);
        // Delete from notifications
        await client.query('DELETE FROM notifications WHERE product_id = $1', [product.id]);
        // Delete the product
        await client.query('DELETE FROM products WHERE id = $1', [product.id]);
        console.log(`  Deleted product ID: ${product.id}`);
      }
    }
    
    // Delete the category
    const deleteResult = await client.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    console.log(`\nDeleted category: ${deleteResult.rowCount} rows`);
    
    await client.query('COMMIT');
    
    console.log('\n=== Deletion Complete ===');
    
    // Show remaining categories
    const remainingCategories = await client.query('SELECT id, name FROM categories ORDER BY name');
    console.log('\n=== Remaining Categories ===');
    remainingCategories.rows.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id})`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during deletion:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deleteMeatPoultryCategory();
