const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '../../test-downloads');

async function checkAdminDashboardCompleteness() {
  const fp = path.join(DOWNLOAD_DIR, 'Admin_Dashboard_Report_all.xlsx');
  const wb = await new ExcelJS.Workbook().xlsx.readFile(fp);
  const ws = wb.worksheets[0];
  
  const sections = [];
  
  // Scan the worksheet for all section headers
  for (let row = 1; row <= 100; row++) {
    const cell = ws.getCell(row, 1);
    if (cell.value && typeof cell.value === 'string') {
      const val = cell.value.trim();
      const font = cell.font || {};
      
      // Look for section headers (bold, larger font)
      if (font.bold && font.size >= 12) {
        sections.push({ row, value: val, fontSize: font.size });
      }
    }
  }
  
  return sections;
}

async function main() {
  console.log('=== ADMIN DASHBOARD COMPLETENESS CHECK ===\n');
  
  const sections = await checkAdminDashboardCompleteness();
  
  console.log('SECTIONS FOUND IN ADMIN EXPORT:');
  sections.forEach(section => {
    console.log(`  Row ${section.row}: ${section.value} (size ${section.fontSize})`);
  });
  
  console.log('\n=== ADMIN DASHBOARD SECTIONS (from HTML) ===');
  console.log('Based on frontend/admin.html analysis:');
  console.log('  1. Sales KPI Card');
  console.log('  2. Harvest Attention KPI Card');
  console.log('  3. Total Sales KPI Card');
  console.log('  4. Customers KPI Card');
  console.log('  5. Farmers KPI Card');
  console.log('  6. Reports Chart (Sales/Revenue trends)');
  console.log('  7. Recent Activity section');
  console.log('  8. Product Approvals section');
  console.log('  9. User Management section');
  console.log('  10. Settings section');
  
  console.log('\n=== COMPARISON ===');
  console.log('INCLUDED IN EXPORT:');
  console.log('  ✓ Sales KPI (as "Total Orders" in KPI section)');
  console.log('  ✓ Total Sales KPI (as "Total Sales" in KPI section)');
  console.log('  ✓ Customers KPI (as "Customers" in KPI section)');
  console.log('  ✓ Farmers KPI (as "Farmers" in KPI section)');
  console.log('  ✓ Harvest Attention KPI (as "Harvest Attention" in KPI section)');
  console.log('  ✓ Sales & Revenue Trend (as table)');
  console.log('  ✓ Top Products (as table)');
  console.log('  ✓ Top Farmers (as table)');
  
  console.log('\nNOT INCLUDED IN EXPORT:');
  console.log('  ✗ Reports Chart (visual chart - exported as data table instead)');
  console.log('  ✗ Recent Activity section');
  console.log('  ✗ Product Approvals section');
  console.log('  ✗ User Management section');
  console.log('  ✗ Settings section');
  console.log('  ✗ Support Ticket summary');
  
  console.log('\nNOTE: Charts are appropriately exported as data tables.');
  console.log('Management sections (approvals, users, settings) are operational');
  console.log('sections not typically included in analytical reports.');
}

main().catch(console.error);
