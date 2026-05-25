const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const REQUIRED_DATA_FILES = ['provinces.json', 'cities.json', 'municipalities.json', 'tree.json'];
const DATA_DIR_CANDIDATES = [
  path.resolve(__dirname, '../PSGC2-MASTER'),
  path.resolve(process.cwd(), 'PSGC2-MASTER'),
  path.resolve(process.cwd(), 'backend/PSGC2-MASTER')
];
const NCR_PROVINCE_NAME = 'Metro Manila (NCR)';
const TREE_METADATA_KEYS = new Set(['class', 'cityClass', 'population', 'notes', 'code', 'region', 'province']);

const getDataDir = () => DATA_DIR_CANDIDATES.find((dirPath) => REQUIRED_DATA_FILES.every((fileName) => fs.existsSync(path.join(dirPath, fileName))));

const getMissingDataFiles = (dataDir) => REQUIRED_DATA_FILES.filter((fileName) => !fs.existsSync(path.join(dataDir, fileName)));

const readJson = (dataDir, fileName) => {
  const filePath = path.join(dataDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const toPlainCityName = (value) => String(value || '')
  .replace(/\s*\([^)]*\)\s*/g, ' ')
  .replace(/^city\s+of\s+/i, '')
  .replace(/\s+city$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const state = {
  provinces: [],
  citiesByProvince: new Map(),
  barangaysByCity: new Map(),
  initialized: false,
  loadError: null,
  dataDir: null
};

const collectBarangaysFromCityNode = (cityNode) => {
  if (!cityNode || typeof cityNode !== 'object' || Array.isArray(cityNode)) return [];
  return Object.keys(cityNode)
    .filter((key) => !TREE_METADATA_KEYS.has(key))
    .sort((left, right) => left.localeCompare(right));
};

const walkTree = (node) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;

  for (const [key, value] of Object.entries(node)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    if (value.class === 'City' || value.class === 'Municipality') {
      const barangays = collectBarangaysFromCityNode(value);
      const normalizedCity = normalizeName(key);
      const normalizedPlainCity = normalizeName(toPlainCityName(key));

      if (!state.barangaysByCity.has(normalizedCity)) {
        state.barangaysByCity.set(normalizedCity, barangays);
      }

      if (normalizedPlainCity && !state.barangaysByCity.has(normalizedPlainCity)) {
        state.barangaysByCity.set(normalizedPlainCity, barangays);
      }
      continue;
    }

    walkTree(value);
  }
};

const loadData = () => {
  const dataDir = getDataDir();
  if (!dataDir) {
    throw new Error(`PSGC data directory not found. Checked: ${DATA_DIR_CANDIDATES.join(', ')}`);
  }

  const provinces = readJson(dataDir, 'provinces.json');
  const cities = readJson(dataDir, 'cities.json');
  const municipalities = readJson(dataDir, 'municipalities.json');
  const tree = readJson(dataDir, 'tree.json');

  state.provinces = [];
  state.citiesByProvince = new Map();
  state.barangaysByCity = new Map();
  state.dataDir = dataDir;

  state.provinces = [
    ...provinces
      .map((item) => ({ name: item.name, region: item.region }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    { name: NCR_PROVINCE_NAME, region: 'NATIONAL CAPITAL REGION (NCR)' }
  ];

  const appendCity = (provinceName, cityName) => {
    const key = normalizeName(provinceName);
    const existing = state.citiesByProvince.get(key) || new Map();
    const plainCityName = toPlainCityName(cityName) || String(cityName || '').trim();
    existing.set(normalizeName(plainCityName), plainCityName);
    state.citiesByProvince.set(key, existing);
  };

  cities.forEach((item) => {
    if (item.province) {
      appendCity(item.province, item.name);
      return;
    }
    if (String(item.region || '').includes('NATIONAL CAPITAL REGION')) {
      appendCity(NCR_PROVINCE_NAME, item.name);
    }
  });

  municipalities.forEach((item) => {
    if (item.province) {
      appendCity(item.province, item.name);
      return;
    }
    if (String(item.region || '').includes('NATIONAL CAPITAL REGION')) {
      appendCity(NCR_PROVINCE_NAME, item.name);
    }
  });

  walkTree(tree);

  state.initialized = true;
  state.loadError = null;
};

const ensureDataLoaded = () => {
  if (state.initialized) return;
  try {
    loadData();
  } catch (error) {
    state.loadError = error;
    throw error;
  }
};

const getDiagnostics = () => ({
  initialized: state.initialized,
  dataDir: state.dataDir,
  loadError: state.loadError ? state.loadError.message : null,
  checkedPaths: DATA_DIR_CANDIDATES.map((dirPath) => ({
    path: dirPath,
    missingFiles: getMissingDataFiles(dirPath)
  }))
});

router.preload = () => {
  ensureDataLoaded();
  return getDiagnostics();
};

router.getDiagnostics = getDiagnostics;

// Luzon-only zone-to-region mapping
const ZONE_REGIONS = {
  northluzon: new Set([
    'REGION I (ILOCOS REGION)',
    'REGION II (CAGAYAN VALLEY)',
    'REGION III (CENTRAL LUZON)',
    'CORDILLERA ADMINISTRATIVE REGION (CAR)'
  ]),
  southluzon: new Set([
    'REGION IV-A (CALABARZON)',
    'MIMAROPA REGION',
    'REGION V (BICOL REGION)'
  ])
};

router.get('/provinces', (req, res) => {
  try {
    ensureDataLoaded();
  } catch (error) {
    console.error('PSGC data unavailable:', error.message);
    return res.status(500).json({ message: 'PSGC data unavailable' });
  }

  const zone = String(req.query.zone || '').trim().toLowerCase();

  if (zone === 'metro') {
    return res.json({ provinces: [] });
  }

  if (zone === 'northluzon' || zone === 'southluzon') {
    const allowedRegions = ZONE_REGIONS[zone];
    const filtered = state.provinces.filter((p) => allowedRegions.has(p.region));
    return res.json({ provinces: filtered });
  }

  // Default: return only Luzon provinces (all three zones combined)
  const allLuzonRegions = new Set([...ZONE_REGIONS.northluzon, ...ZONE_REGIONS.southluzon]);
  return res.json({ provinces: state.provinces.filter((p) => allLuzonRegions.has(p.region)) });
});

router.get('/cities', (req, res) => {
  try {
    ensureDataLoaded();
  } catch (error) {
    console.error('PSGC data unavailable:', error.message);
    return res.status(500).json({ message: 'PSGC data unavailable' });
  }

  const province = String(req.query.province || '').trim();
  const zone = String(req.query.zone || '').trim().toLowerCase();

  // Metro Manila: return NCR cities directly (no province needed)
  if (zone === 'metro' || normalizeName(province) === normalizeName('Metro Manila')) {
    const citiesMap = state.citiesByProvince.get(normalizeName(NCR_PROVINCE_NAME));
    const cities = citiesMap
      ? [...citiesMap.values()].sort((a, b) => a.localeCompare(b))
      : [];
    return res.json({ cities });
  }

  if (!province) {
    return res.status(400).json({ message: 'province query parameter is required' });
  }

  const citiesMap = state.citiesByProvince.get(normalizeName(province));
  const cities = citiesMap
    ? [...citiesMap.values()].sort((left, right) => left.localeCompare(right))
    : [];

  return res.json({ cities });
});

router.get('/barangays', (req, res) => {
  try {
    ensureDataLoaded();
  } catch (error) {
    console.error('PSGC data unavailable:', error.message);
    return res.status(500).json({ message: 'PSGC data unavailable' });
  }

  const city = String(req.query.city || '').trim();
  if (!city) {
    return res.status(400).json({ message: 'city query parameter is required' });
  }

  const barangays = state.barangaysByCity.get(normalizeName(city)) || [];
  return res.json({ barangays });
});

module.exports = router;