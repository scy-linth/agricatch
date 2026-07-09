const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '../../test-downloads');

const files = [
  'Farmer_Dashboard_Report_7days.xlsx',
  'Farmer_Dashboard_Report_30days.xlsx',
  'Farmer_Dashboard_Report_90days.xlsx',
  'Admin_Dashboard_Report_today.xlsx',
  'Admin_Dashboard_Report_week.xlsx',
  'Admin_Dashboard_Report_month.xlsx',
  'Admin_Dashboard_Report_year.xlsx',
  'Admin_Dashboard_Report_all.xlsx'
];

(async () => {
  console.log('=== Excel File Verification Report ===\n');
  
  for (const f of files) {
    const fp = path.join(DOWNLOAD_DIR, f);
    try {
      const wb = await new ExcelJS.Workbook().xlsx.readFile(fp);
      const ws = wb.worksheets[0];
      const img = ws.getImages()[0];
      const stats = fs.statSync(fp);
      
      console.log(`File: ${f}`);
      console.log(`  Size: ${stats.size} bytes`);
      console.log(`  Worksheets: ${wb.worksheets.length}`);
      console.log(`  Title cell: ${ws.getCell('A3').value}`);
      console.log(`  Logo: ${img ? 'YES' : 'NO'} ${img ? `(ext: ${img.range.ext.width}x${img.range.ext.height})` : ''}`);
      console.log(`  Row 1 height: ${ws.getRow(1).height}`);
      console.log(`  Status: VALID\n`);
    } catch (e) {
      console.log(`File: ${f}`);
      console.log(`  Status: CORRUPTED - ${e.message}\n`);
    }
  }
})();
