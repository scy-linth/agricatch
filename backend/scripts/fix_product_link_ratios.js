require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

// Available images
const availableImages = [
  'tomatoes.jpg',
  'lettuce.jpg',
  'malunggay.jpg',
  'calamansi.jpg',
  'eggs.jpg',
  'rice.jpg',
  'chicken.jpg'
];

async function uploadImage(token, product) {
  const imageIndex = Math.floor(Math.random() * availableImages.length);
  const imageName = availableImages[imageIndex];
  const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', imageName);

  if (!fs.existsSync(imagePath)) {
    console.error(`    ✗ Image file not found: ${imagePath}`);
    return null;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), imageName);
  formData.append('name', product.name);
  formData.append('category_id', product.category_id);
  formData.append('product_id', product.id);

  const uploadResponse = await fetch(`${API_BASE}/upload/product-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!uploadResponse.ok) {
    console.error(`    ✗ Image upload failed:`, await uploadResponse.text());
    return null;
  }

  return await uploadResponse.json();
}

async function fixProductLinkRatios() {
  console.log('=== Fixing Product Link Ratios ===\n');
  
  try {
    // Login as test farmer
    console.log('1. Logging in as test farmer...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testfarmer@test.com',
        password: 'Test123456'
      })
    });

    if (!loginResponse.ok) {
      console.error('✗ Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    const farmerId = loginData.user?.id || loginData.id;
    console.log('✓ Login successful\n');

    // Get all products
    console.log('2. Getting all products...');
    const result = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id, farmer_id, category_id, image_url, price, unit, description
      FROM products
      WHERE is_admin_disabled = false
      ORDER BY name, id
    `);

    const products = result.rows;
    console.log(`✓ Found ${products.length} products\n`);

    // Group by name
    const productsByName = {};
    products.forEach(product => {
      const name = product.name.toLowerCase();
      if (!productsByName[name]) {
        productsByName[name] = [];
      }
      productsByName[name].push(product);
    });

    console.log('3. Processing product groups...\n');

    for (const [name, group] of Object.entries(productsByName)) {
      const available = group.filter(p => !p.is_preorder);
      const preorders = group.filter(p => p.is_preorder);

      // Skip if only 1 type exists - but handle creating partners
      if (available.length === 0 || preorders.length === 0) {
        // Need to create partner for single-type products
        if (available.length === 1 && preorders.length === 0) {
          const avail = available[0];
          console.log(`Processing: ${name}`);
          console.log(`  Available: 1, Pre-order: 0`);
          console.log(`  ⚠️  Need to create Pre-order partner for Available ID ${avail.id}`);
          
          // Set preorder availability date to 30 days from now
          const availabilityDate = new Date();
          availabilityDate.setDate(availabilityDate.getDate() + 30);
          
          // Create pre-order partner
          const insertResult = await pool.query(`
            INSERT INTO products (name, farmer_id, category_id, is_preorder, is_available, price, unit, description, linked_product_id, status, preorder_availability_date)
            VALUES ($1, $2, $3, true, false, $4, $5, $6, $7, 'pending', $8)
            RETURNING id
          `, [avail.name, avail.farmer_id, avail.category_id, avail.price, avail.unit, avail.description, avail.id, availabilityDate.toISOString().split('T')[0]]);

          const newPreId = insertResult.rows[0].id;
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [newPreId, avail.id]);
          
          console.log(`    ✓ Created Pre-order ID ${newPreId}`);
          
          // Upload image
          const uploadData = await uploadImage(token, { ...avail, id: newPreId });
          if (uploadData) {
            await pool.query('UPDATE products SET image_url = $1, cloudinary_public_id = $2 WHERE id = $3', 
              [uploadData.imageUrl, uploadData.public_id, newPreId]);
            console.log(`    ✓ Image uploaded for ID ${newPreId}`);
          }
          console.log();
        } else if (available.length === 0 && preorders.length === 1) {
          const pre = preorders[0];
          console.log(`Processing: ${name}`);
          console.log(`  Available: 0, Pre-order: 1`);
          console.log(`  ⚠️  Need to create Available partner for Pre-order ID ${pre.id}`);
          
          // Create available partner
          const insertResult = await pool.query(`
            INSERT INTO products (name, farmer_id, category_id, is_preorder, is_available, price, unit, description, linked_product_id, status)
            VALUES ($1, $2, $3, false, true, $4, $5, $6, $7, 'approved')
            RETURNING id
          `, [pre.name, pre.farmer_id, pre.category_id, pre.price, pre.unit, pre.description, pre.id]);

          const newAvailId = insertResult.rows[0].id;
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [newAvailId, pre.id]);
          
          console.log(`    ✓ Created Available ID ${newAvailId}`);
          
          // Upload image
          const uploadData = await uploadImage(token, { ...pre, id: newAvailId });
          if (uploadData) {
            await pool.query('UPDATE products SET image_url = $1, cloudinary_public_id = $2 WHERE id = $3', 
              [uploadData.imageUrl, uploadData.public_id, newAvailId]);
            console.log(`    ✓ Image uploaded for ID ${newAvailId}`);
          }
          console.log();
        }
        continue;
      }

      console.log(`Processing: ${name}`);
      console.log(`  Available: ${available.length}, Pre-order: ${preorders.length}`);

      // Check if already 1:1 and linked
      if (available.length === 1 && preorders.length === 1) {
        const avail = available[0];
        const pre = preorders[0];
        
        if (avail.linked_product_id === pre.id && pre.linked_product_id === avail.id) {
          console.log('  ✓ Already properly linked 1:1\n');
          continue;
        }
      }

      // Check for cross-linked pairs (multiple 1:1 pairs that should be merged)
      if (available.length === 1 && preorders.length === 1) {
        const avail = available[0];
        const pre = preorders[0];
        
        // If they're not linked to each other but both have links, they're in separate pairs
        if (avail.linked_product_id && pre.linked_product_id && 
            avail.linked_product_id !== pre.id && pre.linked_product_id !== avail.id) {
          console.log(`  ⚠️  Cross-linked pairs detected - relinking`);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [pre.id, avail.id]);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [avail.id, pre.id]);
          console.log(`    ✓ Relinked Available ID ${avail.id} ↔ Pre-order ID ${pre.id}\n`);
          continue;
        }
        
        // If one is linked to a disabled product, relink them to each other
        if (avail.linked_product_id && !pre.linked_product_id) {
          console.log(`  ⚠️  Available linked to disabled product - relinking`);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [pre.id, avail.id]);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [avail.id, pre.id]);
          console.log(`    ✓ Relinked Available ID ${avail.id} ↔ Pre-order ID ${pre.id}\n`);
          continue;
        }
        
        if (!avail.linked_product_id && pre.linked_product_id) {
          console.log(`  ⚠️  Pre-order linked to disabled product - relinking`);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [pre.id, avail.id]);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [avail.id, pre.id]);
          console.log(`    ✓ Relinked Available ID ${avail.id} ↔ Pre-order ID ${pre.id}\n`);
          continue;
        }
      }

      // Link unlinked products
      const unlinkedAvailable = available.filter(p => !p.linked_product_id);
      const unlinkedPreorder = preorders.filter(p => !p.linked_product_id);

      if (unlinkedAvailable.length > 0 && unlinkedPreorder.length > 0) {
        // Link them
        const avail = unlinkedAvailable[0];
        const pre = unlinkedPreorder[0];

        console.log(`  Linking: Available ID ${avail.id} ↔ Pre-order ID ${pre.id}`);

        await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [pre.id, avail.id]);
        await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [avail.id, pre.id]);

        console.log('  ✓ Linked successfully\n');
      } else if (unlinkedAvailable.length > 0 || unlinkedPreorder.length > 0) {
        // Need to create partner
        console.log(`  ⚠️  Need to create partner product`);
        
        if (unlinkedAvailable.length > 0) {
          const avail = unlinkedAvailable[0];
          console.log(`    Creating Pre-order partner for Available ID ${avail.id}`);
          
          // Set preorder availability date to 30 days from now
          const availabilityDate = new Date();
          availabilityDate.setDate(availabilityDate.getDate() + 30);
          
          // Create pre-order partner
          const insertResult = await pool.query(`
            INSERT INTO products (name, farmer_id, category_id, is_preorder, is_available, price, unit, description, linked_product_id, status, preorder_availability_date)
            VALUES ($1, $2, $3, true, false, $4, $5, $6, $7, 'pending', $8)
            RETURNING id
          `, [avail.name, avail.farmer_id, avail.category_id, avail.price, avail.unit, avail.description, avail.id, availabilityDate.toISOString().split('T')[0]]);

          const newPreId = insertResult.rows[0].id;
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [newPreId, avail.id]);
          
          console.log(`    ✓ Created Pre-order ID ${newPreId}`);
          
          // Upload image
          const uploadData = await uploadImage(token, { ...avail, id: newPreId });
          if (uploadData) {
            await pool.query('UPDATE products SET image_url = $1, cloudinary_public_id = $2 WHERE id = $3', 
              [uploadData.imageUrl, uploadData.public_id, newPreId]);
            console.log(`    ✓ Image uploaded for ID ${newPreId}`);
          }
        }

        if (unlinkedPreorder.length > 0) {
          const pre = unlinkedPreorder[0];
          console.log(`    Creating Available partner for Pre-order ID ${pre.id}`);
          
          // Create available partner
          const insertResult = await pool.query(`
            INSERT INTO products (name, farmer_id, category_id, is_preorder, is_available, price, unit, description, linked_product_id, status)
            VALUES ($1, $2, $3, false, true, $4, $5, $6, $7, 'approved')
            RETURNING id
          `, [pre.name, pre.farmer_id, pre.category_id, pre.price, pre.unit, pre.description, pre.id]);

          const newAvailId = insertResult.rows[0].id;
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [newAvailId, pre.id]);
          
          console.log(`    ✓ Created Available ID ${newAvailId}`);
          
          // Upload image
          const uploadData = await uploadImage(token, { ...pre, id: newAvailId });
          if (uploadData) {
            await pool.query('UPDATE products SET image_url = $1, cloudinary_public_id = $2 WHERE id = $3', 
              [uploadData.imageUrl, uploadData.public_id, newAvailId]);
            console.log(`    ✓ Image uploaded for ID ${newAvailId}`);
          }
        }

        console.log();
      }

      // Admin disable extras and link remaining pair
      const linkedAvailable = available.filter(p => p.linked_product_id);
      const linkedPreorder = preorders.filter(p => p.linked_product_id);

      if (linkedAvailable.length > 1 || linkedPreorder.length > 1) {
        console.log(`  ⚠️  Disabling extra products and linking remaining pair`);
        
        // Keep first available and first preorder, disable the rest
        const keepAvailable = linkedAvailable[0];
        const keepPreorder = linkedPreorder[0];
        
        // Link the kept pair together
        if (keepAvailable && keepPreorder) {
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [keepPreorder.id, keepAvailable.id]);
          await pool.query('UPDATE products SET linked_product_id = $1 WHERE id = $2', [keepAvailable.id, keepPreorder.id]);
          console.log(`    ✓ Linked Available ID ${keepAvailable.id} ↔ Pre-order ID ${keepPreorder.id}`);
        }
        
        // Disable extra available products
        for (let i = 1; i < linkedAvailable.length; i++) {
          await pool.query('UPDATE products SET is_admin_disabled = true WHERE id = $1', [linkedAvailable[i].id]);
          console.log(`    ✓ Disabled Available ID ${linkedAvailable[i].id}`);
        }
        
        // Disable extra preorder products
        for (let i = 1; i < linkedPreorder.length; i++) {
          await pool.query('UPDATE products SET is_admin_disabled = true WHERE id = $1', [linkedPreorder[i].id]);
          console.log(`    ✓ Disabled Pre-order ID ${linkedPreorder[i].id}`);
        }
      }

      console.log();
    }

    console.log('=== Verification ===\n');
    
    // Verify final state
    const verifyResult = await pool.query(`
      SELECT id, name, is_preorder, is_available, linked_product_id, is_admin_disabled
      FROM products
      WHERE name ILIKE ANY(ARRAY['%ampalaya%', '%bawang%', '%pechay%'])
      ORDER BY name, id
    `);

    verifyResult.rows.forEach(product => {
      const status = product.is_admin_disabled ? '[DISABLED]' : '';
      const type = product.is_preorder ? 'Pre-order' : 'Available';
      console.log(`${product.name} ID ${product.id} (${type}) linked to ${product.linked_product_id || 'NULL'} ${status}`);
    });

    console.log('\n=== Complete ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixProductLinkRatios();
