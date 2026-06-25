const { chromium } = require('playwright');
const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { extname } = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

(async () => {
  const frontendPath = __dirname + '/frontend';
  
  const server = createServer((req, res) => {
    let filePath = frontendPath + req.url;
    if (req.url === '/') filePath = frontendPath + '/index.html';
    
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'text/html';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
  });
  
  server.listen(8080);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:8080/index.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  await page.screenshot({ 
    path: 'landing-page-screenshot.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved to landing-page-screenshot.png');
  
  await browser.close();
  server.close();
})();
