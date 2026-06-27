require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');

const hash = '$2a$12$m/TMEAZMlXtDk1RadnIjZudJtfT/davVxBoZuELru/Br3AlBXySCe';
const passwords = ['etitsmwa', 'etitsmwa123'];

(async function(){
  console.log('Testing which password matches the bcrypt hash:');
  console.log('Hash:', hash);
  console.log('');
  
  for (const pwd of passwords) {
    try {
      const matches = await bcrypt.compare(pwd, hash);
      console.log(`Password "${pwd}": ${matches ? 'MATCHES ✓' : 'DOES NOT MATCH ✗'}`);
    } catch (e) {
      console.log(`Password "${pwd}": ERROR - ${e.message}`);
    }
  }
})();
