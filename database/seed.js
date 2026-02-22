// Seed script for AgriCatch (farm products only) database

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Sample data
const sampleUsers = [
  {
    username: 'admin',
    email: 'admin@agricatch.ph',
    password: 'admin123', // Plain text for demonstration (NOT SECURE!)
    full_name: 'AgriCatch Admin',
    phone: '+63 999 999 9999',
    address: 'Admin Office, Manila, Philippines',
    role: 'admin'
  },
  {
    username: 'customer_john',
    email: 'john@customer.ph',
    password: 'password123', // Plain text for demonstration (NOT SECURE!)
    full_name: 'John Customer',
    phone: '+63 917 111 2222',
    address: '456 Customer Street, Quezon City, Philippines',
    role: 'customer'
  },
  {
    username: 'farmer_juan',
    email: 'juan@farm.ph',
    password: 'password123', // Plain text for demonstration (NOT SECURE!)
    full_name: 'Juan dela Cruz',
    phone: '+63 917 123 4567',
    address: '123 Farm Road, Laguna, Philippines',
    role: 'farmer'
  },
  // Farm-only system
];

const sampleProducts = [
  // Agricultural Products - Farmer Juan (farmer_id: 3)
  {
    name: 'Fresh Organic Tomatoes',
    description: 'Vine-ripened organic tomatoes grown without pesticides. Perfect for salads, cooking, and sauces.',
    price: 45.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 100,
    unit: 'kg',
    image_url: '/images/tomatoes.jpg',
    location: 'Laguna, Philippines',
    harvest_date: '2024-01-15',
    expiry_date: '2024-02-15'
  },
  {
    name: 'Premium Rice',
    description: 'High-quality rice variety. Known for its aroma and taste. Perfect for everyday meals.',
    price: 65.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 500,
    unit: 'kg',
    image_url: '/images/rice.jpg',
    location: 'Nueva Ecija, Philippines',
    harvest_date: '2024-01-10',
    expiry_date: '2025-01-10'
  },
  {
    name: 'Fresh Calamansi',
    description: 'Tangy and refreshing calamansi fruits. Essential for Filipino dishes and beverages.',
    price: 120.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 200,
    unit: 'kg',
    image_url: '/images/calamansi.jpg',
    location: 'Laguna, Philippines',
    harvest_date: '2024-01-12',
    expiry_date: '2024-03-12'
  },
  {
    name: 'Native Chicken Eggs',
    description: 'Free-range native chicken eggs. Rich in nutrients and full of flavor.',
    price: 8.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 1000,
    unit: 'pieces',
    image_url: '/images/eggs.jpg',
    location: 'Pampanga, Philippines',
    harvest_date: '2024-01-18',
    expiry_date: '2024-02-18'
  },
  {
    name: 'Fresh Malunggay',
    description: 'Nutrient-rich malunggay leaves. Perfect for soups, stews, and health supplements.',
    price: 35.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 150,
    unit: 'kg',
    image_url: '/images/malunggay.jpg',
    location: 'Quezon, Philippines',
    harvest_date: '2024-01-16',
    expiry_date: '2024-01-25'
  },
  {
    name: 'Fresh Chicken',
    description: 'Fresh and healthy chicken, raised in local farms with natural feed. Perfect for everyday cooking.',
    price: 180.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 50,
    unit: 'kg',
    image_url: '/images/chicken.jpg',
    location: 'Batangas, Philippines',
    harvest_date: '2024-01-22',
    expiry_date: '2024-01-28'
  },
  {
    name: 'Fresh Avocado',
    description: 'Creamy and nutritious avocados. Perfect for smoothies, salads, and healthy snacks.',
    price: 150.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 80,
    unit: 'kg',
    image_url: '/images/avocado.jpg',
    location: 'Davao, Philippines',
    harvest_date: '2024-01-20',
    expiry_date: '2024-02-20'
  },
  {
    name: 'Fresh Lettuce',
    description: 'Crisp and fresh lettuce leaves. Perfect for salads and sandwiches.',
    price: 40.00,
    category_id: 1,
    farmer_id: 3,
    stock_quantity: 120,
    unit: 'kg',
    image_url: '/images/lettuce.jpg',
    location: 'Benguet, Philippines',
    harvest_date: '2024-01-21',
    expiry_date: '2024-02-05'
  }
];

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Insert users
    console.log('Inserting users...');
    for (const user of sampleUsers) {
      await pool.query(`
        INSERT INTO users (username, email, password, full_name, phone, address, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO NOTHING
      `, [user.username, user.email, user.password, user.full_name, user.phone, user.address, user.role]);
    }

    // Clear existing products first (need to delete related records first due to foreign keys)
    console.log('Clearing existing products...');
    try {
      await pool.query('DELETE FROM order_items');
    } catch (e) { /* table might not exist */ }
    try {
      await pool.query('DELETE FROM cart');
    } catch (e) { /* table might not exist */ }
    try {
      await pool.query('DELETE FROM wishlist');
    } catch (e) { /* table might not exist */ }
    try {
      await pool.query('DELETE FROM reviews');
    } catch (e) { /* table might not exist */ }
    await pool.query('DELETE FROM products');

    // Get farmer IDs
    const juanResult = await pool.query('SELECT id FROM users WHERE email = $1', ['juan@farm.ph']);
    const juanId = juanResult.rows[0]?.id || 3;
    console.log(`Farmer Juan ID: ${juanId}`);
    // Update farmer_id in products array based on actual IDs
    const productsToInsert = sampleProducts.map(p => {
      if (p.farmer_id === 3) p.farmer_id = juanId;
      return p;
    });

    // Insert products
    console.log('Inserting products...');
    for (const product of productsToInsert) {
      await pool.query(`
        INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity,
                             unit, image_url, location, harvest_date, expiry_date, is_available)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [product.name, product.description, product.price, product.category_id,
          product.farmer_id, product.stock_quantity, product.unit, product.image_url,
          product.location, product.harvest_date, product.expiry_date, true]);
    }

    console.log(`Database seeding completed successfully!`);
    console.log(`Inserted ${productsToInsert.length} products`);
    console.log(`- Agricultural products (Farmer Juan): ${productsToInsert.filter(p => p.category_id === 1).length}`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

// Run the seed function
seedDatabase();