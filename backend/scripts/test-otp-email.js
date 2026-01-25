/**
 * Quick OTP test for specific email
 * Run: node scripts/test-otp-email.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = 'http://localhost:3000/api';
const TEST_EMAIL = 'scylinthgaming@gmail.com';

async function testOtp() {
  console.log('\n=== Testing OTP Send ===\n');
  console.log(`Sending OTP to: ${TEST_EMAIL}`);
  console.log('Purpose: reset_password\n');

  try {
    const response = await fetch(`${API_BASE}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: TEST_EMAIL, 
        purpose: 'reset_password' 
      }),
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response body:', text.substring(0, 500));
    
    try {
      const data = JSON.parse(text);
      
      if (response.ok) {
        console.log('\n✅ SUCCESS!');
        console.log('Message:', data.message);
        console.log('Expires in:', data.expiresIn, 'seconds (10 minutes)');
        console.log('\n📧 Please check your email inbox for the OTP code.');
      } else {
        console.log('\n❌ FAILED');
        console.log('Error:', data.message);
        if (data.error) {
          console.log('Details:', data.error);
        }
      }
    } catch (e) {
      console.log('\n❌ Response is not JSON');
      console.log('Full response:', text);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('Make sure the server is running on port 3000');
  }
}

testOtp();
