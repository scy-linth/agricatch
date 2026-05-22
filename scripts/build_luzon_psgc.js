const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'tempodayry', 'psgc2-master', 'tree.json');
const outputPath = path.resolve(__dirname, '..', 'frontend', 'js', 'psgc_luzon.json');

const REGION_TO_GROUP = {
  'NATIONAL CAPITAL REGION (NCR)': 'Metro Manila',
  'REGION I (ILOCOS REGION)': 'North Luzon',
  'REGION II (CAGAYAN VALLEY)': 'North Luzon',
  'CORDILLERA ADMINISTRATIVE REGION (CAR)': 'North Luzon',
  'REGION III (CENTRAL LUZON)': 'North Luzon',
  'REGION IV-A (CALABARZON)': 'South Luzon',
  'MIMAROPA REGION': 'South Luzon',
  'REGION V (BICOL REGION)': 'South Luzon'
};

const ISLAND_GROUPS = ['Metro Manila', 'North Luzon', 'South Luzon'];

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const sortKeys = (obj) => {
  return Object.keys(obj).sort((a, b) => a.localeCompare(b));
};

const build = () => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing PSGC tree.json at ${sourcePath}`);
  }

  const tree = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const output = {
    islandGroups: {
      'Metro Manila': { provinces: { 'Metro Manila': { cities: {} } } },
      'North Luzon': { provinces: {} },
      'South Luzon': { provinces: {} }
    }
  };

  Object.entries(tree).forEach(([regionName, regionObj]) => {
    const islandGroup = REGION_TO_GROUP[regionName];
    if (!islandGroup || !isObject(regionObj)) return;

    if (regionName === 'NATIONAL CAPITAL REGION (NCR)') {
      const provinceBucket = output.islandGroups['Metro Manila'].provinces['Metro Manila'];
      Object.entries(regionObj).forEach(([cityName, cityObj]) => {
        if (!isObject(cityObj)) return;
        const barangays = Object.entries(cityObj)
          .filter(([, barangayObj]) => isObject(barangayObj))
          .map(([barangayName]) => barangayName)
          .sort((a, b) => a.localeCompare(b));

        if (barangays.length) {
          provinceBucket.cities[cityName] = barangays;
        }
      });
      return;
    }

    Object.entries(regionObj).forEach(([provinceName, provinceObj]) => {
      if (!isObject(provinceObj)) return;

      if (!output.islandGroups[islandGroup].provinces[provinceName]) {
        output.islandGroups[islandGroup].provinces[provinceName] = { cities: {} };
      }

      Object.entries(provinceObj).forEach(([cityName, cityObj]) => {
        if (!isObject(cityObj)) return;
        const barangays = Object.entries(cityObj)
          .filter(([, barangayObj]) => isObject(barangayObj))
          .map(([barangayName]) => barangayName)
          .sort((a, b) => a.localeCompare(b));

        if (barangays.length) {
          output.islandGroups[islandGroup].provinces[provinceName].cities[cityName] = barangays;
        }
      });
    });
  });

  ISLAND_GROUPS.forEach((group) => {
    const provinces = output.islandGroups[group].provinces;
    const sortedProvinces = {};
    sortKeys(provinces).forEach((provinceName) => {
      const province = provinces[provinceName];
      const sortedCities = {};
      sortKeys(province.cities).forEach((cityName) => {
        sortedCities[cityName] = province.cities[cityName];
      });
      sortedProvinces[provinceName] = { cities: sortedCities };
    });
    output.islandGroups[group].provinces = sortedProvinces;
  });

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outputPath}`);
};

build();
