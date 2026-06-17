// Test the product query directly
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testQuery() {
  try {
    console.log('Testing product query for ID 23...\n');
    
    const NON_EXPIRED_PRODUCT_SQL = `(p.expiry_date IS NULL OR p.expiry_date > CURRENT_DATE)`;
    
    const availabilityFilter = `p.is_available = true
      AND COALESCE(p.is_admin_disabled, false) = false
      AND COALESCE(u.is_disabled, false) = false
      AND ${NON_EXPIRED_PRODUCT_SQL}`;

    const id = 23;
    const userId = 20; // Theressa Shop ID
    
    let whereClause = 'WHERE p.id = $1';
    const params = [id];
    
    // Simulate farmer role
    whereClause += ` AND (p.farmer_id = $2 OR (${availabilityFilter}))`;
    params.push(userId);

    const result = await pool.query(`
      SELECT p.*, c.name as category_name, COALESCE(u.shop_name, u.full_name) as farmer_name,
             COALESCE(p.location, u.address) as farm_location,
             COALESCE(u.is_verified, false) as farmer_verified,
             COALESCE(u.average_rating, 0) as farmer_average_rating,
             COALESCE(u.total_reviews, 0) as farmer_total_reviews,
             (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as average_rating,
            (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) as total_reviews,
            p.cloudinary_public_id as cloudinary_public_id,
             EXISTS (SELECT 1 FROM wishlist w WHERE w.user_id = $3 AND w.product_id = p.id) as is_in_wishlist
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      ${whereClause}
    `, [...params, userId]);

    if (result.rows.length === 0) {
      console.log('Query returned no results (product not found or not accessible)');
    } else {
      console.log('Query successful!');
      console.log(`Found ${result.rows.length} product(s)`);
    }
    
  } catch (error) {
    console.error('Query error:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testQuery();
