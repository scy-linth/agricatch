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

// Shared safe date parser used by all date formatters
const _parseDateInput = (dateInput) => {
  if (dateInput === null || dateInput === undefined || dateInput === '') return null;
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Standard AgriCatch date + time display.
// Example: July 9, 2026, 8:45 PM
window.FormatUtil.formatDate = function(dateInput, options = {}) {
  const date = _parseDateInput(dateInput);
  if (!date) return options.invalid || '—';
  const dateOpts = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  const timeOpts = {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  // Do not pass date-related keys to the time formatter
  const { year, month, day, weekday, era, ...safeTimeOpts } = timeOpts;
  const datePart = date.toLocaleDateString('en-PH', dateOpts);
  const timePart = date.toLocaleTimeString('en-PH', safeTimeOpts);
  return `${datePart}, ${timePart}`;
};

// Standard AgriCatch date-only display.
// Example: July 9, 2026
window.FormatUtil.formatDateOnly = function(dateInput, options = {}) {
  const date = _parseDateInput(dateInput);
  if (!date) return options.invalid || '—';
  const dateOpts = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  return date.toLocaleDateString('en-PH', dateOpts);
};

// Standard AgriCatch time-only display.
// Example: 8:45 PM
window.FormatUtil.formatTimeOnly = function(dateInput, options = {}) {
  const date = _parseDateInput(dateInput);
  if (!date) return options.invalid || '—';
  const timeOpts = {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  return date.toLocaleTimeString('en-PH', timeOpts);
};

// Server time utility - fetches and caches server time for accurate display
window.ServerTime = (function () {
  let cachedServerTime = null;
  let cacheExpiry = 0;
  const CACHE_DURATION = 60000; // 1 minute cache

  async function getServerTime() {
    const now = Date.now();
    
    // Return cached time if still valid
    if (cachedServerTime && now < cacheExpiry) {
      return new Date(cachedServerTime + (now - (cacheExpiry - CACHE_DURATION)));
    }

    try {
      const response = await fetch('/api/time');
      if (!response.ok) throw new Error('Failed to fetch server time');
      
      const data = await response.json();
      cachedServerTime = data.unix;
      cacheExpiry = now + CACHE_DURATION;
      
      return new Date(data.timestamp);
    } catch (error) {
      console.warn('Failed to fetch server time, falling back to local time:', error);
      return new Date();
    }
  }

  // Format a date string/timestamp using server time context
  async function formatDate(dateInput, options = {}) {
    await getServerTime(); // Keeps cache warm / maintains original async shape
    return window.FormatUtil.formatDate(dateInput, options);
  }

  // Format date only (no time)
  async function formatDateOnly(dateInput, options = {}) {
    await getServerTime();
    return window.FormatUtil.formatDateOnly(dateInput, options);
  }

  // Format time only (no date)
  async function formatTimeOnly(dateInput, options = {}) {
    await getServerTime();
    return window.FormatUtil.formatTimeOnly(dateInput, options);
  }

  // Get current server time as Date object
  async function now() {
    return getServerTime();
  }

  return {
    getServerTime,
    formatDate,
    formatDateOnly,
    formatTimeOnly,
    now
  };
})();

// Global toast utility — replaces native alert() across all pages
window.showToast = (function () {
  let _container = null;

  function _ensureContainer() {
    if (_container && document.body.contains(_container)) return _container;
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:99999',
      'display:flex', 'flex-direction:column', 'gap:10px',
      'pointer-events:none', 'max-width:360px'
    ].join(';');
    document.body.appendChild(_container);
    return _container;
  }

  const COLORS = {
    success: { bg: '#166534', border: '#22c55e', icon: '✓' },
    error:   { bg: '#7f1d1d', border: '#ef4444', icon: '✕' },
    warning: { bg: '#713f12', border: '#f59e0b', icon: '!' },
    info:    { bg: '#1e3a5f', border: '#3b82f6', icon: 'i' }
  };

  return function showToast(message, type) {
    const safeType = COLORS[type] ? type : 'info';
    const c = COLORS[safeType];
    const container = _ensureContainer();

    const toast = document.createElement('div');
    toast.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      `background:${c.bg}`, `border-left:4px solid ${c.border}`,
      'color:#fff', 'padding:12px 16px', 'border-radius:8px',
      'font-size:0.92rem', 'line-height:1.4', 'pointer-events:auto',
      'box-shadow:0 4px 12px rgba(0,0,0,0.35)', 'opacity:0',
      'transform:translateX(32px)', 'transition:opacity 0.25s,transform 0.25s',
      'word-break:break-word'
    ].join(';');

    const icon = document.createElement('span');
    icon.style.cssText = 'flex-shrink:0;font-weight:700;font-size:1rem;';
    icon.textContent = c.icon;

    const text = document.createElement('span');
    text.textContent = String(message);

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto-dismiss after 4s
    const dismiss = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(32px)';
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    };
    const timer = setTimeout(dismiss, 4000);
    toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  };
}());

