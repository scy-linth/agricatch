const jwt = require('jsonwebtoken');

// Test the dashboard stats API endpoint
async function testDashboardAPI() {
  try {
    // Create a test admin token
    const token = jwt.sign(
      { id: 38, username: 'admin', role: 'admin', full_name: null, email: 'admin@gmail.com' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Testing dashboard stats API...\n');
    console.log('Token:', token.substring(0, 50) + '...\n');

    const metrics = ['kpi-customers', 'kpi-sales', 'kpi-farmers', 'kpi-revenue', 'kpi-harvest-attention'];

    for (const metric of metrics) {
      try {
        const response = await fetch(`http://localhost:3000/api/admin/dashboard/stats?period=today&metric=${metric}&_t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const text = await response.text();
        console.log(`${metric}: ${response.status} - ${text.substring(0, 100)}`);
      } catch (e) {
        console.log(`${metric}: Error - ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDashboardAPI();
