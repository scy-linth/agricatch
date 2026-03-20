const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl:
      String(process.env.DB_HOST || '').includes('render.com') ||
      String(process.env.DB_HOST || '').includes('supabase.com')
        ? { rejectUnauthorized: false }
        : false,
  });
}

async function run() {
  const base = process.env.SMOKE_API_BASE || 'http://localhost:3001/api';
  const pool = createPool();

  try {
    const farmerRes = await pool.query("SELECT id FROM users WHERE role = 'farmer' ORDER BY id ASC LIMIT 1");
    if (!farmerRes.rows.length) {
      throw new Error('No farmer user found for smoke test');
    }

    const categoryRes = await pool.query(
      "SELECT id, name FROM categories WHERE COALESCE(LOWER(type), '') != 'fishery' AND LOWER(name) NOT LIKE '%fish%' ORDER BY id ASC LIMIT 1"
    );
    if (!categoryRes.rows.length) {
      throw new Error('No non-fishery category found for smoke test');
    }

    const token = jwt.sign(
      { id: farmerRes.rows[0].id, role: 'farmer' },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '1h' }
    );

    const imagePath = path.join(__dirname, '..', '..', 'frontend', 'images', 'logo.png');
    const imageBuffer = fs.readFileSync(imagePath);

    const formData = new FormData();
    const productName = `Smoke Cloudinary Product ${Date.now()}`;
    formData.append('name', productName);
    formData.append('description', 'Smoke test product image uploaded through backend to Cloudinary');
    formData.append('price', '99');
    formData.append('category_id', String(categoryRes.rows[0].id));
    formData.append('stock_quantity', '10');
    formData.append('unit', 'kg');
    formData.append('location', 'Smoke Test');
    formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'logo.png');

    const createRes = await fetch(`${base}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const createText = await createRes.text();
    let createJson = null;
    try {
      createJson = JSON.parse(createText);
    } catch (_) {
      // keep raw text for debugging
    }

    console.log('CREATE_STATUS', createRes.status);
    console.log('CREATE_OK', createRes.ok);
    if (!createRes.ok) {
      console.log('CREATE_BODY', createText.slice(0, 500));
      process.exitCode = 1;
      return;
    }

    const imageUrl = createJson?.product?.image_url || '';
    const isCloudinary = /^https:\/\/res\.cloudinary\.com\//.test(String(imageUrl));
    console.log('IMAGE_URL', imageUrl);
    console.log('IS_CLOUDINARY', isCloudinary);

    const listRes = await fetch(`${base}/products?limit=20`);
    const listJson = await listRes.json();
    const productId = createJson?.product?.id;
    const found = Array.isArray(listJson?.products)
      ? listJson.products.find((p) => Number(p.id) === Number(productId))
      : null;

    console.log('LIST_STATUS', listRes.status);
    console.log('FOUND_IN_LIST', Boolean(found));
    console.log('LIST_IMAGE_URL', found?.image_url || '');

    if (!isCloudinary || !found) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('SMOKE_ERROR', err.message || err);
  process.exit(1);
});
