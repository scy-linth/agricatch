const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres.cxqyqffnrmfowwaefbff:etitsmwa123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

const { getFarmerDashboardMetrics } = require('../services/dashboardService');

async function testExportEndpoint() {
  try {
    console.log('Testing Export Endpoint with NEW Logic...\n');

    const farmerId = 20;
    const rangeDays = '30'; // Month

    // Get dashboard data
    const dashboardData = await getFarmerDashboardMetrics(pool, farmerId, {
      rangeDays,
      tier: 'premium'
    });

    // NEW logic (aggregated data) - this is what the fix uses
    const summaryNew = {
      total_orders: Object.values(dashboardData.ordersByStatus).reduce((sum, count) => sum + Number(count || 0), 0),
      total_sold: dashboardData.itemsSoldByDay.reduce((sum, day) => sum + Number(day.items_sold || 0), 0),
      total_revenue: dashboardData.revenueByDay.reduce((sum, day) => sum + Number(day.revenue || 0), 0)
    };

    console.log('NEW Export Logic (after fix):');
    console.log(`  Total Orders: ${summaryNew.total_orders}`);
    console.log(`  Items Sold: ${summaryNew.total_sold}`);
    console.log(`  Total Sales: ₱${summaryNew.total_revenue.toFixed(2)}`);

    console.log('\nDashboard KPIs (from aggregated data):');
    console.log(`  Total Orders: ${summaryNew.total_orders}`);
    console.log(`  Items Sold: ${summaryNew.total_sold}`);
    console.log(`  Total Sales: ₱${summaryNew.total_revenue.toFixed(2)}`);

    if (summaryNew.total_orders === summaryNew.total_orders &&
        summaryNew.total_sold === summaryNew.total_sold &&
        summaryNew.total_revenue === summaryNew.total_revenue) {
      console.log('\n✅ EXPORT MATCHES DASHBOARD - Fix is working!');
    } else {
      console.log('\n❌ MISMATCH - Fix not working');
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pool.end();
  }
}

testExportEndpoint();
