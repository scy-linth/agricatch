const { Resend } = require('resend');
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const API_KEY = 're_CnA9BwoR_3t1gADnP4TR13p4CZDk8L7UP';

async function testKey() {
  const resend = new Resend(API_KEY);
  
  try {
    // Try to send to a different email (not agricatchph@gmail.com)
    const { data, error } = await resend.emails.send({
      from: 'AgriCatch <onboarding@resend.dev>',
      to: ['test@example.com'],
      subject: 'Test',
      html: '<p>Test</p>',
    });

    if (error) {
      if (error.message && error.message.includes('testing emails')) {
        console.log('demo');
        process.exit(0);
      }
      console.log('demo');
      process.exit(0);
    }
    
    console.log('production');
    process.exit(0);
  } catch (err) {
    if (err.message && err.message.includes('testing emails')) {
      console.log('demo');
    } else {
      console.log('demo');
    }
    process.exit(0);
  }
}

testKey();
