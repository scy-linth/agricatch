const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8888;
const root = path.join(__dirname, '..');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
  const cleanUrl = req.url.split('?')[0];
  let relativePath = cleanUrl === '/' ? 'frontend/index.html' : cleanUrl;
  let filePath = path.join(root, relativePath);

  // Try frontend/ directory for static assets
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const frontendPath = path.join(root, 'frontend', relativePath);
    if (fs.existsSync(frontendPath) && !fs.statSync(frontendPath).isDirectory()) {
      filePath = frontendPath;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    });
    res.end(content);
  });
});

server.listen(port, () => {
  console.log(`Frontend static server running at http://localhost:${port}/`);
});
