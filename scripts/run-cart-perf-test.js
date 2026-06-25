const { execSync, spawn } = require('child_process');
const path = require('path');
const http = require('http');

const cwd = path.join(__dirname, '..');
const playwrightBin = path.join(cwd, 'node_modules', '.bin', 'playwright.cmd');
const testFile = 'cart-quantity-perf.spec.js';
const serverPort = process.env.PORT || 8888;

function waitForServer(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Server did not start in time'));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

async function main() {
  const serverPath = path.join(cwd, 'scripts', 'serve-frontend.js');
  const server = spawn('node', [serverPath], {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, PORT: String(serverPort) }
  });

  try {
    await waitForServer(`http://localhost:${serverPort}/`);
    console.log(`Server ready at http://localhost:${serverPort}/`);

    const cmd = `"${playwrightBin}" test "${testFile}"`;
    console.log('Running:', cmd);
    console.log('CWD:', cwd);

    execSync(cmd, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
  } catch (e) {
    console.error('Test failed with exit code:', e.status || e.message);
    server.kill();
    process.exit(e.status || 1);
  } finally {
    server.kill();
  }
}

main();
