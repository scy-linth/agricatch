async function testCustomerLogin() {
  try {
    console.log('Testing customer login...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'testcustomer@test.com',
        password: 'Test123456'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✓ Login successful!');
      console.log('Response:', data);
    } else {
      console.error('❌ Login failed!');
      console.error('Status:', response.status);
      console.error('Data:', data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCustomerLogin();
