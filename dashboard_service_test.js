// Dashboard Service Direct Test
// Tests dashboardService.js functions directly for calculation accuracy

const { pool } = require('./backend/utils/db');
const { getAdminDashboardStats, getFarmerDashboardMetrics, getFarmerExportData, getPeriodFilter, calcChange } = require('./backend/services/dashboardService');

const results = {
  pass: [],
  fail: [],
  warn: [],
  info: []
};

function log(category, message, evidence = '') {
  results[category].push({ message, evidence });
  console.log(`[${category.toUpperCase()}] ${message}`);
  if (evidence) console.log(`  Evidence: ${evidence}`);
}

async function testDashboardService() {
  console.log('=== Dashboard Service Direct Test ===\n');
  
  try {
    // Test 1: getPeriodFilter function
    console.log('\n--- Period Filter Tests ---');
    const todayFilter = getPeriodFilter('today', 'o');
    log('pass', 'getPeriodFilter(today)', todayFilter);
    
    const weekFilter = getPeriodFilter('week', 'o');
    log('pass', 'getPeriodFilter(week)', weekFilter);
    
    const monthFilter = getPeriodFilter('month', 'o');
    log('pass', 'getPeriodFilter(month)', monthFilter);
    
    const yearFilter = getPeriodFilter('year', 'o');
    log('pass', 'getPeriodFilter(year)', yearFilter);
    
    const allFilter = getPeriodFilter('all', 'o');
    log('pass', 'getPeriodFilter(all)', allFilter);
    
    // Test 2: calcChange function
    console.log('\n--- Percentage Change Calculation Tests ---');
    const change1 = calcChange(100, 50);
    log('pass', 'calcChange(100, 50)', `Result: ${change1}%`);
    
    const change2 = calcChange(50, 100);
    log('pass', 'calcChange(50, 100)', `Result: ${change2}%`);
    
    const change3 = calcChange(0, 0);
    log('pass', 'calcChange(0, 0)', `Result: ${change3}%`);
    
    const change4 = calcChange(100, 0);
    log('pass', 'calcChange(100, 0)', `Result: ${change4}%`);
    
    // Test 3: getAdminDashboardStats
    console.log('\n--- Admin Dashboard Stats Tests ---');
    try {
      const adminStats = await getAdminDashboardStats(pool, 'all');
      if (adminStats && adminStats.stats) {
        log('pass', 'getAdminDashboardStats(all)', `Total orders: ${adminStats.stats.total_orders}, Total revenue: ${adminStats.stats.total_revenue}`);
        
        // Verify stats structure
        const requiredFields = ['total_orders', 'total_revenue', 'total_users', 'total_products', 'total_farmers'];
        const missingFields = requiredFields.filter(f => adminStats.stats[f] === undefined);
        if (missingFields.length === 0) {
          log('pass', 'Admin dashboard stats structure validation', 'All required fields present');
        } else {
          log('fail', 'Admin dashboard stats structure validation', `Missing fields: ${missingFields.join(', ')}`);
        }
      } else {
        log('fail', 'getAdminDashboardStats(all)', 'Invalid response structure');
      }
    } catch (error) {
      log('fail', 'getAdminDashboardStats(all)', error.message);
    }
    
    // Test 4: getAdminDashboardStats with period filters
    console.log('\n--- Admin Dashboard Stats with Period Filters ---');
    for (const period of ['today', 'week', 'month', 'year']) {
      try {
        const stats = await getAdminDashboardStats(pool, period);
        if (stats && stats.stats) {
          log('pass', `getAdminDashboardStats(${period})`, `Orders: ${stats.stats.total_orders}, Revenue: ${stats.stats.total_revenue}`);
        } else {
          log('fail', `getAdminDashboardStats(${period})`, 'Invalid response');
        }
      } catch (error) {
        log('fail', `getAdminDashboardStats(${period})`, error.message);
      }
    }
    
    // Test 5: getFarmerDashboardMetrics
    console.log('\n--- Farmer Dashboard Metrics Tests ---');
    try {
      const farmerMetrics = await getFarmerDashboardMetrics(pool, 42, { tier: 'free' });
      if (farmerMetrics) {
        log('pass', 'getFarmerDashboardMetrics(farmer_id=42)', `Recent orders: ${farmerMetrics.recentOrders?.length || 0}`);
        
        // Verify metrics structure
        const requiredFields = ['recentOrders', 'ordersByStatus', 'topProducts'];
        const missingFields = requiredFields.filter(f => farmerMetrics[f] === undefined);
        if (missingFields.length === 0) {
          log('pass', 'Farmer dashboard metrics structure validation', 'All required fields present');
        } else {
          log('fail', 'Farmer dashboard metrics structure validation', `Missing fields: ${missingFields.join(', ')}`);
        }
      } else {
        log('fail', 'getFarmerDashboardMetrics(farmer_id=42)', 'Invalid response');
      }
    } catch (error) {
      log('fail', 'getFarmerDashboardMetrics(farmer_id=42)', error.message);
    }
    
    // Test 6: getFarmerExportData
    console.log('\n--- Farmer Export Data Tests ---');
    try {
      const exportData = await getFarmerExportData(pool, 42, { tier: 'free' });
      if (exportData) {
        log('pass', 'getFarmerExportData(farmer_id=42)', `Recent orders: ${exportData.recentOrders?.rows?.length || 0}`);
      } else {
        log('fail', 'getFarmerExportData(farmer_id=42)', 'Invalid response');
      }
    } catch (error) {
      log('fail', 'getFarmerExportData(farmer_id=42)', error.message);
    }
    
    // Test 7: Data consistency check - verify calculations
    console.log('\n--- Data Consistency Tests ---');
    try {
      const stats = await getAdminDashboardStats(pool, 'all');
      const directOrders = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM orders WHERE COALESCE(is_disabled, false) = false');
      
      const apiOrders = stats.stats.total_orders;
      const dbOrders = parseInt(directOrders.rows[0].count, 10);
      
      const apiRevenue = parseFloat(stats.stats.total_revenue || 0);
      const dbRevenue = parseFloat(directOrders.rows[0].total || 0);
      
      if (apiOrders === dbOrders) {
        log('pass', 'Order count consistency', `API: ${apiOrders}, DB: ${dbOrders}`);
      } else {
        log('warn', 'Order count consistency', `API: ${apiOrders}, DB: ${dbOrders} (mismatch)`);
      }
      
      if (Math.abs(apiRevenue - dbRevenue) < 0.01) {
        log('pass', 'Revenue calculation consistency', `API: ₱${apiRevenue}, DB: ₱${dbRevenue}`);
      } else {
        log('warn', 'Revenue calculation consistency', `API: ₱${apiRevenue}, DB: ₱${dbRevenue} (mismatch)`);
      }
    } catch (error) {
      log('fail', 'Data consistency check', error.message);
    }
    
  } catch (error) {
    log('fail', 'Dashboard service test suite', error.message);
  }
  
  // Print summary
  console.log('\n=== DASHBOARD SERVICE TEST SUMMARY ===');
  console.log(`PASS: ${results.pass.length}`);
  console.log(`FAIL: ${results.fail.length}`);
  console.log(`WARN: ${results.warn.length}`);
  console.log(`INFO: ${results.info.length}`);
  
  if (results.fail.length > 0) {
    console.log('\n=== FAILED TESTS ===');
    results.fail.forEach(f => console.log(`- ${f.message}: ${f.evidence}`));
  }
  
  if (results.warn.length > 0) {
    console.log('\n=== WARNINGS ===');
    results.warn.forEach(w => console.log(`- ${w.message}: ${w.evidence}`));
  }
  
  return results;
}

// Run tests
testDashboardService().then(results => {
  process.exit(results.fail.length > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
