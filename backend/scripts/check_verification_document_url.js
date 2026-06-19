const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    console.log('=== Checking verification_requests table structure ===\n');
    
    // Check if document_url column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'verification_requests' 
      AND column_name = 'document_url'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✓ document_url column exists:');
      console.log('  Type:', columnCheck.rows[0].data_type);
      console.log('  Nullable:', columnCheck.rows[0].is_nullable);
    } else {
      console.log('✗ document_url column NOT found');
    }
    
    // Check if index exists
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'verification_requests' 
      AND indexname = 'idx_verification_requests_document_url'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('\n✓ Index idx_verification_requests_document_url exists');
    } else {
      console.log('\n✗ Index idx_verification_requests_document_url NOT found');
    }
    
    // Check existing verification requests
    const requestsCheck = await pool.query(`
      SELECT id, farmer_id, document_url, notes, status, created_at 
      FROM verification_requests 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n=== Recent verification requests ===');
    if (requestsCheck.rows.length > 0) {
      requestsCheck.rows.forEach(row => {
        console.log(`ID: ${row.id}, Farmer: ${row.farmer_id}, Status: ${row.status}, Has Document: ${row.document_url ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No verification requests found');
    }
    
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
