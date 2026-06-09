/*
  WARNING: This script will RECREATE products with NEW IDs if they don't exist.
  Only run this for testing/demo purposes. It will:
  - Insert 20 specific demo products into the database
  - Skip products that already exist (by name and farmer_id)

  If you delete products manually and then run this script, they may reappear with different IDs.
*/

const { Pool } = require('pg');

const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: pgSsl,
});

const PRODUCT_SEED = [
  { name: 'Ampalaya', category: 'Vegetables', price: 85, unit: 'kg', stock: 90, location: 'Laguna, Philippines', desc: 'Fresh bitter gourd harvested this week.' },
  { name: 'Baguio Beans', category: 'Vegetables', price: 95, unit: 'kg', stock: 100, location: 'Benguet, Philippines', desc: 'Crisp baguio beans for stir-fry and salads.' },
  { name: 'Red Bell Pepper', category: 'Vegetables', price: 180, unit: 'kg', stock: 65, location: 'Bukidnon, Philippines', desc: 'Sweet and crunchy red bell peppers.' },
  { name: 'Sayote', category: 'Vegetables', price: 60, unit: 'kg', stock: 120, location: 'Nueva Vizcaya, Philippines', desc: 'Fresh sayote perfect for soups and ginisa.' },
  { name: 'Kangkong', category: 'Vegetables', price: 40, unit: 'bundle', stock: 160, location: 'Bulacan, Philippines', desc: 'Leafy water spinach, freshly picked.' },

  { name: 'Mango (Carabao)', category: 'Fruits', price: 140, unit: 'kg', stock: 80, location: 'Guimaras, Philippines', desc: 'Sweet ripe Carabao mangoes.' },
  { name: 'Pineapple (Formosa)', category: 'Fruits', price: 75, unit: 'pc', stock: 120, location: 'Bukidnon, Philippines', desc: 'Juicy Formosa pineapples from local farms.' },
  { name: 'Papaya', category: 'Fruits', price: 65, unit: 'kg', stock: 110, location: 'Davao, Philippines', desc: 'Ripe papaya ideal for dessert and shakes.' },
  { name: 'Banana (Lakatan)', category: 'Fruits', price: 95, unit: 'kg', stock: 140, location: 'Davao del Norte, Philippines', desc: 'Sweet Lakatan bananas.' },
  { name: 'Watermelon (Red Sweet)', category: 'Fruits', price: 55, unit: 'kg', stock: 130, location: 'Ilocos Norte, Philippines', desc: 'Refreshing red sweet watermelon.' },

  { name: 'Chicken Breast Fillet', category: 'Meat & Poultry', price: 240, unit: 'kg', stock: 75, location: 'Batangas, Philippines', desc: 'Fresh skinless chicken breast fillet.' },
  { name: 'Chicken Drumsticks', category: 'Meat & Poultry', price: 210, unit: 'kg', stock: 85, location: 'Pampanga, Philippines', desc: 'Farm-raised chicken drumsticks.' },
  { name: 'Pork Kasim', category: 'Meat & Poultry', price: 320, unit: 'kg', stock: 70, location: 'Bulacan, Philippines', desc: 'Fresh pork shoulder cut (kasim).' },
  { name: 'Pork Liempo', category: 'Meat & Poultry', price: 360, unit: 'kg', stock: 65, location: 'Quezon, Philippines', desc: 'Fresh pork belly strips (liempo).' },
  { name: 'Native Chicken (Whole)', category: 'Meat & Poultry', price: 290, unit: 'kg', stock: 45, location: 'Cavite, Philippines', desc: 'Whole native chicken from backyard farms.' },

  { name: 'Dinorado Rice', category: 'Rice', price: 72, unit: 'kg', stock: 260, location: 'Nueva Ecija, Philippines', desc: 'Premium aromatic dinorado rice.' },
  { name: 'Jasmine Rice', category: 'Rice', price: 68, unit: 'kg', stock: 320, location: 'Isabela, Philippines', desc: 'Fragrant jasmine rice, soft texture when cooked.' },
  { name: 'Brown Rice', category: 'Rice', price: 82, unit: 'kg', stock: 180, location: 'Tarlac, Philippines', desc: 'Nutritious whole grain brown rice.' },
  { name: 'Sinandomeng Rice', category: 'Rice', price: 62, unit: 'kg', stock: 290, location: 'Nueva Ecija, Philippines', desc: 'Classic sinandomeng rice for daily meals.' },
  { name: 'Malagkit Rice', category: 'Rice', price: 88, unit: 'kg', stock: 170, location: 'Pangasinan, Philippines', desc: 'Glutinous rice perfect for kakanin.' },
];

const CATEGORY_MATCHERS = {
  'Vegetables': ['vegetable'],
  'Fruits': ['fruit'],
  'Meat & Poultry': ['meat', 'poultry'],
  'Rice': ['rice', 'grain', 'staple'],
};

async function getCategoryMap() {
  const categories = await pool.query(`SELECT id, name FROM categories`);
  const map = new Map();

  for (const [label, needles] of Object.entries(CATEGORY_MATCHERS)) {
    const category = categories.rows.find((row) => {
      const lower = String(row.name || '').toLowerCase();
      return needles.some((needle) => lower.includes(needle));
    });
    if (!category) {
      throw new Error(`Category not found for ${label}. Available categories: ${categories.rows.map((c) => c.name).join(', ')}`);
    }
    map.set(label, category.id);
  }

  return map;
}

async function getFarmers() {
  const result = await pool.query(
    `SELECT id FROM users WHERE role = 'farmer' ORDER BY id ASC LIMIT 8`
  );
  if (!result.rows.length) {
    throw new Error('No farmer accounts found. Create at least one farmer first.');
  }
  return result.rows.map((row) => row.id);
}

async function upsertProducts() {
  const categoryMap = await getCategoryMap();
  const farmerIds = await getFarmers();

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < PRODUCT_SEED.length; i++) {
    const item = PRODUCT_SEED[i];
    const farmerId = farmerIds[i % farmerIds.length];
    const categoryId = categoryMap.get(item.category);

    const existing = await pool.query(
      `SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND farmer_id = $2 LIMIT 1`,
      [item.name, farmerId]
    );

    if (existing.rows.length) {
      skipped += 1;
      continue;
    }

    await pool.query(
      `
      INSERT INTO products (
        name, description, price, category_id, farmer_id, stock_quantity,
        unit, image_url, location, harvest_date, expiry_date, is_available, sales_count
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true, 0
      )
      `,
      [
        item.name,
        item.desc,
        item.price,
        categoryId,
        farmerId,
        item.stock,
        item.unit,
        '/images/resendlogo.png',
        item.location,
      ]
    );

    inserted += 1;
  }

  return { inserted, skipped };
}

async function main() {
  try {
    const result = await upsertProducts();
    console.log(`Extra products seeded. Inserted: ${result.inserted}, skipped(existing): ${result.skipped}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('seed_extra_products failed:', error.message || error);
  process.exit(1);
});
