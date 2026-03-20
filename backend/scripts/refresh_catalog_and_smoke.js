/*
  Refreshes demo catalog and executes an end-to-end smoke test:
  - removes old smoke users/products/orders/reviews
  - creates alias farmer accounts (Batman/Superman/etc.)
  - ensures at least one realistic product per non-fishery category with Cloudinary image URLs
  - runs customer order + farmer status progression + customer review smoke flow
*/

require('dotenv').config();

const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const BASE = process.env.SMOKE_API_BASE || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

const CLOUDINARY_IMAGES = [
  'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1312461204/bike.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1312461204/puppy.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1312461204/horse.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1312461204/yellow_tulip.jpg'
];

const ALIAS_FARMERS = [
  { username: 'batman_farm', full_name: 'Batman', email: 'batman.farm@agricatch.local', address: 'Gotham Valley' },
  { username: 'superman_farm', full_name: 'Superman', email: 'superman.farm@agricatch.local', address: 'Smallville Plains' },
  { username: 'wonderwoman_farm', full_name: 'Wonder Woman', email: 'wonderwoman.farm@agricatch.local', address: 'Themyscira Fields' },
  { username: 'flash_farm', full_name: 'Flash', email: 'flash.farm@agricatch.local', address: 'Central City Acres' }
];

function createPool() {
  // Prefer a single connection string if available to avoid mixed/undefined fields
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        String(process.env.DB_HOST || '').includes('render.com') ||
        String(process.env.DB_HOST || '').includes('supabase.com')
          ? { rejectUnauthorized: false }
          : false
    });
  }

  return new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl:
      String(process.env.DB_HOST || '').includes('render.com') ||
      String(process.env.DB_HOST || '').includes('supabase.com')
        ? { rejectUnauthorized: false }
        : false
  });
}

