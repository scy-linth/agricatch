const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function verifyExcelFile(filePath, fileName) {
  console.log(`\n=== Verifying ${fileName} ===`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File does not exist: ${filePath}`);
    return false;
  }
  
  const stats = fs.statSync(filePath);
  console.log(`✅ File exists: ${filePath}`);
  console.log(`   Size: ${stats.size} bytes`);
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    console.log(`✅ File is valid Excel format`);
    console.log(`   Number of worksheets: ${workbook.worksheets.length}`);
    
    workbook.eachSheet((worksheet, sheetId) => {
      console.log(`\n   Worksheet ${sheetId}: ${worksheet.name}`);
      console.log(`   Row count: ${worksheet.rowCount}`);
      console.log(`   Column count: ${worksheet.columnCount}`);
      
      // Show first few rows
      console.log(`   First 5 rows:`);
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 5) {
          const values = row.values.map(v => v || '');
          console.log(`     Row ${rowNumber}: ${values.join(' | ')}`);
        }
      });
    });
    
    return true;
  } catch (error) {
    console.log(`❌ Error reading Excel file: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('=== EXCEL FILE VERIFICATION ===\n');
  
  const ordersFile = path.join(__dirname, '..', 'test_orders_export.xlsx');
  const dashboardFile = path.join(__dirname, '..', 'test_dashboard_export.xlsx');
  
  const ordersValid = await verifyExcelFile(ordersFile, 'Orders Export');
  const dashboardValid = await verifyExcelFile(dashboardFile, 'Dashboard Export');
  
  console.log('\n=== SUMMARY ===');
  console.log(`Orders Export: ${ordersValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Dashboard Export: ${dashboardValid ? '✅ VALID' : '❌ INVALID'}`);
  
  if (ordersValid && dashboardValid) {
    console.log('\n✅ All Excel files are valid and properly formatted');
  } else {
    console.log('\n❌ Some Excel files have issues');
  }
}

main().catch(console.error);
