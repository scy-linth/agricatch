const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'agricatch',
  password: 'password',
  port: 5432
});

async function testDatabase() {
  try {
    console.log('Testing database connection...\n');

    const [usersResult, productsResult, categoriesResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM products'),
      pool.query('SELECT COUNT(*) as count FROM categories')
    ]);

    console.log('Database Status:');
    console.log('Users:', usersResult.rows[0].count);
    console.log('Products:', productsResult.rows[0].count);
    console.log('Categories:', categoriesResult.rows[0].count);

    // Test login
    console.log('\nTesting login...');
    const loginResult = await pool.query('SELECT id, email, role FROM users WHERE email = $1', ['juan@farm.ph']);
    console.log('Farmer account found:', loginResult.rows.length > 0 ? 'YES' : 'NO');

    await pool.end();
    console.log('\nAll tests passed! Database is ready.');

  } catch (err) {
    console.error('Database Error:', err.message);
    await pool.end();
  }
}

testDatabase();