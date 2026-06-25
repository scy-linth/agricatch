const { pool } = require('../utils/db');

async function checkDeliveryAddressSetting() {
  try {
    console.log('Checking use_default_delivery_address setting in database...\n');
    
    const result = await pool.query(
      'SELECT key, value, updated_at FROM platform_settings WHERE key = $1',
      ['use_default_delivery_address']
    );
    
    if (result.rows.length > 0) {
      const setting = result.rows[0];
      console.log('Setting found:');
      console.log(`  key: ${setting.key}`);
      console.log(`  value: ${setting.value}`);
      console.log(`  updated_at: ${setting.updated_at}`);
      console.log(`\nCurrent state: ${setting.value === 'true' ? 'ENABLED (Trabajo Market default)' : 'DISABLED (Custom addresses allowed)'}`);
    } else {
      console.log('Setting NOT found in platform_settings table');
      console.log('Checking settings table...');
      
      const result2 = await pool.query(
        'SELECT key, value FROM settings WHERE key = $1',
        ['use_default_delivery_address']
      );
      
      if (result2.rows.length > 0) {
        const setting = result2.rows[0];
        console.log('Setting found in settings table:');
        console.log(`  key: ${setting.key}`);
        console.log(`  value: ${setting.value}`);
        console.log(`\nCurrent state: ${setting.value === 'true' ? 'ENABLED (Trabajo Market default)' : 'DISABLED (Custom addresses allowed)'}`);
      } else {
        console.log('Setting NOT found in settings table either');
        console.log('Default behavior: ENABLED (Trabajo Market default)');
      }
    }
  } catch (error) {
    console.error('Error checking setting:', error);
  } finally {
    await pool.end();
  }
}

checkDeliveryAddressSetting();
