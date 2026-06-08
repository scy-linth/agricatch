// Direct test of featureFlags middleware
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getFeatureFlag } = require('../middleware/featureFlags');

async function test() {
  console.log('Testing getFeatureFlag directly from middleware module...');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_NAME:', process.env.DB_NAME);
  
  try {
    const priceDrop = await getFeatureFlag('price_drop_alerts');
    console.log('price_drop_alerts:', priceDrop);
    
    const maintenance = await getFeatureFlag('maintenance_mode');
    console.log('maintenance_mode:', maintenance);
    
    const registrations = await getFeatureFlag('allow_registrations');
    console.log('allow_registrations:', registrations);
    
    const announce = await getFeatureFlag('platform_announce');
    console.log('platform_announce:', announce);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
