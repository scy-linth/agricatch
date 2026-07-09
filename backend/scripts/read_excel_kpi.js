const ExcelJS = require('exceljs');
const path = require('path');

async function readExcelKPIs(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.worksheets[0];
  const data = [];
  
  worksheet.eachRow((row, rowNumber) => {
    const rowData = [];
    row.eachCell((cell) => {
      rowData.push(cell.value);
    });
    data.push(rowData);
  });
  
  console.log(JSON.stringify(data, null, 2));
}

readExcelKPIs(path.join(__dirname, '../../test-downloads/Farmer_Dashboard_Report_All_Time.xlsx'));
