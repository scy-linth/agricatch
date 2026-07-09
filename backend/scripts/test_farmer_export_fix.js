const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.cxqyqffnrmfowwaefbff:etitsmwa123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
});

// Import dashboard service
const { getFarmerDashboardMetrics } = require('../services/dashboardService');

async function testFarmerExport() {
  try {
    console.log('Testing Farmer Dashboard Export Fix...\n');

    // Test farmer ID (dhelhilis@gmail.com)
    const farmerId = 20;

    // Test different timeframes
    const timeframes = [
      { name: 'Today', rangeDays: '1' },
      { name: 'Week', rangeDays: '7' },
      { name: 'Month', rangeDays: '30' },
      { name: 'Year', rangeDays: '365' },
      { name: 'All Time', rangeDays: null }
    ];

    for (const tf of timeframes) {
      console.log(`\n=== Testing ${tf.name} ===`);

      // Get dashboard data
      const dashboardData = await getFarmerDashboardMetrics(pool, farmerId, {
        rangeDays: tf.rangeDays,
        tier: 'premium'
      });

      // Calculate summary using NEW logic (aggregated data)
      const summaryNew = {
        total_orders: Object.values(dashboardData.ordersByStatus).reduce((sum, count) => sum + Number(count || 0), 0),
        total_sold: dashboardData.itemsSoldByDay.reduce((sum, day) => sum + Number(day.items_sold || 0), 0),
        total_revenue: dashboardData.revenueByDay.reduce((sum, day) => sum + Number(day.revenue || 0), 0)
      };

      // Calculate summary using OLD logic (limited recentOrders)
      const summaryOld = {
        total_orders: 0,
        total_sold: 0,
        total_revenue: 0
      };
      for (const order of dashboardData.recentOrders) {
        summaryOld.total_orders++;
        if (order.status === 'delivered') {
          summaryOld.total_sold += order.quantity;
          summaryOld.total_revenue += order.total_amount;
        }
      }

      console.log(`Dashboard KPIs (from aggregated data):`);
      console.log(`  Total Orders: ${summaryNew.total_orders}`);
      console.log(`  Items Sold: ${summaryNew.total_sold}`);
      console.log(`  Total Sales: ₱${summaryNew.total_revenue.toFixed(2)}`);

      console.log(`\nOLD Export Logic (from recentOrders - limited to 8):`);
      console.log(`  Total Orders: ${summaryOld.total_orders}`);
      console.log(`  Items Sold: ${summaryOld.total_sold}`);
      console.log(`  Total Sales: ₱${summaryOld.total_revenue.toFixed(2)}`);

      console.log(`\nDifference:`);
      console.log(`  Total Orders: ${summaryNew.total_orders - summaryOld.total_orders}`);
      console.log(`  Items Sold: ${summaryNew.total_sold - summaryOld.total_sold}`);
      console.log(`  Total Sales: ₱${(summaryNew.total_revenue - summaryOld.total_revenue).toFixed(2)}`);

      if (summaryNew.total_orders !== summaryOld.total_orders ||
          summaryNew.total_sold !== summaryOld.total_sold ||
          summaryNew.total_revenue !== summaryOld.total_revenue) {
        console.log(`\n❌ MISMATCH DETECTED - Fix is needed`);
      } else {
        console.log(`\n✅ MATCH - Data is consistent`);
      }
    }

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pool.end();
  }
}

testFarmerExport();
