(function initPsgc(global) {
  const host = String(global.location?.hostname || '').toLowerCase();
  const API_BASE = host === 'agricatch.store' || host === 'www.agricatch.store'
    ? 'https://agricatch.onrender.com/api/psgc'
    : '/api/psgc';

  // The only zones served by this system
  const ZONES = [
    { value: 'metro',      label: 'Metro Manila'  },
    { value: 'northluzon', label: 'North Luzon'   },
    { value: 'southluzon', label: 'South Luzon'   }
  ];

  // Province to zone mapping
  const PROVINCE_TO_ZONE = {
    'Metro Manila': 'metro',
    'metro': 'metro',
    // North Luzon provinces
    'Ilocos Norte': 'northluzon',
    'Ilocos Sur': 'northluzon',
    'La Union': 'northluzon',
    'Pangasinan': 'northluzon',
    'Benguet': 'northluzon',
    'Mountain Province': 'northluzon',
    'Ifugao': 'northluzon',
    'Kalinga': 'northluzon',
    'Apayao': 'northluzon',
    'Abra': 'northluzon',
    'Cagayan': 'northluzon',
    'Isabela': 'northluzon',
    'Nueva Vizcaya': 'northluzon',
    'Quirino': 'northluzon',
    'Batanes': 'northluzon',
    // South Luzon provinces
    'Aurora': 'southluzon',
    'Bataan': 'southluzon',
    'Bulacan': 'southluzon',
    'Nueva Ecija': 'southluzon',
    'Pampanga': 'southluzon',
    'Tarlac': 'southluzon',
    'Zambales': 'southluzon',
    'Cavite': 'southluzon',
    'Laguna': 'southluzon',
    'Batangas': 'southluzon',
    'Rizal': 'southluzon',
    'Quezon': 'southluzon',
    'Marinduque': 'southluzon',
    'Occidental Mindoro': 'southluzon',
    'Oriental Mindoro': 'southluzon',
    'Palawan': 'southluzon',
    'Romblon': 'southluzon',
    'Albay': 'southluzon',
    'Camarines Norte': 'southluzon',
    'Camarines Sur': 'southluzon',
    'Catanduanes': 'southluzon',
    'Masbate': 'southluzon',
    'Sorsogon': 'southluzon'
  };

  const requestJson = async (path) => {
    const response = await fetch(`${API_BASE}${path}`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`PSGC request failed: ${response.status}`);
    return response.json();
  };

  // Fill a <select> with an items array. Disables it when items is empty.
  const setSelectOptions = (selectEl, items, placeholder, selectedValue = '') => {
    if (!selectEl) return;
    const safeItems = Array.isArray(items) ? items : [];
    selectEl.innerHTML =
      `<option value="">${placeholder}</option>` +
      safeItems
        .map((item) => {
          const val = typeof item === 'string' ? item : item.name;
          const sel = val === selectedValue ? ' selected' : '';
          return `<option value="${val}"${sel}>${val}</option>`;
        })
        .join('');
    selectEl.disabled = safeItems.length === 0;
  };

  // Populate a zone <select> from the static ZONES list.
  const loadZones = (selectEl, selectedValue = '') => {
    if (!selectEl) return;
    selectEl.innerHTML =
      `<option value="">Select Zone (Metro / North / South Luzon)</option>` +
      ZONES
        .map((z) => {
          const sel = z.value === selectedValue ? ' selected' : '';
          return `<option value="${z.value}"${sel}>${z.label}</option>`;
        })
        .join('');
    selectEl.disabled = false;
  };

  // Load province list for a given zone.
  // For Metro Manila zone the province dropdown is disabled with a fixed value.
  const loadProvinces = async (zone, selectEl, selectedValue = '') => {
    if (!selectEl) return [];

    if (!zone || zone === 'metro') {
      selectEl.innerHTML = '<option value="Metro Manila">Metro Manila</option>';
      selectEl.value = 'Metro Manila';
      selectEl.disabled = true;
      return [];
    }

    const data = await requestJson(`/provinces?zone=${encodeURIComponent(zone)}`);
    const provinces = data.provinces || [];
    setSelectOptions(selectEl, provinces, 'Select Province', selectedValue);
    selectEl.disabled = false;
    return provinces;
  };

  // Load cities for a given province.
  // Pass province = 'Metro Manila' or zone = 'metro' to get NCR cities.
  const loadCities = async (province, selectEl, selectedValue = '') => {
    if (!province) {
      setSelectOptions(selectEl, [], 'Select City / Municipality');
      return [];
    }
    const isMetro = province === 'Metro Manila' || province === 'metro';
    const qs = isMetro ? '?zone=metro' : `?province=${encodeURIComponent(province)}`;
    const data = await requestJson(`/cities${qs}`);
    const cities = data.cities || [];
    setSelectOptions(selectEl, cities, 'Select City / Municipality', selectedValue);
    if (selectEl) selectEl.disabled = cities.length === 0;
    return cities;
  };

  const loadBarangays = async (city, selectEl, selectedValue = '') => {
    if (!city) {
      setSelectOptions(selectEl, [], 'Select Barangay');
      return [];
    }
    const data = await requestJson(`/barangays?city=${encodeURIComponent(city)}`);
    const barangays = data.barangays || [];
    setSelectOptions(selectEl, barangays, 'Select Barangay', selectedValue);
    if (selectEl) selectEl.disabled = barangays.length === 0;
    return barangays;
  };

  // Cascade helper: call when zone changes.
  // Resets province/city/barangay and sets up the next level appropriately.
  const onZoneChange = async (zone, { provinceEl, cityEl, barangayEl }) => {
    // Reset downstream
    if (cityEl)    { setSelectOptions(cityEl, [], 'Select City / Municipality'); cityEl.disabled = true; }
    if (barangayEl){ setSelectOptions(barangayEl, [], 'Select Barangay'); barangayEl.disabled = true; }

    if (!zone) {
      if (provinceEl) { setSelectOptions(provinceEl, [], 'Select Province'); provinceEl.disabled = true; }
      return;
    }

    if (zone === 'metro') {
      // Province = Metro Manila (fixed, disabled); load cities immediately
      if (provinceEl) {
        provinceEl.innerHTML = '<option value="Metro Manila">Metro Manila</option>';
        provinceEl.value = 'Metro Manila';
        provinceEl.disabled = true;
      }
      const cities = await loadCities('Metro Manila', cityEl);
      if (cityEl) cityEl.disabled = cities.length === 0;
    } else {
      // Enable province dropdown and load province list for the zone
      if (provinceEl) provinceEl.disabled = false;
      await loadProvinces(zone, provinceEl);
    }
  };

  // Cascade helper: call when province changes.
  const onProvinceChange = async (province, { cityEl, barangayEl }) => {
    if (barangayEl) { setSelectOptions(barangayEl, [], 'Select Barangay'); barangayEl.disabled = true; }
    if (!province) {
      if (cityEl) { setSelectOptions(cityEl, [], 'Select City / Municipality'); cityEl.disabled = true; }
      return;
    }
    const cities = await loadCities(province, cityEl);
    if (cityEl) cityEl.disabled = cities.length === 0;
  };

  const formatAddress = ({ street = '', barangay = '', city = '', province = '' }) => {
    return [street, barangay, city, province].filter(Boolean).join(', ');
  };

  // Parse an address string into components
  // Expected format: "street, barangay, city, province" or "barangay, city, province"
  const parseAddress = (addressStr) => {
    if (!addressStr || typeof addressStr !== 'string') return null;

    const parts = addressStr.split(',').map(p => p.trim()).filter(Boolean);
    const result = { street: '', barangay: '', city: '', province: '', zone: '' };

    if (parts.length === 0) return null;
    if (parts.length === 1) {
      // Only one part - could be city or province
      result.city = parts[0];
    } else if (parts.length === 2) {
      // "city, province"
      result.city = parts[0];
      result.province = parts[1];
    } else if (parts.length === 3) {
      // "barangay, city, province"
      result.barangay = parts[0];
      result.city = parts[1];
      result.province = parts[2];
    } else if (parts.length >= 4) {
      // "street, barangay, city, province"
      result.street = parts[0];
      result.barangay = parts[1];
      result.city = parts[2];
      result.province = parts[3];
    }

    // Determine zone from province using the mapping
    if (result.province) {
      result.zone = PROVINCE_TO_ZONE[result.province] || '';
    }

    return result;
  };

  global.PSGC = {
    ZONES,
    loadZones,
    loadProvinces,
    loadCities,
    loadBarangays,
    onZoneChange,
    onProvinceChange,
    formatAddress,
    parseAddress,
    setSelectOptions
  };
})(window);