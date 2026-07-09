const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '../../test-downloads');

async function detailedVerification(filename) {
  const fp = path.join(DOWNLOAD_DIR, filename);
  const wb = await new ExcelJS.Workbook().xlsx.readFile(fp);
  const ws = wb.worksheets[0];
  
  const details = {
    filename,
    cells: [],
    mergedRanges: [],
    columnWidths: [],
    rowHeights: [],
    fonts: [],
    fills: [],
    borders: [],
    alignments: []
  };

  // Sample key cells for formatting verification
  const keyCells = [
    'A1', 'B1', 'A3', 'A5', 'A9', 'A15', 'A17', 'A25', 'A28', 'A31'
  ];

  for (const cellRef of keyCells) {
    try {
      const cell = ws.getCell(cellRef);
      details.cells.push({
        ref: cellRef,
        value: cell.value,
        font: cell.font ? { bold: cell.font.bold, size: cell.font.size, color: cell.font.color?.argb } : null,
        fill: cell.fill ? { type: cell.fill.type, fgColor: cell.fill.fgColor?.argb } : null,
        alignment: cell.alignment ? { horizontal: cell.alignment.horizontal, vertical: cell.alignment.vertical } : null,
        border: cell.border
      });
    } catch (e) {
      // Cell may not exist
    }
  }

  // Get merged ranges
  details.mergedRanges = ws._merges || [];

  // Get column widths
  for (let col = 1; col <= 6; col++) {
    details.columnWidths.push({ col: col, width: ws.getColumn(col).width });
  }

  // Get row heights for first 30 rows
  for (let row = 1; row <= 30; row++) {
    details.rowHeights.push({ row: row, height: ws.getRow(row).height });
  }

  return details;
}

async function main() {
  console.log('=== DETAILED FORMATTING VERIFICATION ===\n');
  
  const files = ['Admin_Dashboard_Report_all.xlsx', 'Farmer_Dashboard_Report_7days.xlsx'];
  
  for (const file of files) {
    try {
      const details = await detailedVerification(file);
      
      console.log(`\n═══════════════════════════════════════════════════════════════`);
      console.log(`FILE: ${details.filename}`);
      console.log(`═══════════════════════════════════════════════════════════════`);
      
      console.log('\nKEY CELLS FORMATTING:');
      details.cells.forEach(cell => {
        console.log(`\n  ${cell.ref}: "${cell.value}"`);
        if (cell.font) console.log(`    Font: bold=${cell.font.bold}, size=${cell.font.size}`);
        if (cell.fill) console.log(`    Fill: ${cell.fill.type}, color=${cell.fill.fgColor}`);
        if (cell.alignment) console.log(`    Align: ${cell.alignment.horizontal}, ${cell.alignment.vertical}`);
      });
      
      console.log('\nCOLUMN WIDTHS:');
      details.columnWidths.forEach(col => {
        console.log(`  Col ${col.col}: ${col.width?.toFixed(1) || 'auto'}`);
      });
      
      console.log('\nROW HEIGHTS (first 15):');
      details.rowHeights.slice(0, 15).forEach(row => {
        console.log(`  Row ${row.row}: ${row.height || 'default'}`);
      });
      
      console.log(`\nMERGED RANGES: ${details.mergedRanges.length}`);
      if (details.mergedRanges.length > 0) {
        details.mergedRanges.slice(0, 5).forEach(range => {
          console.log(`  ${range.model}`);
        });
      }
      
    } catch (e) {
      console.log(`\nError processing ${file}: ${e.message}`);
    }
  }
}

main().catch(console.error);
