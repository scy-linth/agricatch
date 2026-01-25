const { Resend } = require('resend');
require('dotenv').config();

const API_KEY = process.env.RESEND_API_KEY || 're_CnA9BwoR_3t1gADnP4TR13p4CZDk8L7UP';
const TEST_EMAIL = 'agricatchph@gmail.com';

async function testKeyType() {
  console.log('🔍 Testing Resend API Key...');
  console.log(`API Key: ${API_KEY.substring(0, 10)}...${API_KEY.slice(-4)}`);
  console.log(`Test Email: ${TEST_EMAIL}\n`);

  if (!API_KEY) {
    console.log('❌ No RESEND_API_KEY found');
    process.exit(1);
  }

  const resend = new Resend(API_KEY);
  
  try {
    console.log('📧 Attempting to send test email...');
    const { data, error } = await resend.emails.send({
      from: 'AgriCatch <onboarding@resend.dev>',
      to: [TEST_EMAIL],
      subject: 'Resend API Key Test',
      html: '<p>This is a test email to determine if your Resend API key is production or test.</p>',
      text: 'This is a test email to determine if your Resend API key is production or test.',
    });

    if (error) {
      console.error('❌ Error received:', JSON.stringify(error, null, 2));
      
      const errorMessage = error.message || error.name || JSON.stringify(error);
      
      if (errorMessage.includes('testing emails') || 
          errorMessage.includes('test mode') ||
          errorMessage.includes('You can only send testing emails')) {
        console.log('\n📊 RESULT: TEST KEY');
        console.log('⚠️  This is a TEST/DEMO key that only allows sending to your own email address.');
        console.log('💡 To send to any email, you need a PRODUCTION key.');
      } else {
        console.log('\n📊 RESULT: UNKNOWN (Error occurred but not a test key restriction)');
        console.log('Error details:', errorMessage);
      }
      process.exit(1);
    }
    
    console.log('✅ Email sent successfully!');
    console.log('Email ID:', data.id);
    console.log('\n📊 RESULT: PRODUCTION KEY');
    console.log('✅ This is a PRODUCTION key - you can send to any email address!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Exception occurred:', err.message);
    
    if (err.message && err.message.includes('testing emails')) {
      console.log('\n📊 RESULT: TEST KEY');
      console.log('⚠️  This is a TEST/DEMO key.');
    } else {
      console.log('\n📊 RESULT: ERROR');
      console.log('Error:', err.message);
    }
    process.exit(1);
  }
}

testKeyType();
