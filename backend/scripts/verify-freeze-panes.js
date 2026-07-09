const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '../../test-downloads');

async function verifyFreezePanes(filename) {
  const fp = path.join(DOWNLOAD_DIR, filename);
  const wb = await new ExcelJS.Workbook().xlsx.readFile(fp);
  const ws = wb.worksheets[0];
  
  const freezeInfo = {
    filename,
    hasViews: !!ws.views,
    views: ws.views || []
  };
  
  if (ws.views && ws.views.length > 0) {
    freezeInfo.frozenState = ws.views[0].state;
    freezeInfo.ySplit = ws.views[0].ySplit;
    freezeInfo.xSplit = ws.views[0].xSplit;
  }
  
  return freezeInfo;
}

async function main() {
  console.log('=== FREEZE PANES VERIFICATION ===\n');
  
  const files = [
    'Admin_Dashboard_Report_all.xlsx',
    'Farmer_Dashboard_Report_7days.xlsx'
  ];
  
  for (const file of files) {
    try {
      const info = await verifyFreezePanes(file);
      
      console.log(`File: ${info.filename}`);
      console.log(`  Has Views: ${info.hasViews}`);
      console.log(`  Number of Views: ${info.views.length}`);
      
      if (info.views.length > 0) {
        console.log(`  State: ${info.frozenState}`);
        console.log(`  Y Split (freeze row): ${info.ySplit}`);
        console.log(`  X Split (freeze col): ${info.xSplit || 'none'}`);
        
        if (info.frozenState === 'frozen' && info.ySplit === 17) {
          console.log(`  ✓ CORRECT: Headers frozen at row 17`);
        } else {
          console.log(`  ✗ INCORRECT: Expected frozen state at row 17`);
        }
      } else {
        console.log(`  ✗ NO FREEZE PANES CONFIGURED`);
      }
      
      console.log();
    } catch (e) {
      console.log(`Error processing ${file}: ${e.message}\n`);
    }
  }
}

main().catch(console.error);
