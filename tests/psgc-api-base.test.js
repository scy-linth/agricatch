const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const psgcSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'psgc.js'), 'utf8');

function createSelect() {
  return {
    innerHTML: '',
    disabled: false,
    value: ''
  };
}

test('PSGC uses direct Render API on agricatch.store production host', async () => {
  const requestedUrls = [];
  const context = {
    window: {
      location: { hostname: 'www.agricatch.store' }
    },
    fetch: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({ cities: ['Manila'] })
      };
    }
  };

  vm.createContext(context);
  vm.runInContext(psgcSource, context);

  await context.window.PSGC.loadCities('Metro Manila', createSelect());

  assert.equal(requestedUrls[0], 'https://agricatch.onrender.com/api/psgc/cities?zone=metro');
});

test('PSGC keeps relative API path on localhost', async () => {
  const requestedUrls = [];
  const context = {
    window: {
      location: { hostname: 'localhost' }
    },
    fetch: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({ provinces: [] })
      };
    }
  };

  vm.createContext(context);
  vm.runInContext(psgcSource, context);

  await context.window.PSGC.loadProvinces('northluzon', createSelect());

  assert.equal(requestedUrls[0], '/api/psgc/provinces?zone=northluzon');
});
