const { Resend } = require('resend');
require('dotenv').config();

const API_KEY = process.env.RESEND_API_KEY || 're_CnA9BwoR_3t1gADnP4TR13p4CZDk8L7UP';

async function testKeyType() {
  if (!API_KEY) {
    console.log('❌ No RESEND_API_KEY found in environment');
    process.exit(1);
  }

  console.log(`Testing API key: ${API_KEY.substring(0, 10)}...`);
  const resend = new Resend(API_KEY);
  
  try {
    // Try to send to a test email (not agricatchph@gmail.com)
    const { data, error } = await resend.emails.send({
      from: 'AgriCatch <onboarding@resend.dev>',
      to: ['test@example.com'],
      subject: 'API Key Test',
      html: '<p>This is a test to determine if the key is production or demo.</p>',
    });

    if (error) {
      if (error.message && error.message.includes('testing emails')) {
        console.log('demo');
        process.exit(0);
      }
      // Other errors might also indicate test key
      console.log('demo');
      process.exit(0);
    }
    
    // If we get here, it's likely production (but email won't actually send to example.com)
    console.log('production');
    process.exit(0);
  } catch (err) {
    if (err.message && err.message.includes('testing emails')) {
      console.log('demo');
    } else {
      // Assume demo if any error
      console.log('demo');
    }
    process.exit(0);
  }
}

testKeyType();
