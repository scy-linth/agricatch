// Shared number formatting helpers (browser-safe)
(function () {
  const safeNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const number = (value, opts) => {
    const n = safeNumber(value);
    const options = opts || {};
    try {
      return new Intl.NumberFormat('en-US', options).format(n);
    } catch (_) {
      // Fallback (very old browsers)
      return String(n);
    }
  };

  const currency = (value, opts) => {
    const n = safeNumber(value);
    const options = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...(opts || {})
    };

    // Peso formatting without relying on Intl currency support.
    return `₱${number(n, options)}`;
  };

  const compact = (value) => {
    const n = safeNumber(value);
    try {
      return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n);
    } catch (_) {
      return String(n);
    }
  };

  window.FormatUtil = {
    safeNumber,
    number,
    currency,
    compact
  };
})();
