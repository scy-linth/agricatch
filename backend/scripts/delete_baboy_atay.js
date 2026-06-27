require('dotenv').config();
const { pool } = require('../utils/db');

async function deleteBaboyAtay() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== Deleting Baboy - Atay ===\n');
    
    // Find product
    const productResult = await client.query(
      "SELECT id, name FROM products WHERE LOWER(name) = LOWER($1)",
      ['Baboy - Atay']
    );
    
    if (productResult.rows.length === 0) {
      console.log('Product "Baboy - Atay" not found in products table');
    } else {
      const productId = productResult.rows[0].id;
      console.log(`Found product ID: ${productId}`);
      
      // Delete from cart
      const cartResult = await client.query('DELETE FROM cart WHERE product_id = $1', [productId]);
      console.log(`Deleted from cart: ${cartResult.rowCount} rows`);
      
      // Delete from wishlist
      const wishlistResult = await client.query('DELETE FROM wishlist WHERE product_id = $1', [productId]);
      console.log(`Deleted from wishlist: ${wishlistResult.rowCount} rows`);
      
      // Delete from reviews
      const reviewsResult = await client.query('DELETE FROM reviews WHERE product_id = $1', [productId]);
      console.log(`Deleted from reviews: ${reviewsResult.rowCount} rows`);
      
      // Delete from notifications
      const notificationsResult = await client.query('DELETE FROM notifications WHERE product_id = $1', [productId]);
      console.log(`Deleted from notifications: ${notificationsResult.rowCount} rows`);
      
      // Delete the product
      const productDeleteResult = await client.query('DELETE FROM products WHERE id = $1', [productId]);
      console.log(`Deleted product: ${productDeleteResult.rowCount} rows`);
    }
    
    // Find and delete from product catalog
    const catalogResult = await client.query(
      "SELECT id, name FROM product_name_catalog WHERE LOWER(name) = LOWER($1)",
      ['Baboy - Atay']
    );
    
    if (catalogResult.rows.length === 0) {
      console.log('\nProduct catalog entry "Baboy - Atay" not found');
    } else {
      const catalogId = catalogResult.rows[0].id;
      console.log(`\nFound catalog entry ID: ${catalogId}`);
      
      const catalogDeleteResult = await client.query('DELETE FROM product_name_catalog WHERE id = $1', [catalogId]);
      console.log(`Deleted from product catalog: ${catalogDeleteResult.rowCount} rows`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== Deletion Complete ===');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during deletion:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deleteBaboyAtay();
