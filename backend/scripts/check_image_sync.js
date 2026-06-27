require('dotenv').config();
const { pool } = require('../utils/db');

async function checkImageSync() {
  try {
    console.log('=== Checking Image Sync Between Regular and Pre-order ===\n');

    // Get products grouped by name
    const result = await pool.query(`
      SELECT
        name,
        is_preorder,
        id,
        image_url
      FROM products
      WHERE is_available = true
      ORDER BY name, is_preorder
    `);

    const productMap = {};
    
    result.rows.forEach(row => {
      if (!productMap[row.name]) {
        productMap[row.name] = {};
      }
      productMap[row.name][row.is_preorder ? 'preorder' : 'regular'] = {
        id: row.id,
        image_url: row.image_url
      };
    });

    let syncedImages = [];
    let differentImages = [];
    let missingImages = [];

    Object.keys(productMap).forEach(name => {
      const regular = productMap[name].regular;
      const preorder = productMap[name].preorder;

      if (regular && preorder) {
        if (regular.image_url === preorder.image_url) {
          syncedImages.push({
            name,
            regular_id: regular.id,
            preorder_id: preorder.id,
            image_url: regular.image_url
          });
        } else {
          differentImages.push({
            name,
            regular_id: regular.id,
            preorder_id: preorder.id,
            regular_image: regular.image_url,
            preorder_image: preorder.image_url
          });
        }
      }
    });

    console.log('=== SYNCED IMAGES (same image for regular and pre-order) ===');
    if (syncedImages.length === 0) {
      console.log('None');
    } else {
      syncedImages.forEach(item => {
        console.log(`✓ ${item.name}: Regular ID ${item.regular_id}, Pre-order ID ${item.preorder_id}`);
        console.log(`  Image: ${item.image_url}`);
      });
    }

    console.log('\n=== DIFFERENT IMAGES (different images for regular and pre-order) ===');
    if (differentImages.length === 0) {
      console.log('None');
    } else {
      differentImages.forEach(item => {
        console.log(`⚠ ${item.name}: Regular ID ${item.regular_id}, Pre-order ID ${item.preorder_id}`);
        console.log(`  Regular image: ${item.regular_image}`);
        console.log(`  Pre-order image: ${item.preorder_image}`);
      });
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Synced images: ${syncedImages.length}`);
    console.log(`Different images: ${differentImages.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkImageSync();