// Global empty-state HTML generator — standardizes empty state markup across all pages
// Usage: renderEmptyState({ icon, title, description, actionText, actionHref })
window.renderEmptyState = function renderEmptyState(opts = {}) {
    const {
        icon = 'fas fa-inbox',
        title = '',
        description = '',
        actionText = '',
        actionHref = ''
    } = opts;

    let html = '<div class="empty-state">';
    if (icon) {
        html += `<i class="${icon}" aria-hidden="true"></i>`;
    }
    if (title) {
        html += `<p class="empty-state-title">${title}</p>`;
    }
    if (description) {
        html += `<p class="empty-state-description">${description}</p>`;
    }
    if (actionText && actionHref) {
        html += `<a href="${actionHref}" class="btn btn-primary">${actionText}</a>`;
    }
    html += '</div>';
    return html;
};

// Global confirm utility — replaces native confirm() across all pages
// Returns a Promise<boolean>
window.showConfirm = (function () {
  return function showConfirm(message, { title = 'Confirm', okLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
    return new Promise((resolve) => {
      // Remove any existing instance
      const existing = document.getElementById('_global_confirm_modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = '_global_confirm_modal';
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:100000',
        'background:rgba(0,0,0,0.55)', 'display:flex',
        'align-items:center', 'justify-content:center', 'padding:16px'
      ].join(';');

      const box = document.createElement('div');
      box.style.cssText = [
        'background:#fff', 'border-radius:12px', 'padding:28px 24px 20px',
        'max-width:400px', 'width:100%', 'box-shadow:0 8px 32px rgba(0,0,0,0.28)',
        'font-family:inherit', 'animation:_gcm_in .18s ease'
      ].join(';');

      const style = document.createElement('style');
      style.textContent = '@keyframes _gcm_in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}';
      document.head.appendChild(style);

      const h = document.createElement('h3');
      h.style.cssText = 'margin:0 0 10px;font-size:1.1rem;font-weight:700;color:#111827;';
      h.textContent = title;

      const p = document.createElement('p');
      p.style.cssText = 'margin:0 0 20px;font-size:0.95rem;color:#374151;line-height:1.5;';
      p.textContent = message;

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelLabel;
      cancelBtn.style.cssText = 'padding:8px 18px;border-radius:7px;border:1px solid #d1d5db;background:#f9fafb;color:#374151;font-size:0.93rem;cursor:pointer;';

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.textContent = okLabel;
      okBtn.style.cssText = `padding:8px 18px;border-radius:7px;border:none;background:${danger ? '#dc2626' : '#16a34a'};color:#fff;font-size:0.93rem;cursor:pointer;font-weight:600;`;

      const close = (result) => {
        overlay.remove();
        style.remove();
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => close(false));
      okBtn.addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); }
      });

      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      okBtn.focus();
    });
  };
}());
