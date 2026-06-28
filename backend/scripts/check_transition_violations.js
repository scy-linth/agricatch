require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkTransitionViolations() {
  console.log('=== TRANSITION VIOLATIONS CHECK ===\n');

  try {
    // Check 1: Products with invalid status transitions (should follow: pending -> approved/rejected)
    const invalidProductStatus = await pool.query(`
      SELECT p.id, p.name, p.status, p.is_available, p.is_admin_disabled
      FROM products p
      WHERE p.status NOT IN ('pending', 'approved', 'rejected')
    `);
    console.log(`1. Products with invalid status: ${invalidProductStatus.rows.length}`);
    if (invalidProductStatus.rows.length > 0) {
      invalidProductStatus.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): status=${p.status}, available=${p.is_available}, disabled=${p.is_admin_disabled}`);
      });
    }

    // Check 2: Products that are approved but not available (may be intentional)
    const approvedNotAvailable = await pool.query(`
      SELECT id, name, status, is_available
      FROM products
      WHERE status = 'approved' AND is_available = false
    `);
    console.log(`2. Approved products not available: ${approvedNotAvailable.rows.length}`);
    if (approvedNotAvailable.rows.length > 0) {
      approvedNotAvailable.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): approved but not available`);
      });
    }

    // Check 3: Products that are available but pending (should be approved first)
    const availablePending = await pool.query(`
      SELECT id, name, status, is_available
      FROM products
      WHERE status = 'pending' AND is_available = true
    `);
    console.log(`3. Pending products that are available: ${availablePending.rows.length}`);
    if (availablePending.rows.length > 0) {
      availablePending.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): pending but available`);
      });
    }

    // Check 4: Orders with invalid status
    const invalidOrderStatus = await pool.query(`
      SELECT id, user_id, product_id, status
      FROM orders
      WHERE status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'pre-order reserved')
    `);
    console.log(`4. Orders with invalid status: ${invalidOrderStatus.rows.length}`);
    if (invalidOrderStatus.rows.length > 0) {
      invalidOrderStatus.rows.forEach(o => {
        console.log(`   - Order ${o.id} for user ${o.user_id}: status=${o.status}`);
      });
    }

    // Check 5: Users with invalid role
    const invalidUserRole = await pool.query(`
      SELECT id, username, role
      FROM users
      WHERE role NOT IN ('customer', 'farmer', 'admin', 'staff', 'super_admin')
    `);
    console.log(`5. Users with invalid role: ${invalidUserRole.rows.length}`);
    if (invalidUserRole.rows.length > 0) {
      invalidUserRole.rows.forEach(u => {
        console.log(`   - User ${u.id} (${u.username}): role=${u.role}`);
      });
    }

    // Check 6: Farmers with invalid verification status (skip if farmers table doesn't exist)
    let invalidFarmerStatus = { rows: [] };
    try {
      invalidFarmerStatus = await pool.query(`
        SELECT u.id, u.username, u.role, f.verification_status
        FROM users u
        LEFT JOIN farmers f ON f.user_id = u.id
        WHERE u.role = 'farmer' AND f.verification_status NOT IN ('pending', 'verified', 'rejected')
      `);
      console.log(`6. Farmers with invalid verification status: ${invalidFarmerStatus.rows.length}`);
      if (invalidFarmerStatus.rows.length > 0) {
        invalidFarmerStatus.rows.forEach(f => {
          console.log(`   - Farmer ${f.id} (${f.username}): verification_status=${f.verification_status}`);
        });
      }
    } catch (e) {
      console.log(`6. Farmers with invalid verification status: skipped (farmers table not found)`);
    }

    const totalIssues = invalidProductStatus.rows.length + approvedNotAvailable.rows.length + 
                       availablePending.rows.length + invalidOrderStatus.rows.length + 
                       invalidUserRole.rows.length + invalidFarmerStatus.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total transition violation issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No transition violations detected');
    } else {
      console.log('✗ Transition violations detected - review above issues');
    }

  } catch (error) {
    console.error('Error checking transition violations:', error);
  } finally {
    await pool.end();
  }
}

checkTransitionViolations();