async function jfetch(url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(opts.headers || {}) };
  if (opts.json) {
    opts.body = JSON.stringify(opts.json);
    opts.headers['content-type'] = 'application/json';
    delete opts.json;
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function getUserColumns(pool) {
  const result = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
  return new Set(result.rows.map((r) => r.column_name));
}

async function upsertUser(pool, columns, payload) {
  const existing = await pool.query(
    'SELECT id, username, email, role FROM users WHERE username = $1 OR email = $2 LIMIT 1',
    [payload.username, payload.email]
  );

  if (existing.rows.length) {
    const id = existing.rows[0].id;
    const updates = [];
    const values = [];
    let idx = 1;
    const push = (col, val) => {
      if (!columns.has(col)) return;
      updates.push(`${col} = $${idx++}`);
      values.push(val);
    };

    push('full_name', payload.full_name);
    push('role', payload.role);
    push('user_type', payload.role);
    push('is_verified', true);
    push('address', payload.address);
    push('shop_avatar_url', payload.shop_avatar_url || null);
    push('shop_banner_url', payload.shop_banner_url || null);

    if (updates.length) {
      values.push(id);
      await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`, values);
    }

    return id;
  }

  const fields = [];
  const values = [];
  const add = (col, val) => {
    if (!columns.has(col)) return;
    fields.push(col);
    values.push(val);
  };

  add('username', payload.username);
  add('email', payload.email);
  add('full_name', payload.full_name);
  add('role', payload.role);
  add('user_type', payload.role);
  add('is_verified', true);
  add('address', payload.address);
  add('password', payload.password);
  add('password_hash', payload.password);
  add('shop_avatar_url', payload.shop_avatar_url || null);
  add('shop_banner_url', payload.shop_banner_url || null);

  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  const inserted = await pool.query(
    `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    values
  );
  return inserted.rows[0].id;
}

function categoryProduct(categoryName) {
  const name = String(categoryName || '').toLowerCase();
  if (name.includes('vegetable')) return { name: 'Fresh Mixed Vegetables', unit: 'kg', price: 95 };
  if (name.includes('fruit')) return { name: 'Seasonal Fruit Basket', unit: 'kg', price: 130 };
  if (name.includes('rice') || name.includes('grain') || name.includes('staple')) return { name: 'Premium Well-Milled Rice', unit: 'kg', price: 62 };
  if (name.includes('meat') || name.includes('poultry')) return { name: 'Farm Chicken Cut Pack', unit: 'pack', price: 220 };
  if (name.includes('herb') || name.includes('spice')) return { name: 'Aromatic Herb Bundle', unit: 'bundle', price: 85 };
  return { name: `${categoryName} Market Selection`, unit: 'pack', price: 120 };
}

async function cleanupSmokeData(pool) {
  const smokeUsers = await pool.query(
    `SELECT id FROM users
     WHERE LOWER(COALESCE(username, '')) LIKE '%smoke%'
        OR LOWER(COALESCE(email, '')) LIKE '%smoke%'
        OR LOWER(COALESCE(full_name, '')) LIKE '%smoke%'
        OR LOWER(COALESCE(username, '')) LIKE '%dev_plain_local%'
        OR LOWER(COALESCE(email, '')) LIKE '%local-register-test%'
    `
  );

  const smokeProducts = await pool.query(
    `SELECT id FROM products
     WHERE LOWER(COALESCE(name, '')) LIKE '%smoke%'
        OR LOWER(COALESCE(description, '')) LIKE '%smoke%'
        OR LOWER(COALESCE(description, '')) LIKE '%alias_smoke_flow%'
    `
  );

  const userIds = smokeUsers.rows.map((r) => Number(r.id)).filter(Boolean);
  let productIds = smokeProducts.rows.map((r) => Number(r.id)).filter(Boolean);

  if (userIds.length) {
    const farmerProducts = await pool.query(
      'SELECT id FROM products WHERE farmer_id = ANY($1::int[])',
      [userIds]
    );
    productIds = [...new Set([...productIds, ...farmerProducts.rows.map((r) => Number(r.id)).filter(Boolean)])];
  }

  const smokeOrders = await pool.query(
    `SELECT id FROM orders
     WHERE LOWER(COALESCE(special_instructions, '')) LIKE '%smoke%'
        OR LOWER(COALESCE(special_instructions, '')) LIKE '%alias_smoke_flow%'
        OR user_id = ANY($1::int[])
        OR product_id = ANY($2::int[])
    `,
    [userIds.length ? userIds : [0], productIds.length ? productIds : [0]]
  );
  const orderIds = smokeOrders.rows.map((r) => Number(r.id)).filter(Boolean);

  if (!userIds.length && !productIds.length) {
    return { removedUsers: 0, removedProducts: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (productIds.length) {
      await client.query('DELETE FROM notifications WHERE product_id = ANY($1::int[])', [productIds]);
      await client.query('DELETE FROM cart WHERE product_id = ANY($1::int[])', [productIds]);
      await client.query('DELETE FROM wishlist WHERE product_id = ANY($1::int[])', [productIds]);
      await client.query('DELETE FROM reviews WHERE product_id = ANY($1::int[])', [productIds]);
      await client.query('DELETE FROM order_items WHERE product_id = ANY($1::int[])', [productIds]).catch(() => {});
    }

    if (orderIds.length) {
      await client.query('DELETE FROM notifications WHERE order_id = ANY($1::int[])', [orderIds]);
      await client.query('DELETE FROM order_items WHERE order_id = ANY($1::int[])', [orderIds]).catch(() => {});
      await client.query('DELETE FROM orders WHERE id = ANY($1::int[])', [orderIds]);
    }

    if (productIds.length) {
      await client.query('DELETE FROM products WHERE id = ANY($1::int[])', [productIds]);
    }

    if (userIds.length) {
      await client.query('DELETE FROM notifications WHERE user_id = ANY($1::int[])', [userIds]);
      await client.query('DELETE FROM cart WHERE user_id = ANY($1::int[])', [userIds]);
      await client.query('DELETE FROM wishlist WHERE user_id = ANY($1::int[])', [userIds]);
      await client.query('DELETE FROM reviews WHERE user_id = ANY($1::int[])', [userIds]);
      await client.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::int[]))', [userIds]).catch(() => {});
      await client.query('DELETE FROM notifications WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::int[]))', [userIds]);
      await client.query('DELETE FROM orders WHERE user_id = ANY($1::int[])', [userIds]);
      await client.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
    }


    await client.query('COMMIT');
    return { removedUsers: userIds.length, removedProducts: productIds.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedAliasFarmersAndCatalog(pool) {
  const columns = await getUserColumns(pool);
  const farmers = [];

  for (let i = 0; i < ALIAS_FARMERS.length; i += 1) {
    const alias = ALIAS_FARMERS[i];
    const farmerId = await upsertUser(pool, columns, {
      ...alias,
      role: 'farmer',
      password: 'Pass1234!',
      shop_avatar_url: CLOUDINARY_IMAGES[i % CLOUDINARY_IMAGES.length],
      shop_banner_url: CLOUDINARY_IMAGES[(i + 1) % CLOUDINARY_IMAGES.length]
    });
    farmers.push({ id: farmerId, ...alias });
  }

  const categories = await pool.query(
    `SELECT id, name, type
     FROM categories
     WHERE COALESCE(LOWER(type), '') <> 'fishery'
       AND LOWER(COALESCE(name, '')) NOT LIKE '%fish%'
       AND LOWER(COALESCE(name, '')) NOT LIKE '%seafood%'
     ORDER BY id ASC`
  );

  let seededCount = 0;
  // Ensure up to 20 products per category, linked to alias farmers (rotated).
  const TARGET_PER_CATEGORY = 20;
  for (let i = 0; i < categories.rows.length; i += 1) {
    const category = categories.rows[i];
    // count existing products in this category
    const existingCountRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1',
      [category.id]
    );
    const existingCount = Number(existingCountRes.rows[0].count || 0);
    const toCreate = Math.max(0, TARGET_PER_CATEGORY - existingCount);
    if (toCreate <= 0) continue;

    for (let j = 0; j < toCreate; j += 1) {
      const farmer = farmers[(i + j) % farmers.length];
      const picked = categoryProduct(category.name);
      const image = CLOUDINARY_IMAGES[(i + j) % CLOUDINARY_IMAGES.length];
      const priceVariation = Math.round(picked.price * (0.9 + Math.random() * 0.2));
      const name = `${picked.name} ${j + 1}`;
      // random harvest within last 7 days
      const now = new Date();
      const harvestOffset = Math.floor(Math.random() * 7) + 1; // 1-7 days ago
      const harvestDate = new Date(now);
      harvestDate.setDate(now.getDate() - harvestOffset);
      // expiry 3-14 days after harvest
      const expiryOffset = Math.floor(Math.random() * 12) + 3; // 3-14 days
      const expiryDate = new Date(harvestDate);
      expiryDate.setDate(harvestDate.getDate() + expiryOffset);

      await pool.query(
        `INSERT INTO products
          (name, description, price, category_id, farmer_id, stock_quantity, unit, image_url, location, harvest_date, expiry_date, is_available)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)`,
        [
          name,
          `Fresh ${picked.name.toLowerCase()} from ${farmer.full_name}. Item ${j + 1}.`,
          priceVariation,
          category.id,
          farmer.id,
          50,
          picked.unit,
          image,
          farmer.address,
          harvestDate.toISOString().slice(0, 10),
          expiryDate.toISOString().slice(0, 10)
        ]
      );
      seededCount += 1;
    }
  }

  const batmanFarmer = farmers[0];
  const primaryCategory = categories.rows[0];
  const smokeName = 'Hero Harvest Bundle';

  const smokeProductExisting = await pool.query(
    'SELECT id FROM products WHERE name = $1 AND farmer_id = $2 LIMIT 1',
    [smokeName, batmanFarmer.id]
  );

  let smokeProductId;
  if (smokeProductExisting.rows.length) {
    smokeProductId = smokeProductExisting.rows[0].id;
  } else {
    // set harvest/expiry for the smoke product
    const smokeHarvest = new Date();
    smokeHarvest.setDate(smokeHarvest.getDate() - 3);
    const smokeExpiry = new Date(smokeHarvest);
    smokeExpiry.setDate(smokeHarvest.getDate() + 10);

    const inserted = await pool.query(
      `INSERT INTO products
        (name, description, price, category_id, farmer_id, stock_quantity, unit, image_url, location, harvest_date, expiry_date, is_available)
       VALUES
        ($1, $2, $3, $4, $5, $6, 'box', $7, $8, $9, $10, true)
       RETURNING id`,
      [
        smokeName,
        'Signature produce mix from Batman [alias_smoke_flow]',
        180,
        primaryCategory.id,
        batmanFarmer.id,
        40,
        CLOUDINARY_IMAGES[0],
        batmanFarmer.address,
        smokeHarvest.toISOString().slice(0, 10),
        smokeExpiry.toISOString().slice(0, 10)
      ]
    );
    smokeProductId = inserted.rows[0].id;
  }

  const customerId = await upsertUser(pool, columns, {
    username: 'lois_lane_customer',
    full_name: 'Lois Lane',
    email: 'lois.lane.customer@agricatch.local',
    role: 'customer',
    address: 'Metropolis District',
    password: 'Pass1234!'
  });

  return { farmers, smokeProductId, customerId, seededCount, categoryCount: categories.rows.length };
}

async function runSmokeOrderReview(pool, { customerId, farmerId, productId }) {
  await pool.query('DELETE FROM reviews WHERE product_id = $1 AND user_id = $2', [productId, customerId]);

  const customerToken = jwt.sign({ id: customerId, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
  const farmerToken = jwt.sign({ id: farmerId, role: 'farmer' }, JWT_SECRET, { expiresIn: '1h' });

  const addCart = await jfetch(`${BASE}/cart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    json: { productId, quantity: 1 }
  });
  if (!addCart.ok) throw new Error(`cart.add failed: ${JSON.stringify(addCart.body)}`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const deliveryDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const createOrder = await jfetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    json: {
      delivery_address: 'Metropolis District',
      delivery_date: deliveryDate,
      special_instructions: 'alias_smoke_flow'
    }
  });

  if (!createOrder.ok || !Array.isArray(createOrder.body?.orderIds) || !createOrder.body.orderIds.length) {
    throw new Error(`orders.create failed: ${JSON.stringify(createOrder.body)}`);
  }

  const orderId = Number(createOrder.body.orderIds[0]);
  const flow = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'];
  for (const status of flow) {
    const update = await jfetch(`${BASE}/orders/${orderId}/items/${orderId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${farmerToken}` },
      json: { status }
    });
    if (!update.ok) throw new Error(`orders.status.${status} failed: ${JSON.stringify(update.body)}`);
  }

  const review = await jfetch(`${BASE}/products/${productId}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    json: {
      rating: 5,
      comment: 'Excellent quality and very fresh produce.'
    }
  });
  if (!review.ok) throw new Error(`reviews.create failed: ${JSON.stringify(review.body)}`);

  const reviewsList = await jfetch(`${BASE}/products/${productId}/reviews`);
  if (!reviewsList.ok || !Array.isArray(reviewsList.body?.reviews)) {
    throw new Error(`reviews.list failed: ${JSON.stringify(reviewsList.body)}`);
  }
  const found = reviewsList.body.reviews.some((r) => Number(r.user_id) === Number(customerId));
  if (!found) throw new Error('reviews.list missing newly created customer review');

  return { orderId, reviewId: review.body?.review?.id || null };
}

async function runBulkPurchases(pool, { customerBase = [], productIds = [], repeatPerProduct = 3 }) {
  const results = [];
  for (let i = 0; i < customerBase.length; i += 1) {
    const cust = customerBase[i];
    try {
      const customerToken = jwt.sign({ id: cust.id, role: 'customer' }, JWT_SECRET, { expiresIn: '2h' });
      for (const pid of productIds) {
        // add to cart
        await jfetch(`${BASE}/cart`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${customerToken}` },
          json: { productId: pid, quantity: 1 }
        }).catch(() => {});
      }

      // create order
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      const createOrder = await jfetch(`${BASE}/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        json: { delivery_address: cust.address || 'Test District', delivery_date: deliveryDate, special_instructions: 'bulk_purchase_test' }
      });

      if (createOrder.ok && Array.isArray(createOrder.body?.orderIds) && createOrder.body.orderIds.length) {
        for (const oid of createOrder.body.orderIds) {
          // progress each order to delivered by finding its farmer (we'll try to deduce from order items via API) and using farmer token
          // best-effort: fetch order details
          try {
            const orderRes = await jfetch(`${BASE}/orders/${oid}`);
            if (!orderRes.ok) continue;
            const items = orderRes.body?.items || [];
            for (const it of items) {
              const farmerId = it.farmer_id || it.farmerId || it.owner_id;
              if (!farmerId) continue;
              const farmerToken = jwt.sign({ id: farmerId, role: 'farmer' }, JWT_SECRET, { expiresIn: '2h' });
              const flow = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'];
              for (const status of flow) {
                await jfetch(`${BASE}/orders/${oid}/items/${oid}/status`, { method: 'PUT', headers: { Authorization: `Bearer ${farmerToken}` }, json: { status } }).catch(() => {});
              }
            }
          } catch (e) {
            // continue
          }
        }
      }

      results.push({ customer: cust.email, ok: true });
    } catch (e) {
      results.push({ customer: cust.email, ok: false, error: e.message || String(e) });
    }
  }
  return results;
}

async function main() {
  const pool = createPool();
  try {
    console.log('1) Cleaning previous smoke users/products...');
    const cleanup = await cleanupSmokeData(pool);
    console.log('cleanup', cleanup);

    console.log('2) Seeding alias farmers and one real product per category...');
    const seeded = await seedAliasFarmersAndCatalog(pool);
    console.log('seeded', {
      aliasFarmers: seeded.farmers.length,
      categories: seeded.categoryCount,
      insertedForMissingCategories: seeded.seededCount,
      smokeProductId: seeded.smokeProductId,
      customerId: seeded.customerId
    });

      console.log('3) Running customer order + review smoke flow via API...');
      const smoke = await runSmokeOrderReview(pool, {
        customerId: seeded.customerId,
        farmerId: seeded.farmers[0].id,
        productId: seeded.smokeProductId
      });
      console.log('smoke', smoke);

      // 4) Create additional customers and run bulk purchases to stimulate bestseller ranking
      console.log('4) Creating extra customers and running bulk purchases for best-seller tests...');
      const extraCustomersInfo = [
        { username: 'clark_kent', full_name: 'Clark Kent', email: 'clark.kent@agricatch.local', address: 'Metropolis' },
        { username: 'diana_prince', full_name: 'Diana Prince', email: 'diana.prince@agricatch.local', address: 'Themyscira' },
        { username: 'barry_allen', full_name: 'Barry Allen', email: 'barry.allen@agricatch.local', address: 'Central City' },
        { username: 'john_doe1', full_name: 'John Doe 1', email: `john.doe1+${Date.now()}@agricatch.local`, address: 'Testville' },
        { username: 'jane_doe1', full_name: 'Jane Doe 1', email: `jane.doe1+${Date.now()}@agricatch.local`, address: 'Testville' }
      ];
      const customerIds = [];
      for (const info of extraCustomersInfo) {
        const id = await upsertUser(pool, await getUserColumns(pool), { ...info, role: 'customer', password: 'Pass1234!' });
        customerIds.push({ id, email: info.email, address: info.address });
      }

      // pick target products to boost: smoke product + 2 recent products
      const topProductsRes = await pool.query('SELECT id FROM products WHERE is_available = true ORDER BY id DESC LIMIT 5');
      const productIds = topProductsRes.rows.map(r => r.id);
      const bulkResult = await runBulkPurchases(pool, { customerBase: customerIds, productIds, repeatPerProduct: 1 });
      console.log('bulk purchases result', bulkResult);

    console.log('DONE');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('refresh_catalog_and_smoke failed:', err.message || err);
  process.exit(1);
});
