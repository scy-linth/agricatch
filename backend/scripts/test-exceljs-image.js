const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Dashboard Report');

  const logoPath = path.join(__dirname, '..', '..', 'frontend', 'images', 'resendlogo.png');
  console.log('Logo path:', logoPath);
  console.log('Logo exists:', fs.existsSync(logoPath));

  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    console.log('Logo buffer size:', logoBuffer.length);

    const logoId = wb.addImage({
      buffer: logoBuffer,
      extension: 'png'
    });
    console.log('Logo ID returned:', logoId);
    console.log('Logo ID type:', typeof logoId);

    ws.addRow(['AgriCatch Admin Dashboard Report']);
    ws.addRow([]);
    ws.addRow(['Generated At:', new Date().toLocaleString()]);
    ws.addRow(['Period Filter:', 'Month']);

    // Try different addImage approaches
    console.log('Worksheet addImage method:', typeof ws.addImage);

    const result = ws.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 150, height: 50 }
    });
    console.log('addImage result:', result);
    console.log('Images after addImage:', ws.getImages());

    const testPath = path.join(__dirname, '..', '..', 'test-downloads', 'test-exceljs-image.xlsx');
    await wb.xlsx.writeFile(testPath);
    console.log('Test file saved to:', testPath);

    // Read it back
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(testPath);
    const ws2 = wb2.worksheets[0];
    console.log('Images in read-back worksheet:', ws2.getImages());
    console.log('Workbook media count:', wb2.model.media.length);
  }
}

main().catch(console.error);
