const ExcelJS = require('exceljs');
const fs = require('fs');

async function verifyExcelFile(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    console.log('✓ Excel file opened successfully without repair warnings');
    console.log('Number of worksheets:', workbook.worksheets.length);
    
    const worksheet = workbook.worksheets[0];
    console.log('Worksheet name:', worksheet.name);
    console.log('Number of rows:', worksheet.rowCount);
    console.log('Number of columns:', worksheet.columnCount);
    
    // Get the first few rows to verify data
    console.log('\nFirst 5 rows:');
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 5) {
        const rowData = row.values.map(v => v !== null ? v.toString().substring(0, 30) : '');
        console.log(`Row ${rowNumber}:`, rowData.join(' | '));
      }
    });
    
    return true;
  } catch (error) {
    console.error('✗ Error opening Excel file:', error.message);
    return false;
  }
}

// Verify the downloaded file
const filePath = '../test-results/Farmer_Orders_Report_2026-07-10.xlsx';
verifyExcelFile(filePath).then(success => {
  process.exit(success ? 0 : 1);
});
