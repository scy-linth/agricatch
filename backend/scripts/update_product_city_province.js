require('dotenv').config();
const { pool } = require('../utils/db');

async function updateProductCityProvince() {
  try {
    console.log('Fetching products with location but no city/province...');
    
    const result = await pool.query(`
      SELECT id, location 
      FROM products 
      WHERE location IS NOT NULL 
        AND location != '' 
        AND (city IS NULL OR city = '')
        AND (province IS NULL OR province = '')
    `);
    
    console.log(`Found ${result.rows.length} products to update`);
    
    if (result.rows.length === 0) {
      console.log('No products need updating');
      return;
    }
    
    let updated = 0;
    
    for (const product of result.rows) {
      const location = product.location;
      let city = null;
      let province = null;
      
      // Parse location to extract city and province
      // Expected format: "street, barangay, city, province" or "city, province" or just "province"
      const parts = location.split(',').map(p => p.trim());
      
      if (parts.length >= 2) {
        // Try to get the last two parts as city and province
        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts[parts.length - 2];
        
        // Check if the last part looks like a province (contains "Metro" or is a known province)
        if (lastPart.includes('Metro') || lastPart.includes('Province') || parts.length === 2) {
          province = lastPart;
          city = secondLastPart;
        } else {
          // If not, assume the last two parts are city and province
          province = lastPart;
          city = secondLastPart;
        }
      } else if (parts.length === 1) {
        // Single value - could be just a province name
        const singlePart = parts[0];
        // If it's a known province pattern, set as province
        if (singlePart.length > 3 && singlePart !== 'asdasd' && singlePart !== 'Laoagaa') {
          province = singlePart;
          city = null; // City unknown
        }
      }
      
      if (province) {
        await pool.query(
          'UPDATE products SET city = $1, province = $2 WHERE id = $3',
          [city, province, product.id]
        );
        updated++;
        console.log(`Updated product ${product.id}: ${city || 'N/A'}, ${province}`);
      } else {
        console.log(`Could not parse location for product ${product.id}: "${location}"`);
      }
    }
    
    console.log(`Successfully updated ${updated} products`);
  } catch (error) {
    console.error('Error updating products:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateProductCityProvince();
