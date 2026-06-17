const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function resetFarmerPassword() {
  try {
    const newPassword = 'password123';
    const usePlaintext = process.env.ALLOW_PLAINTEXT_PASSWORDS === 'true' || 
                         (process.env.DEV_PLAINTEXT_PASSWORDS === 'true' && process.env.NODE_ENV !== 'production');

    let passwordValue;
    if (usePlaintext) {
      passwordValue = newPassword;
    } else {
      passwordValue = await bcrypt.hash(newPassword, 10);
    }

    // Update Theressa's password
    const result = await pool.query(
      `UPDATE users SET password = $1, password_hash = $1 WHERE username = $2 RETURNING id, email, username, full_name`,
      [passwordValue, 'Theressa']
    );

    if (result.rows.length === 0) {
      console.log('Farmer not found');
      return;
    }

    console.log('Password reset successfully for:');
    console.log(`  Username: ${result.rows[0].username}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Full Name: ${result.rows[0].full_name}`);
    console.log(`  New Password: ${newPassword}`);
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
}

resetFarmerPassword();
