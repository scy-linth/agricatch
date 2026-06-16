// Farmer Dashboard JavaScript

class FarmerDashboard {
    constructor() {
        // Prefer relative /api, but auto-fallback to direct backend when host has no /api proxy.
        this.apiBaseCandidates = ['/api', 'https://agricatch.onrender.com/api'];
        this.apiBase = this.getInitialApiBase();
        this.isResolvingApiBase = false;
        this.apiBaseResolvePromise = null;
        this.authRetryAttempts = 0;
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        if (this.token) {
            localStorage.setItem('token', this.token);
        } else {
            localStorage.removeItem('token');
        }
        this.userId = this.getUserId();
        this.lastOrdersById = new Map();
        this.lastOrdersByStatus = { pending: [], confirmed: [], preparing: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.ordersCountByStatus = { pending: 0, confirmed: 0, preparing: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
        this.activeSection = 'overview';
        this.currentShopProfile = null;
        this.isShopProfileEditing = false;
        this.currentAddressTarget = null;

        this.overviewCharts = { sales: null, status: null };
        this.overviewMetrics = null;
        this.hasLoadedOrders = false;
        this.isSubmittingAddProduct = false;
        this.isSubmittingEditProduct = false;
        this.isSubmittingRequestProduct = false;
        this.overviewRecentOrdersCache = [];
        this.overviewTopProductsCache = [];
        this.overviewLastFetchAt = 0;
        this.overviewFetchInFlight = null;
        this.sortableTables = {};
        this.overviewRefreshTimer = null;
        this.myProductsCache = [];
        this.catalogProductNames = [];
        this.productNameActiveIndex = { add: -1, edit: -1 };
        this.realtimeSource = null;
        this.customerRatingDraft = { orderId: null, rating: 0, hasExisting: false };

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();
    }

    getInitialApiBase() {
        try {
            const saved = String(sessionStorage.getItem('farmer_api_base') || '').trim();
            if (saved) return saved;
        } catch (_) {
            // ignore
        }
        return '/api';
    }

    setApiBase(nextBase) {
        this.apiBase = String(nextBase || '/api').trim() || '/api';
        try {
            sessionStorage.setItem('farmer_api_base', this.apiBase);
        } catch (_) {
            // ignore
        }
    }

    waitForPsgc(timeoutMs = 2500) {
        if (window.PSGC) return Promise.resolve(window.PSGC);
        return new Promise((resolve) => {
            const start = Date.now();
            const timer = window.setInterval(() => {
                if (window.PSGC) {
                    window.clearInterval(timer);
                    resolve(window.PSGC);
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    window.clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    }

    getPersonalNameParts(profile = {}) {
        return {
            firstName: String(profile.first_name || '').trim(),
            middleName: String(profile.middle_name || '').trim(),
            lastName: String(profile.last_name || '').trim()
        };
    }

    async resolveWorkingApiBase() {
        if (this.apiBaseResolvePromise) {
            return this.apiBaseResolvePromise;
        }

        this.isResolvingApiBase = true;
        this.apiBaseResolvePromise = (async () => {
            const orderedCandidates = [this.apiBase, ...this.apiBaseCandidates]
                .map((v) => String(v || '').trim())
                .filter(Boolean)
                .filter((v, i, arr) => arr.indexOf(v) === i);

            for (const base of orderedCandidates) {
                try {
                    const res = await fetch(`${base}/auth/profile`, {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    });

                    // Any non-404 response means this base is reachable.
                    if (res.status !== 404) {
                        this.setApiBase(base);
                        return true;
                    }
                } catch (_) {
                    // try next candidate
                }
            }

            return false;
        })();

        try {
            return await this.apiBaseResolvePromise;
        } finally {
            this.apiBaseResolvePromise = null;
            this.isResolvingApiBase = false;
        }
    }

    normalizeAuthToken(rawToken) {
        let token = String(rawToken || '').trim();
        if (!token) return null;

        if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
            token = token.slice(1, -1).trim();
        }

        if (/^Bearer\s+/i.test(token)) {
            token = token.replace(/^Bearer\s+/i, '').trim();
        }

        if (!token || token === 'null' || token === 'undefined') return null;
        return token;
    }

    fmtNumber(value, options) {
        try {
            if (window.FormatUtil && typeof window.FormatUtil.number === 'function') {
                return window.FormatUtil.number(value, options);
            }
        } catch (_) {
            // ignore
        }
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        return String(n);
    }

    fmtCurrency(value, options) {
        try {
            if (window.FormatUtil && typeof window.FormatUtil.currency === 'function') {
                return window.FormatUtil.currency(value, options);
            }
        } catch (_) {
            // ignore
        }
        const n = Number(value);
        return `₱${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
    }

    _periodToRangeDays(period) {
        const p = String(period || '').trim().toLowerCase();
        if (p === 'today') return '1';
        if (p === 'week') return '7';
        if (p === 'month') return '30';
        if (p === 'year') return '365';
        if (p === 'all') return 'all';
        return '30';
    }

    _periodLabel(period) {
        const map = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
        return map[String(period || '').trim().toLowerCase()] || 'Today';
    }

    _comparisonLabel(period) {
        const map = { today: 'vs prev today', week: 'vs prev week', month: 'vs prev month', year: 'vs prev year', all: 'vs prev period' };
        return map[String(period || '').trim().toLowerCase()] || 'vs prev today';
    }

    _syncAllPeriods(period) {
        this._reportPeriod = period;
        this._statusPeriod = period;
        // Recent Orders and Top Products are NOT synced with period filter
        // this._recentOrdersPeriod = period;
        // this._topProductsPeriod = period;
        for (const key of Object.keys(this._kpiPeriods)) {
            this._kpiPeriods[key] = period;
        }
        // Update all period labels
        const periodText = this._periodLabel(period);
        const periodLabels = [
            'total-orders-period-label',
            'items-sold-period-label',
            'total-revenue-period-label',
            'reports-period-label',
            'status-period-label'
        ];
        periodLabels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = `| ${periodText}`;
        });
        // Update all comparison labels
        const comparisonText = this._comparisonLabel(period);
        const comparisonLabels = [
            'total-orders-change-label',
            'items-sold-change-label',
            'total-revenue-change-label'
        ];
        comparisonLabels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = comparisonText;
        });
        // Clear cached data when switching periods (but not for Recent Orders/Top Products)
        this.overviewMetrics = null;
        // Don't clear Recent Orders and Top Products cache since they're independent
        // this.overviewRecentOrdersCache = [];
        // this.overviewTopProductsCache = [];
        this.overviewLastFetchAt = 0;
    }

    destroySortableTable(tableId) {
        const existing = this.sortableTables?.[tableId];
        if (existing && typeof existing.destroy === 'function') {
            try {
                existing.destroy();
            } catch (_) {}
            delete this.sortableTables[tableId];
        }
    }

    refreshSortableTable(tableId, options = {}) {
        const existing = this.sortableTables?.[tableId];
        if (existing && typeof existing.destroy === 'function') {
            try {
                existing.destroy();
            } catch (_) {}
            delete this.sortableTables[tableId];
        }

        if (!window.simpleDatatables?.DataTable) return;

        const table = document.getElementById(tableId);
        if (!table) return;

        const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
        const hasSortableRows = bodyRows.some((row) => row.children.length > 1);
        if (!hasSortableRows) return;

        const dataTableOptions = {
            searchable: false,
            paging: false,
            perPageSelect: false,
            sortable: true,
            fixedHeight: false,
            destroyable: true,
            labels: {
                placeholder: '',
                noRows: 'No entries found',
                noResults: 'No results found'
            },
            ...options
        };

        if (options.defaultSort) {
            dataTableOptions.sort = options.defaultSort;
        }

        this.sortableTables[tableId] = new window.simpleDatatables.DataTable(table, dataTableOptions);
        this.sortableTables[tableId]?.wrapperDOM?.classList.add('admin-sortable-wrapper');
    }

    getStatusClass(status) {
        if (['pending'].includes(status)) return 'pending';
        if (['confirmed'].includes(status)) return 'confirmed';
        if (['preparing', 'out_for_delivery'].includes(status)) return 'preparing';
        if (status === 'delivered') return 'delivered';
        if (status === 'cancelled') return 'cancelled';
        if (status === 'refunded') return 'refunded';
        return 'completed';
    }

    renderStatus(text, statusKey) {
        const key = (statusKey || '').toString().toLowerCase();
        const cls = this.getStatusClass(key);
        const direct = ['active','disabled','approved','rejected','verified','unverified','available','unavailable','no_stock'];
        const pillClass = direct.includes(key) ? key : cls;
        return `<span class="status-pill ${pillClass}">${text}</span>`;
    }

    renderPagination(containerId, pg, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const { page, total, limit } = pg;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);
        if (totalPages <= 1) {
            container.innerHTML = `<span class="pagination-info">Showing ${start}–${end} of ${total}</span>`;
            return;
        }
        const pages = [];
        const range = 2;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) pages.push(i);
            else if (pages[pages.length - 1] !== '…') pages.push('…');
        }
        container.innerHTML = `
            <span class="pagination-info">Showing ${start}–${end} of ${total}</span>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>
                ${pages.map(p => p === '…'
                    ? `<button class="page-btn" disabled>…</button>`
                    : `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
                ).join('')}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>
            </div>
        `;
        container.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => onPageChange(Number(btn.getAttribute('data-page'))));
        });
    }

    async init() {
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        // Dashboard period state (mirrors admin.js patterns)
        this._kpiPeriods = { 'kpi-products': 'all', 'kpi-orders': 'today', 'kpi-sold': 'today', 'kpi-revenue': 'today' };
        this._reportPeriod = 'today';
        this._statusPeriod = 'today';
        this._recentOrdersPeriod = 'today';
        this._topProductsPeriod = 'today';
        this.pagination = {
            'recent-orders': { page: 1, total: 0, limit: 5 },
            'top-products': { page: 1, total: 0, limit: 5 },
            'products': { page: 1, total: 0, limit: 50 },
        };
        this.showDeniedBanner();
        await this.checkFarmerAuth();
        this.setupEventListeners();
        this.setupRequestModal();
        this.loadCategories();
        this.loadProductCatalogNames();
        this.setupProductSuggestionListeners();
        this.setupNonNegativeInputs();
        this.setupSidebarNavigation();
        this.setupDetailPanel();
        this.setupRealtime();
        this.initChat();
        this.initUnitDropdowns();
    }

    setupRequestModal() {
        const openBtn = document.getElementById('request-product-btn');
        const modal = document.getElementById('request-product-modal');
        const overlay = modal?.querySelector('.product-details-overlay');
        const closeBtn = document.getElementById('request-modal-close');
        const cancelBtn = document.getElementById('request-form-cancel');

        if (openBtn && modal) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openRequestModal();
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeRequestModal(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeRequestModal(true));

        // Form handlers
        const form = document.getElementById('request-product-form-modal');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmitRequestForm(e));
        }
    }

    async openRequestModal() {
        try {
            const modal = document.getElementById('request-product-modal');
            if (!modal) return;
            modal.classList.add('active');
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');
            await this.loadRequestHistory();
        } catch (e) {
            console.error('Open request modal error:', e);
        }
    }

    closeRequestModal() {
        const modal = document.getElementById('request-product-modal');
        if (!modal) return;
        modal.classList.remove('active');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    async openAddProductModal() {
        const modal = document.getElementById('add-product-modal');
        if (!modal) return;
        modal.classList.add('open');
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
        
        // Auto-fill location from shop address
        const shopLocation = this.currentShopProfile?.location || '';
        const locationDisplay = document.getElementById('product-location-display');
        const locationInput = document.getElementById('product-location');
        if (locationDisplay) {
            locationDisplay.value = shopLocation;
        }
        if (locationInput) {
            locationInput.value = shopLocation;
        }
        
        await this.loadCategories();
        await this.loadProductCatalogNames();
    }

    setupNonNegativeInputs() {
        const inputIds = [
            'product-price',
            'product-stock',
            'edit-product-price',
            'edit-product-stock'
        ];

        const blockNegative = (input) => {
            if (!input) return;
            input.addEventListener('keydown', (e) => {
                if (e.key === '-' || e.key === 'Minus') {
                    e.preventDefault();
                }
            });
            input.addEventListener('input', () => {
                if (input.value.includes('-')) {
                    input.value = input.value.replace(/-/g, '');
                }
                const value = Number(input.value);
                if (Number.isFinite(value) && value < 0) {
                    input.value = '';
                }
            });
        };

        inputIds.forEach((id) => blockNegative(document.getElementById(id)));
    }

    closeAddProductModal(forceClose = false) {
        if (this.isSubmittingAddProduct && !forceClose) {
            return;
        }
        const modal = document.getElementById('add-product-modal');
        if (!modal) return;
        modal.classList.remove('open');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    async handleSubmitRequestForm(e) {
        try {
            e.preventDefault();
            if (this.isSubmittingRequestProduct) return;
            const nameEl = document.getElementById('request-product-name');
            const notesEl = document.getElementById('request-product-notes');
            if (!nameEl) return;
            const name = String(nameEl.value || '').trim();
            const notes = String(notesEl?.value || '').trim();
            if (!name) return this.showMessage('Please enter the product name.', 'error');

            this.isSubmittingRequestProduct = true;
            const submitBtn = document.querySelector('#request-product-form-modal button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Sending...';
            }

            const res = await fetch(`${this.apiBase}/products/category-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
                body: JSON.stringify({
                    name,
                    notes
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                this.showMessage(data.message || 'Unable to submit request', 'error');
            } else {
                this.showMessage('Request submitted for staff approval.', 'success');
                // reset
                (document.getElementById('request-product-form-modal') || {}).reset?.();
                await this.loadRequestHistory();
            }
        } catch (err) {
            console.error('Submit request error:', err);
            this.showMessage('Unable to submit request right now.', 'error');
        } finally {
            this.isSubmittingRequestProduct = false;
            const submitBtn = document.querySelector('#request-product-form-modal button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-send me-1"></i>Submit Request';
            }
        }
    }

    async loadRequestHistory() {
        try {
            const requestUrls = [
                `${this.apiBase}/products/category-requests/mine`,
                `${this.apiBase}/products/requests/mine`
            ];
            let data = null;
            for (const url of requestUrls) {
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${this.token}` }
                });
                if (res.ok) {
                    data = await res.json();
                    break;
                }
                if (res.status === 401) {
                    const errorData = await res.json().catch(() => ({}));
                    this.showMessage(errorData.message || 'Session expired. Please log in again.', 'error');
                    return;
                }
                if (res.status !== 404) {
                    const errorData = await res.json().catch(() => ({}));
                    this.showMessage(errorData.message || 'Unable to load request history right now.', 'error');
                    return;
                }
            }
            if (!data) return;
            const listEl = document.getElementById('request-product-history');
            if (!listEl) return;
            const rows = Array.isArray(data.requests) ? data.requests : [];
            if (!rows.length) {
                listEl.innerHTML = '<div class="overview-list-item">No requests yet.</div>';
                return;
            }
            listEl.innerHTML = rows.map(r => {
                    const status = String(r.status || 'pending');
                    const statusClass = status === 'approved' ? 'badge badge-success' : status === 'rejected' ? 'badge badge-danger' : 'badge badge-secondary';
                    const cat = this.escapeAttr(r.category_name || r.requested_category_name || 'Uncategorized');
                    const when = new Date(r.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const note = this.escapeAttr(r.notes || '');
                    const review = this.escapeAttr(r.review_notes || '');
                    return `
                        <div class="overview-list-item request-history-item" style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
                            <div style="flex:1;">
                                <div style="font-size:0.92rem;color:var(--text-secondary);">Product Name: <strong style="color:var(--text-primary);">${this.escapeAttr(r.name)}</strong></div>
                                <div style="font-size:0.92rem;color:var(--text-secondary);">Product Category: <strong style="color:var(--text-primary);">${cat}</strong></div>
                                <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.2rem;">${when}</div>
                                ${note ? `<div style="margin-top:0.35rem;color:var(--text-muted);">${note}</div>` : ''}
                                ${review ? `<div style="margin-top:0.35rem;color:var(--text-muted);font-style:italic;">Review: ${review}</div>` : ''}
                            </div>
                            <div style="margin-left:0.75rem;white-space:nowrap;align-self:flex-start;">
                                <span class="${statusClass}" style="padding:6px 8px;border-radius:12px;font-weight:700;">${status}</span>
                            </div>
                        </div>
                    `;
            }).join('');
        } catch (e) {
            console.error('Load request history error:', e);
        }
    }

    initChat() {
        // Initialize chat UI for farmer dashboard if chat section exists
        if (document.getElementById('chat-messages') && typeof ChatUI !== 'undefined') {
            if (!window.chatUI) {
                window.chatUI = new ChatUI();
            }
        }
    }

    setupRealtime() {
        try {
            if (!this.token || !this.userId) return;
            if (this.realtimeSource) {
                try { this.realtimeSource.close(); } catch (_) {}
                this.realtimeSource = null;
            }

            const url = `${this.apiBase}/events?token=${encodeURIComponent(this.token)}`;
            const es = new EventSource(url);
            this.realtimeSource = es;
            es.addEventListener('order.updated', (evt) => {
                try {
                    const data = JSON.parse(evt.data || '{}');
                    if (Array.isArray(data.farmer_ids) && data.farmer_ids.some(id => Number(id) === Number(this.userId))) {
                        // Reload all order tabs to ensure order moves from old status to new status
                        // This ensures the order appears in the correct tab after status change
                        const newStatus = data.new_status;
                        if (newStatus) {
                            // Reload all tabs first (so order disappears from old tab and appears in new tab)
                            this.loadMyOrders().then(() => {
                                this.refreshOverviewMetricsSoon();
                                // Switch to the tab showing the new status
                                setTimeout(() => {
                                    if (newStatus === 'pending') this.switchOrderTab('pending', true);
                                    else if (newStatus === 'confirmed') this.switchOrderTab('confirmed', true);
                                    else if (newStatus === 'preparing') this.switchOrderTab('preparing', true);
                                    else if (newStatus === 'out_for_delivery') this.switchOrderTab('out_for_delivery', true);
                                    else if (newStatus === 'delivered') this.switchOrderTab('delivered', true);
                                    else if (newStatus === 'cancelled') this.switchOrderTab('cancelled', true);
                                }, 100); // Small delay to ensure DOM is updated
                            });
                        } else {
                            // Fallback: reload all orders if status not provided
                            this.loadMyOrders();
                            this.refreshOverviewMetricsSoon();
                        }
                    }
                } catch (_) {
                    // ignore
                }
            });

            es.addEventListener('error', async () => {
                const switched = await this.resolveWorkingApiBase();
                if (switched) {
                    this.setupRealtime();
                }
            });
        } catch (_) {
            // ignore
        }
    }

    getUserId() {
        try {
            if (!this.token) return null;
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.id;
        } catch (_) {
            return null;
        }
    }

    showDeniedBanner() {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('denied') !== 'admin') return;

            // Prevent duplicates
            if (document.getElementById('access-denied-banner')) return;

            const banner = document.createElement('div');
            banner.id = 'access-denied-banner';
            banner.style.cssText = `
                position: sticky;
                top: 0;
                z-index: 2000;
                background: #fee2e2;
                color: #7f1d1d;
                border-bottom: 1px solid #fecaca;
                padding: 12px 16px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            `;

            banner.innerHTML = `
                <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:18px;">⛔</span>
                        <div>
                            <div style="font-weight:700;">Access denied</div>
                            <div style="font-size:13px;">You tried to open the Staff Panel. Only staff can access it.</div>
                        </div>
                    </div>
                    <button id="dismiss-denied-banner" style="border:1px solid #fecaca;background:#fff;padding:8px 10px;border-radius:10px;cursor:pointer;">
                        Dismiss
                    </button>
                </div>
            `;

            const header = document.querySelector('header.header');
            if (header) {
                header.insertAdjacentElement('afterend', banner);
            } else {
                document.body.insertAdjacentElement('afterbegin', banner);
            }

            const dismissBtn = document.getElementById('dismiss-denied-banner');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    banner.remove();
                    // Remove the denied flag from the URL
                    params.delete('denied');
                    const newQuery = params.toString();
                    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash || ''}`;
                    window.history.replaceState({}, '', newUrl);
                });
            }
        } catch (e) {
            // Do nothing if URLSearchParams is not available
        }
    }

    async checkFarmerAuth() {
        try {
            const attemptedBase = this.apiBase;
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.authProfile = data?.user || null;
                // If a staff user opens farmer page, send them back to staff panel
                if (data.user.role === 'staff') {
                    this.showAdminDeniedBannerAndRedirect();
                    return;
                }
                if (data.user.role !== 'farmer') {
                    window.location.href = '/';
                    return;
                }
                const nameEl = document.getElementById('user-name');
                if (nameEl) nameEl.textContent = `Farmer: ${data.user.full_name || data.user.username}`;
                const emailEl = document.getElementById('user-email');
                if (emailEl) emailEl.textContent = data.user.email || '—';
                const farmerUserLabel = document.getElementById('farmer-user-label');
                if (farmerUserLabel) farmerUserLabel.textContent = data.user.username || data.user.full_name || 'Account';
                const farmerUserInitial = document.getElementById('farmer-user-initial');
                if (farmerUserInitial) {
                    const displayName = data.user.username || data.user.full_name || 'F';
                    farmerUserInitial.textContent = String(displayName).charAt(0).toUpperCase();
                }
                const sidebarUserLabel = document.getElementById('farmer-sidebar-user-label');
                if (sidebarUserLabel) sidebarUserLabel.textContent = data.user.username || data.user.full_name || 'Account';
                const sidebarUserInitial = document.getElementById('farmer-sidebar-user-initial');
                if (sidebarUserInitial) {
                    const displayName = data.user.username || data.user.full_name || 'F';
                    sidebarUserInitial.textContent = String(displayName).charAt(0).toUpperCase();
                }
                this.farmerId = data.user.id;
                this.authRetryAttempts = 0;

                // Show verification status banner
                try {
                    const bannerEl = document.getElementById('farmer-verif-banner');
                    if (bannerEl) {
                        if (data.user.is_disabled) {
                            bannerEl.style.display = '';
                            bannerEl.style.cssText += ';background:#fee2e2;color:#7f1d1d;border:1px solid #fecaca;';
                            bannerEl.innerHTML = '<i class="fas fa-ban"></i> Your account has been disabled. Please contact support.';
                        } else if (data.user.is_verified === false) {
                            bannerEl.style.display = '';
                            bannerEl.style.cssText += ';background:#fef9c3;color:#713f12;border:1px solid #fde047;';
                            bannerEl.innerHTML = '<i class="fas fa-clock"></i> Your account is pending verification. You can add products but they won\'t be visible to customers until verified.';
                        } else {
                            bannerEl.style.display = 'none';
                        }
                    }
                } catch (_) { /* ignore */ }

                this.loadFarmerStats();
                this.loadMyProducts();
                this.loadMyOrders();
                this.loadShopProfile();
                this.loadOverviewMetrics({ force: true });
                this.loadAnnouncements();
            } else {
                // Never bounce farmer users to home on transient backend errors (causes redirect loop).
                // Only force-login on unauthorized/forbidden responses.
                if (response.status === 401 || response.status === 403) {
                    try { localStorage.removeItem('token'); } catch (e) {}
                    window.location.href = '/?login=1';
                    return;
                }

                if (response.status === 404) {
                    const found = await this.resolveWorkingApiBase();
                    if (found && this.apiBase !== attemptedBase) {
                        console.warn('Switched farmer API base to:', this.apiBase);
                        this.showMessage('Connected to fallback API server.', 'success');
                        return this.checkFarmerAuth();
                    }
                    this.showMessage('API routes are not available on this host. Please contact support to configure /api proxy.', 'error');
                    return;
                }

                console.warn('Farmer auth check failed with status:', response.status);
                this.authRetryAttempts += 1;
                if (this.authRetryAttempts <= 5) {
                    this.showMessage('Connection issue while verifying account. Staying on dashboard and retrying...', 'error');
                    setTimeout(() => this.checkFarmerAuth(), 2500);
                } else {
                    this.showMessage('Unable to verify account after several tries. Please refresh or re-login.', 'error');
                }
            }
        } catch (error) {
            console.error('Auth check error:', error);
            // Network hiccups should not throw the user back to home/login repeatedly.
            this.authRetryAttempts += 1;
            if (this.authRetryAttempts <= 5) {
                this.showMessage('Unable to verify account right now. Retrying...', 'error');
                setTimeout(() => this.checkFarmerAuth(), 2500);
            } else {
                this.showMessage('Network issue persists. Please refresh or re-login.', 'error');
            }
        }
    }

    showAdminDeniedBannerAndRedirect() {
        // Prevent duplicates
        if (!document.getElementById('access-denied-admin-banner')) {
            const banner = document.createElement('div');
            banner.id = 'access-denied-admin-banner';
            banner.style.cssText = `
                position: sticky;
                top: 0;
                z-index: 2000;
                background: #fff7ed;
                color: #7c2d12;
                border-bottom: 1px solid #fed7aa;
                padding: 12px 16px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            `;

            banner.innerHTML = `
                <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:18px;">⛔</span>
                        <div>
                            <div style="font-weight:700;">Access denied</div>
                            <div style="font-size:13px;">Staff users cannot access the Farmer Dashboard. Redirecting to Staff Panel...</div>
                        </div>
                    </div>
                </div>
            `;

            const header = document.querySelector('header.header');
            if (header) {
                header.insertAdjacentElement('afterend', banner);
            } else {
                document.body.insertAdjacentElement('afterbegin', banner);
            }
        }

        setTimeout(() => {
            window.location.href = '/admin.html?denied=farmer';
        }, 1200);
    }

    setupEventListeners() {
        // Sidebar toggle button (same pattern as admin.js)
        const toggleBtn = document.getElementById('farmer-sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.body.classList.toggle('toggle-sidebar');
            });
        }

        // Sidebar overlay — clicking backdrop closes sidebar on mobile
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            document.body.classList.remove('toggle-sidebar');
        });

        document.getElementById('add-product-form')?.addEventListener('submit', (e) => this.handleAddProduct(e));
        document.getElementById('edit-product-form')?.addEventListener('submit', (e) => this.handleEditProduct(e));
        document.getElementById('save-shop-profile-btn')?.addEventListener('click', (e) => this.handleShopProfileUpdate(e));

        const editShopBtn = document.getElementById('edit-shop-profile-btn');
        if (editShopBtn) {
            editShopBtn.addEventListener('click', () => this.setShopProfileEditMode(true));
        }
        const cancelShopBtn = document.getElementById('cancel-shop-profile-btn');
        if (cancelShopBtn) {
            cancelShopBtn.addEventListener('click', () => this.cancelShopProfileEdit());
        }

        // Shop address modal
        this.initShopPsgc();
        const shopAddrModal = document.getElementById('shop-address-modal');
        const openShopAddrBtn = document.getElementById('open-shop-address-modal');
        const closeShopAddrBtn = document.getElementById('close-shop-address-modal');
        const cancelShopAddrBtn = document.getElementById('cancel-shop-address-modal');
        const confirmShopAddrBtn = document.getElementById('confirm-shop-address-modal');
        const openShopAddr = async () => {
            const currentLocation = document.getElementById('shop-location-input')?.value?.trim() || '';
            const zoneEl = document.getElementById('shop-location-zone');
            const provinceEl = document.getElementById('shop-location-province');
            const cityEl = document.getElementById('shop-location-city');
            const barangayEl = document.getElementById('shop-location-barangay');
            const streetEl = document.getElementById('shop-location-street');
            const previewEl = document.getElementById('shop-location-full');

            // Reset fields first
            if (zoneEl) zoneEl.value = '';
            if (provinceEl) { provinceEl.value = ''; provinceEl.disabled = true; }
            if (cityEl) { cityEl.value = ''; cityEl.disabled = true; }
            if (barangayEl) { barangayEl.value = ''; barangayEl.disabled = true; }
            if (streetEl) streetEl.value = '';
            if (previewEl) previewEl.value = currentLocation;

            // Parse existing address into PSGC fields if possible
            if (currentLocation && window.PSGC) {
                try {
                    const parsed = window.PSGC.parseAddress(currentLocation);
                    if (parsed) {
                        if (zoneEl) zoneEl.value = parsed.zone || '';
                        if (provinceEl) provinceEl.value = parsed.province || '';
                        if (cityEl) cityEl.value = parsed.city || '';
                        if (barangayEl) barangayEl.value = parsed.barangay || '';
                        if (streetEl) streetEl.value = parsed.street || '';

                        // Trigger cascades to populate dependent dropdowns
                        if (parsed.zone && zoneEl) {
                            await window.PSGC.onZoneChange(parsed.zone, { provinceEl, cityEl, barangayEl }).catch(() => {});
                            if (provinceEl) provinceEl.disabled = false;
                        }
                        if (parsed.province && provinceEl) {
                            await window.PSGC.onProvinceChange(parsed.province, { cityEl, barangayEl }).catch(() => {});
                            if (cityEl) cityEl.disabled = false;
                        }
                        if (parsed.city && cityEl) {
                            await window.PSGC.loadBarangays(parsed.city, barangayEl).catch(() => {});
                            if (barangayEl) barangayEl.disabled = false;
                        }

                        // Re-apply parsed values after cascades (dropdowns may have been repopulated)
                        if (zoneEl) zoneEl.value = parsed.zone || '';
                        if (provinceEl) provinceEl.value = parsed.province || '';
                        if (cityEl) cityEl.value = parsed.city || '';
                        if (barangayEl) barangayEl.value = parsed.barangay || '';
                        if (streetEl) streetEl.value = parsed.street || '';
                        if (previewEl) {
                            previewEl.value = window.PSGC.formatAddress({
                                street: parsed.street || '',
                                barangay: parsed.barangay || '',
                                city: parsed.city || '',
                                province: parsed.province || ''
                            });
                        }
                    }
                } catch (_) {
                    // If parsing fails, just show the raw address in preview
                }
            }

            shopAddrModal?.classList.add('open');
        };
        const closeShopAddr = () => shopAddrModal?.classList.remove('open');
        if (openShopAddrBtn) openShopAddrBtn.addEventListener('click', () => openShopAddr());
        if (closeShopAddrBtn) closeShopAddrBtn.addEventListener('click', closeShopAddr);
        if (cancelShopAddrBtn) cancelShopAddrBtn.addEventListener('click', closeShopAddr);
        if (confirmShopAddrBtn) confirmShopAddrBtn.addEventListener('click', () => {
            const previewEl = document.getElementById('shop-location-full');
            const displayEl = document.getElementById('shop-location-input');
            if (displayEl && previewEl) displayEl.value = previewEl.value;
            closeShopAddr();
        });

        const productsSearchInput = document.getElementById('products-search-input');
        if (productsSearchInput) {
            productsSearchInput.addEventListener('input', () => this.filterProducts());
        }

        const ordersSearchInput = document.getElementById('orders-search-input');
        if (ordersSearchInput) {
            ordersSearchInput.addEventListener('input', () => {
                this.applyOrdersSearch();
            });
            ordersSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyOrdersSearch();
                }
            });
        }

        const ordersSearchBtn = document.getElementById('orders-search-btn');
        if (ordersSearchBtn) {
            ordersSearchBtn.addEventListener('click', () => this.applyOrdersSearch());
        }

        const ordersRefreshBtn = document.getElementById('orders-refresh-btn');
        if (ordersRefreshBtn) {
            ordersRefreshBtn.addEventListener('click', () => {
                document.getElementById('orders-search-input').value = '';
                this.applyOrdersSearch();
            });
        }

        const accountBtn = document.getElementById('farmer-account-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => this.openAccountPanel());
        }

        const setupAccountDropdown = (buttonId, menuId) => {
            const userAccountBtn = document.getElementById(buttonId);
            const userDropdownMenu = document.getElementById(menuId);
            if (!(userAccountBtn && userDropdownMenu)) return;

            userAccountBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isOpen = userDropdownMenu.style.display === 'block';
                userDropdownMenu.style.display = isOpen ? 'none' : 'block';
                userAccountBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            });

            document.addEventListener('click', (e) => {
                if (!userDropdownMenu.contains(e.target) && !userAccountBtn.contains(e.target)) {
                    userDropdownMenu.style.display = 'none';
                    userAccountBtn.setAttribute('aria-expanded', 'false');
                }
            });
        };

        setupAccountDropdown('farmer-user-account-btn', 'farmer-user-dropdown-menu');
        setupAccountDropdown('farmer-sidebar-account-btn', 'farmer-sidebar-dropdown-menu');

        const myAccountDropdownBtn = document.getElementById('farmer-my-account-btn');
        if (myAccountDropdownBtn) {
            myAccountDropdownBtn.addEventListener('click', () => {
                const topMenu = document.getElementById('farmer-user-dropdown-menu');
                const topBtn = document.getElementById('farmer-user-account-btn');
                if (topMenu) topMenu.style.display = 'none';
                if (topBtn) topBtn.setAttribute('aria-expanded', 'false');
                this.openAccountPanel();
            });
        }

        const sidebarMyAccountBtn = document.getElementById('farmer-sidebar-my-account-btn');
        if (sidebarMyAccountBtn) {
            sidebarMyAccountBtn.addEventListener('click', () => {
                const sideMenu = document.getElementById('farmer-sidebar-dropdown-menu');
                const sideBtn = document.getElementById('farmer-sidebar-account-btn');
                if (sideMenu) sideMenu.style.display = 'none';
                if (sideBtn) sideBtn.setAttribute('aria-expanded', 'false');
                this.openAccountPanel();
            });
        }

        const logoutDropdownBtn = document.getElementById('farmer-logout-menu-btn');
        if (logoutDropdownBtn) {
            logoutDropdownBtn.addEventListener('click', () => this.logout());
        }

        const sidebarLogoutBtn = document.getElementById('farmer-sidebar-logout-btn');
        if (sidebarLogoutBtn) {
            sidebarLogoutBtn.addEventListener('click', () => this.logout());
        }

        // KPI card period filters (removed from HTML, keeping for reference)
        // document.addEventListener('click', (e) => {
        //     const link = e.target.closest('.kpi-period-filter');
        //     if (!link) return;
        //     e.preventDefault();
        //     const card = link.dataset.card;
        //     const period = link.dataset.period;
        //     if (card && period) {
        //         const dropdown = link.closest('.dropdown-menu');
        //         if (dropdown) {
        //             dropdown.querySelectorAll('.kpi-period-filter').forEach(item => item.classList.remove('active'));
        //             link.classList.add('active');
        //         }
        //         this._kpiPeriods[card] = period;
        //         this._syncAllPeriods(period);
        //         this.loadOverviewMetrics({ force: true });
        //     }
        // });

        // Reports chart period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.report-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
        });

        // Status chart period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.status-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
        });

        // Total orders period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.total-orders-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
        });

        // Items sold period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.items-sold-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
        });

        // Total revenue period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.total-revenue-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
        });


        // Entries-per-page change handlers
        document.querySelectorAll('select[data-entries-section]').forEach(sel => {
            sel.addEventListener('change', () => {
                const section = sel.dataset.entriesSection;
                const pg = this.pagination[section];
                if (pg) {
                    pg.limit = Number(sel.value) || 5;
                    pg.page = 1;
                    if (section === 'products') {
                        this.loadMyProducts();
                    } else {
                        this.loadOverviewMetrics({ force: true });
                    }
                }
            });
        });

        // Tab switching
        document.getElementById('list-products-tab')?.addEventListener('click', () => this.switchTab('list-products'));
        document.getElementById('add-product-tab')?.addEventListener('click', () => {
            this.openAddProductModal();
        });

        const addProductModal = document.getElementById('add-product-modal');
        const closeAddProductModalBtn = document.getElementById('close-add-product-modal');
        const cancelAddProductBtn = document.getElementById('cancel-add-product-btn');
        if (closeAddProductModalBtn) {
            closeAddProductModalBtn.addEventListener('click', () => this.closeAddProductModal());
        }
        if (cancelAddProductBtn) {
            cancelAddProductBtn.addEventListener('click', () => this.closeAddProductModal());
        }

        const customerRatingModal = document.getElementById('customer-rating-modal');
        const customerRatingClose = document.getElementById('customer-rating-close');
        const customerRatingCancel = document.getElementById('customer-rating-cancel');
        const customerRatingForm = document.getElementById('customer-rating-form');
        if (customerRatingClose) {
            customerRatingClose.addEventListener('click', () => this.closeCustomerRatingModal());
        }
        if (customerRatingCancel) {
            customerRatingCancel.addEventListener('click', () => this.closeCustomerRatingModal());
        }
        if (customerRatingForm) {
            customerRatingForm.addEventListener('submit', (e) => this.submitCustomerRatingForm(e));
        }
        if (customerRatingModal) {
            customerRatingModal.addEventListener('click', (e) => {
                if (e.target === customerRatingModal) {
                    this.closeCustomerRatingModal();
                }
            });
        }

        document.querySelectorAll('#customer-rating-modal .order-rating-star-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const rating = Number(btn.getAttribute('data-rating') || 0);
                this.setCustomerRatingValue(rating);
            });
        });

        // Order status tabs - all 6 statuses
        document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
        document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
        document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
        document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));

        // Product filters (updated for table layout)
        document.getElementById('product-category-filter')?.addEventListener('change', () => this.filterProducts());
        document.getElementById('product-status-filter')?.addEventListener('change', () => this.filterProducts());
        document.getElementById('products-search-btn')?.addEventListener('click', () => this.filterProducts());
        document.getElementById('products-refresh-btn')?.addEventListener('click', () => this.loadMyProducts());
        
        // Optional refresh buttons (check if they exist)
        const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
        if (refreshOrdersBtn) {
            refreshOrdersBtn.addEventListener('click', () => this.loadMyOrders());
        }
        
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => this.closeEditModal(true));
        }
        const closeEditModalBtn = document.querySelector('#edit-product-modal .close-btn');
        if (closeEditModalBtn) {
            closeEditModalBtn.addEventListener('click', () => this.closeEditModal(true));
        }

        const addImageInput = document.getElementById('product-image');
        if (addImageInput) {
            addImageInput.addEventListener('change', () => this.previewImage(addImageInput, 'product-image-preview'));
        }
        const editImageInput = document.getElementById('edit-product-image');
        if (editImageInput) {
            editImageInput.addEventListener('change', () => this.previewImage(editImageInput, 'edit-product-image-preview'));
        }

        // Initialize PSGC for product location (shared for add and edit)
        this.initProductPsgc();

        // Product address modal controls (shared for add and edit)
        const openAddAddrBtn = document.getElementById('open-add-product-address-modal');
        const openEditAddrBtn = document.getElementById('open-edit-product-address-modal');
        const closeAddrBtn = document.getElementById('close-product-address-modal');
        const cancelAddrBtn = document.getElementById('cancel-product-address-modal');
        const confirmAddrBtn = document.getElementById('confirm-product-address-modal');
        const addrModal = document.getElementById('product-address-modal');

        const openAddrModal = async (targetDisplayId) => {
            this.currentAddressTarget = targetDisplayId;
            const currentLocation = document.getElementById(targetDisplayId)?.value?.trim() || '';
            const zoneEl = document.getElementById('product-location-zone');
            const provinceEl = document.getElementById('product-location-province');
            const cityEl = document.getElementById('product-location-city');
            const barangayEl = document.getElementById('product-location-barangay');
            const streetEl = document.getElementById('product-location-street');
            const previewEl = document.getElementById('product-location-full');

            // Reset fields first
            if (zoneEl) zoneEl.value = '';
            if (provinceEl) { provinceEl.value = ''; provinceEl.disabled = true; }
            if (cityEl) { cityEl.value = ''; cityEl.disabled = true; }
            if (barangayEl) { barangayEl.value = ''; barangayEl.disabled = true; }
            if (streetEl) streetEl.value = '';
            if (previewEl) previewEl.value = currentLocation;

            // Parse existing address into PSGC fields if possible
            if (currentLocation && window.PSGC) {
                try {
                    const parsed = window.PSGC.parseAddress(currentLocation);
                    if (parsed) {
                        if (zoneEl) zoneEl.value = parsed.zone || '';
                        if (provinceEl) provinceEl.value = parsed.province || '';
                        if (cityEl) cityEl.value = parsed.city || '';
                        if (barangayEl) barangayEl.value = parsed.barangay || '';
                        if (streetEl) streetEl.value = parsed.street || '';

                        // Trigger cascades to populate dependent dropdowns
                        if (parsed.zone && zoneEl) {
                            await window.PSGC.onZoneChange(parsed.zone, { provinceEl, cityEl, barangayEl }).catch(() => {});
                            if (provinceEl) provinceEl.disabled = false;
                        }
                        if (parsed.province && provinceEl) {
                            await window.PSGC.onProvinceChange(parsed.province, { cityEl, barangayEl }).catch(() => {});
                            if (cityEl) cityEl.disabled = false;
                        }
                        if (parsed.city && cityEl) {
                            await window.PSGC.loadBarangays(parsed.city, barangayEl).catch(() => {});
                            if (barangayEl) barangayEl.disabled = false;
                        }

                        // Re-apply parsed values after cascades (dropdowns may have been repopulated)
                        if (zoneEl) zoneEl.value = parsed.zone || '';
                        if (provinceEl) provinceEl.value = parsed.province || '';
                        if (cityEl) cityEl.value = parsed.city || '';
                        if (barangayEl) barangayEl.value = parsed.barangay || '';
                        if (streetEl) streetEl.value = parsed.street || '';
                        if (previewEl) {
                            previewEl.value = window.PSGC.formatAddress({
                                street: parsed.street || '',
                                barangay: parsed.barangay || '',
                                city: parsed.city || '',
                                province: parsed.province || ''
                            });
                        }
                    }
                } catch (_) {
                    // If parsing fails, just show the raw address in preview
                }
            }

            addrModal?.classList.add('open');
        };
        const closeAddrModal = () => addrModal?.classList.remove('open');

        if (openAddAddrBtn) openAddAddrBtn.addEventListener('click', () => openAddrModal('product-location-display'));
        if (openEditAddrBtn) openEditAddrBtn.addEventListener('click', () => openAddrModal('edit-product-location-display'));
        if (closeAddrBtn) closeAddrBtn.addEventListener('click', closeAddrModal);
        if (cancelAddrBtn) cancelAddrBtn.addEventListener('click', closeAddrModal);
        if (confirmAddrBtn) confirmAddrBtn.addEventListener('click', () => {
            const previewEl = document.getElementById('product-location-full');
            const displayEl = document.getElementById(this.currentAddressTarget || 'edit-product-location-display');
            if (displayEl && previewEl) displayEl.value = previewEl.value;
            closeAddrModal();
        });

        const previewModal = document.getElementById('farmer-product-preview-modal');
        const previewCloseBtn = document.getElementById('farmer-product-preview-close');
        if (previewCloseBtn) previewCloseBtn.addEventListener('click', () => this.closeMyProductPreview());

        // Product edit button (event delegation)
        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.product-edit-btn');
            if (editBtn) {
                const productId = Number(editBtn.getAttribute('data-product-id'));
                if (productId && !isNaN(productId)) {
                    this.editProduct(productId);
                }
            }
        });

        // Detail panel actions (event delegation)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;

            const action = btn.getAttribute('data-action');
            

            if (action === 'item-status') {
                const orderId = Number(btn.getAttribute('data-order-id'));
                const orderItemId = Number(btn.getAttribute('data-order-item-id'));
                const status = btn.getAttribute('data-status');
                if (!orderId || isNaN(orderId) || !status) {
                    console.error('Invalid order update parameters:', { orderId, orderItemId, status });
                    this.showMessage('Invalid order information. Please refresh the page.', 'error');
                    return;
                }
                // In per-item system, orderItemId should equal orderId, but use orderId if orderItemId is invalid
                const actualOrderItemId = (orderItemId && !isNaN(orderItemId)) ? orderItemId : orderId;
                this.updateOrderItemStatus(orderId, actualOrderItemId, status);
            }

            if (action === 'chat-customer') {
                const customerId = Number(btn.getAttribute('data-customer-id'));
                const orderId = Number(btn.getAttribute('data-order-id'));
                if (!customerId) return;
                this.openChatWithCustomer(customerId, orderId || null);
            }

            if (action === 'rate-customer') {
                const orderId = Number(btn.getAttribute('data-order-id'));
                if (!orderId) return;
                this.rateCustomerForOrder(orderId);
            }

            if (action === 'view-order') {
                const orderId = Number(btn.getAttribute('data-order-id'));
                if (!orderId) return;
                this.openOrderDetails(orderId);
            }
        });

        // Initialize date rules for product forms
        this.setupProductDateConstraints();

        // Batch action bar (removed from HTML, keeping for reference)
        // const batchSelectAll = document.getElementById('batch-select-all');
        // if (batchSelectAll) {
        //     batchSelectAll.addEventListener('change', () => {
        //         const checked = batchSelectAll.checked;
        //         document.querySelectorAll('#my-products-grid .product-select-cb').forEach(cb => {
        //             cb.checked = checked;
        //         });
        //         this.updateBatchBar();
        //     });
        // }
        // document.getElementById('batch-mark-available-btn')?.addEventListener('click', () => this.handleBatchAction('available'));
        // document.getElementById('batch-mark-soldout-btn')?.addEventListener('click', () => this.handleBatchAction('soldout'));
        // document.getElementById('batch-delete-btn')?.addEventListener('click', () => this.handleBatchAction('delete'));
        // document.getElementById('batch-cancel-btn')?.addEventListener('click', () => {
        //     document.querySelectorAll('#my-products-grid .product-select-cb').forEach(cb => { cb.checked = false; });
        //     const batchAll = document.getElementById('batch-select-all');
        //     if (batchAll) batchAll.checked = false;
        //     this.updateBatchBar();
        // });
    }

    async loadProductCatalogNames(categoryId = null) {
        try {
            const fetchNames = async (targetCategoryId = null, retryOn404 = true) => {
                const params = new URLSearchParams();
                if (targetCategoryId) params.set('category_id', String(targetCategoryId));
                const response = await fetch(`${this.apiBase}/products/catalog/names${params.toString() ? `?${params.toString()}` : ''}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (response.status === 404 && retryOn404) {
                    const switched = await this.resolveWorkingApiBase();
                    if (switched) return fetchNames(targetCategoryId, false);
                }
                if (!response.ok) return [];
                const data = await response.json().catch(() => ({}));
                return Array.isArray(data.names) ? data.names : [];
            };

            // Use selected category names first, then include global names as fallback
            // so known items like "Malunggay" are still discoverable in dropdown.
            const scopedNames = await fetchNames(categoryId || null);
            const globalNames = categoryId ? await fetchNames(null) : [];
            const merged = [];
            const seen = new Set();
            for (const name of [...scopedNames, ...globalNames]) {
                const normalized = String(name || '').trim();
                if (!normalized) continue;
                const key = normalized.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                merged.push(normalized);
            }

            this.catalogProductNames = merged;
            this.renderProductNameSuggestions('add');
            this.renderProductNameSuggestions('edit');
        } catch (error) {
            console.error('Error loading product catalog names:', error);
        }
    }

    renderProductNameSuggestions(mode = 'add', forceAll = false) {
        const isEdit = mode === 'edit';
        const nameInput = document.getElementById(isEdit ? 'edit-product-name' : 'product-name');
        const listEl = document.getElementById(isEdit ? 'edit-product-name-suggestions' : 'product-name-suggestions');
        if (!nameInput || !listEl) return;

        if (nameInput.disabled) {
            listEl.classList.remove('open');
            listEl.innerHTML = '';
            return;
        }

        const isAlreadyOpen = listEl.classList.contains('open');
        const query = forceAll ? '' : String(nameInput.value || '').trim().toLowerCase();
        const source = Array.isArray(this.catalogProductNames) ? this.catalogProductNames : [];
        const matches = source
            .filter((name) => !query || String(name).toLowerCase().includes(query))
            .slice(0, 10);

        if (!matches.length) {
            listEl.classList.remove('open');
            listEl.innerHTML = '';
            return;
        }

        const currentValue = String(nameInput.value || '').trim().toLowerCase();
        listEl.innerHTML = matches.map((name) => {
            const isSelected = currentValue && String(name).toLowerCase() === currentValue;
            return `<button type="button" class="product-name-option${isSelected ? ' selected' : ''}" data-name="${this.escapeAttr(name)}">${this.escapeHtml(name)}</button>`;
        }).join('');
        // Only open dropdown when user explicitly triggered it (forceAll) or it was already open
        if (forceAll || isAlreadyOpen) {
            listEl.classList.add('open');
        }
        this.productNameActiveIndex[mode] = -1;

        listEl.querySelectorAll('.product-name-option').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const selected = String(btn.getAttribute('data-name') || '').trim();
                nameInput.value = selected;
                listEl.classList.remove('open');
                this.updatePriceSuggestion(mode);
            });
        });
    }

    handleProductNameKeydown(mode = 'add', e) {
        const isEdit = mode === 'edit';
        const listEl = document.getElementById(isEdit ? 'edit-product-name-suggestions' : 'product-name-suggestions');
        const nameInput = document.getElementById(isEdit ? 'edit-product-name' : 'product-name');
        if (!listEl || !nameInput) return;

        const options = Array.from(listEl.querySelectorAll('.product-name-option'));
        if (!listEl.classList.contains('open') || !options.length) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.renderProductNameSuggestions(mode, true);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.productNameActiveIndex[mode] = (this.productNameActiveIndex[mode] + 1) % options.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.productNameActiveIndex[mode] = (this.productNameActiveIndex[mode] - 1 + options.length) % options.length;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const index = this.productNameActiveIndex[mode];
            if (index >= 0 && index < options.length) {
                const selected = String(options[index].getAttribute('data-name') || '').trim();
                nameInput.value = selected;
                listEl.classList.remove('open');
                this.updatePriceSuggestion(mode);
            }
            return;
        } else if (e.key === 'Escape') {
            listEl.classList.remove('open');
            return;
        } else {
            return;
        }

        options.forEach((option, idx) => option.classList.toggle('active', idx === this.productNameActiveIndex[mode]));
        const current = options[this.productNameActiveIndex[mode]];
        if (current) current.scrollIntoView({ block: 'nearest' });
    }

    setupCustomSelectDropdown(fieldId) {
        const input = document.getElementById(fieldId);
        const dropdown = document.getElementById(`${fieldId}-dropdown`);
        if (!input || !dropdown) return;

        const toggleDropdown = () => {
            dropdown.classList.toggle('open');
        };

        const selectOption = (btn) => {
            const value = btn.getAttribute('data-value');
            const label = btn.getAttribute('data-label');
            input.value = label;
            input.dataset.value = value;
            dropdown.classList.remove('open');
            dropdown.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
            btn.classList.add('selected');
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        input.addEventListener('click', toggleDropdown);
        input.addEventListener('focus', () => {
            if (!dropdown.classList.contains('open')) toggleDropdown();
        });

        dropdown.querySelectorAll('.custom-select-option').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectOption(btn);
            });
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    initUnitDropdowns() {
        const units = [
            { value: 'kg', label: 'Kilogram (kg)' },
            { value: 'pieces', label: 'Pieces' },
            { value: 'boxes', label: 'Boxes' },
            { value: 'bundle', label: 'Bundle' },
            { value: 'sack', label: 'Sack' },
            { value: 'tray', label: 'Tray' },
            { value: 'liter', label: 'Liter (L)' }
        ];

        const renderUnitOptions = (selected = '') => {
            return units.map(unit => {
                const isSelected = String(selected) === unit.value ? 'selected' : '';
                return `<button type="button" class="custom-select-option${isSelected ? ' selected' : ''}" data-value="${this.escapeAttr(unit.value)}" data-label="${this.escapeAttr(unit.label)}">${this.escapeHtml(unit.label)}</button>`;
            }).join('');
        };

        const addInput = document.getElementById('product-unit');
        const addDropdown = document.getElementById('product-unit-dropdown');
        const editInput = document.getElementById('edit-product-unit');
        const editDropdown = document.getElementById('edit-product-unit-dropdown');

        if (addDropdown) {
            addDropdown.innerHTML = renderUnitOptions(addInput?.value || '');
            this.setupCustomSelectDropdown('product-unit');
        }
        if (editDropdown) {
            editDropdown.innerHTML = renderUnitOptions(editInput?.value || '');
            this.setupCustomSelectDropdown('edit-product-unit');
        }
    }

    initProductPsgc() {
        const initPsgc = async () => {
            const psgc = await this.waitForPsgc();
            const zoneEl = document.getElementById('product-location-zone');
            const provinceEl = document.getElementById('product-location-province');
            const cityEl = document.getElementById('product-location-city');
            const barangayEl = document.getElementById('product-location-barangay');
            const streetEl = document.getElementById('product-location-street');
            const previewEl = document.getElementById('product-location-full');

            if (!psgc) {
                if (zoneEl) {
                    zoneEl.innerHTML = '<option value="">Address options unavailable</option>';
                    zoneEl.disabled = true;
                }
                return;
            }

            const updatePreview = () => {
                if (!previewEl) return;
                const prov = provinceEl?.value?.trim() || '';
                const city = cityEl?.value?.trim() || '';
                const bgy  = barangayEl?.value?.trim() || '';
                const str  = streetEl?.value?.trim() || '';
                previewEl.value = psgc.formatAddress({ street: str, barangay: bgy, city, province: prov });
            };

            if (zoneEl) {
                psgc.loadZones(zoneEl);
                zoneEl.addEventListener('change', async () => {
                    await psgc.onZoneChange(zoneEl.value, { provinceEl, cityEl, barangayEl }).catch(() => {});
                    updatePreview();
                });
            }
            if (provinceEl) {
                provinceEl.addEventListener('change', async () => {
                    await psgc.onProvinceChange(provinceEl.value, { cityEl, barangayEl }).catch(() => {});
                    updatePreview();
                });
            }
            if (cityEl) {
                cityEl.addEventListener('change', async () => {
                    const city = cityEl.value;
                    if (city) {
                        await psgc.loadBarangays(city, barangayEl).catch(() => {});
                        if (barangayEl) barangayEl.disabled = false;
                    } else {
                        psgc.setSelectOptions(barangayEl, [], 'Select Barangay');
                        if (barangayEl) barangayEl.disabled = true;
                    }
                    updatePreview();
                });
            }
            if (barangayEl) barangayEl.addEventListener('change', updatePreview);
            if (streetEl) streetEl.addEventListener('input', updatePreview);
        };

        initPsgc();
    }

    initShopPsgc() {
        const initPsgc = async () => {
            const psgc = await this.waitForPsgc();
            const zoneEl = document.getElementById('shop-location-zone');
            const provinceEl = document.getElementById('shop-location-province');
            const cityEl = document.getElementById('shop-location-city');
            const barangayEl = document.getElementById('shop-location-barangay');
            const streetEl = document.getElementById('shop-location-street');
            const previewEl = document.getElementById('shop-location-full');

            if (!psgc) {
                if (zoneEl) {
                    zoneEl.innerHTML = '<option value="">Address options unavailable</option>';
                    zoneEl.disabled = true;
                }
                return;
            }

            const updatePreview = () => {
                if (!previewEl) return;
                const prov = provinceEl?.value?.trim() || '';
                const city = cityEl?.value?.trim() || '';
                const bgy  = barangayEl?.value?.trim() || '';
                const str  = streetEl?.value?.trim() || '';
                previewEl.value = psgc.formatAddress({ street: str, barangay: bgy, city, province: prov });
            };

            if (zoneEl) {
                psgc.loadZones(zoneEl);
                zoneEl.addEventListener('change', async () => {
                    await psgc.onZoneChange(zoneEl.value, { provinceEl, cityEl, barangayEl }).catch(() => {});
                    updatePreview();
                });
            }
            if (provinceEl) {
                provinceEl.addEventListener('change', async () => {
                    await psgc.onProvinceChange(provinceEl.value, { cityEl, barangayEl }).catch(() => {});
                    updatePreview();
                });
            }
            if (cityEl) {
                cityEl.addEventListener('change', async () => {
                    const city = cityEl.value;
                    if (city) {
                        await psgc.loadBarangays(city, barangayEl).catch(() => {});
                        if (barangayEl) barangayEl.disabled = false;
                    } else {
                        psgc.setSelectOptions(barangayEl, [], 'Select Barangay');
                        if (barangayEl) barangayEl.disabled = true;
                    }
                    updatePreview();
                });
            }
            if (barangayEl) barangayEl.addEventListener('change', updatePreview);
            if (streetEl) streetEl.addEventListener('input', updatePreview);
        };

        initPsgc();
    }

    async loadCategories() {
        try {
            const response = await fetch(`${this.apiBase}/products/categories`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.status === 404) {
                const switched = await this.resolveWorkingApiBase();
                if (switched) {
                    return this.loadCategories();
                }
            }
            if (!response.ok) return;

            const data = await response.json();
            const categories = Array.isArray(data.categories) ? data.categories : [];

            const renderCustomOptions = (selectedId = '') => {
                return categories.map((category) => {
                    const value = String(category.id);
                    const isSelected = String(selectedId) === value ? 'selected' : '';
                    return `<button type="button" class="custom-select-option${isSelected ? ' selected' : ''}" data-value="${this.escapeAttr(value)}" data-label="${this.escapeAttr(category.name || 'Category')}">${this.escapeHtml(category.name || 'Category')}</button>`;
                }).join('');
            };

            const addInput = document.getElementById('product-category');
            const addDropdown = document.getElementById('product-category-dropdown');
            const editInput = document.getElementById('edit-product-category');
            const editDropdown = document.getElementById('edit-product-category-dropdown');

            if (addDropdown) {
                addDropdown.innerHTML = renderCustomOptions(addInput?.value || '');
                this.setupCustomSelectDropdown('product-category');
            }
            if (editDropdown) {
                editDropdown.innerHTML = renderCustomOptions(editInput?.value || '');
                this.setupCustomSelectDropdown('edit-product-category');
            }

            await this.loadProductCatalogNames(addInput?.value || null);
            this.syncProductNameAvailability('add');
            this.syncProductNameAvailability('edit');
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    syncProductNameAvailability(mode = 'add') {
        const isEdit = mode === 'edit';
        const categoryInput = document.getElementById(isEdit ? 'edit-product-category' : 'product-category');
        const nameInput = document.getElementById(isEdit ? 'edit-product-name' : 'product-name');
        const hint = document.getElementById(isEdit ? 'edit-product-price-suggestion' : 'product-price-suggestion');
        if (!nameInput) return;

        const categoryId = String(categoryInput?.dataset.value || categoryInput?.value || '').trim();
        const hasCategory = !!categoryId;
        nameInput.disabled = !hasCategory;
        nameInput.readOnly = true;
        if (!hasCategory) {
            nameInput.value = '';
            nameInput.placeholder = 'Choose category first';
            if (hint) hint.textContent = 'Suggested lowest price: —';
            // Clear dropdown
            const listEl = document.getElementById(isEdit ? 'edit-product-name-suggestions' : 'product-name-suggestions');
            if (listEl) {
                listEl.classList.remove('open');
                listEl.innerHTML = '';
            }
            return;
        }

        nameInput.placeholder = 'Select product name';
    }

    setupProductSuggestionListeners() {
        const addName = document.getElementById('product-name');
        const editName = document.getElementById('edit-product-name');
        const addCategory = document.getElementById('product-category');
        const editCategory = document.getElementById('edit-product-category');
        const addUnit = document.getElementById('product-unit');
        const editUnit = document.getElementById('edit-product-unit');

        if (addName) {
            addName.readOnly = true;
            addName.addEventListener('change', () => this.updatePriceSuggestion('add'));
            addName.addEventListener('blur', () => this.updatePriceSuggestion('add'));
            addName.addEventListener('focus', () => this.renderProductNameSuggestions('add', true));
            addName.addEventListener('keydown', (e) => this.handleProductNameKeydown('add', e));
            addName.addEventListener('click', () => this.renderProductNameSuggestions('add', true));
            addName.addEventListener('blur', () => setTimeout(() => {
                const list = document.getElementById('product-name-suggestions');
                if (list) list.classList.remove('open');
            }, 120));
        }
        if (editName) {
            editName.readOnly = true;
            editName.addEventListener('change', () => this.updatePriceSuggestion('edit'));
            editName.addEventListener('blur', () => this.updatePriceSuggestion('edit'));
            editName.addEventListener('focus', () => this.renderProductNameSuggestions('edit', true));
            editName.addEventListener('keydown', (e) => this.handleProductNameKeydown('edit', e));
            editName.addEventListener('click', () => this.renderProductNameSuggestions('edit', true));
            editName.addEventListener('blur', () => setTimeout(() => {
                const list = document.getElementById('edit-product-name-suggestions');
                if (list) list.classList.remove('open');
            }, 120));
        }
        if (addCategory) addCategory.addEventListener('change', async () => {
            this.syncProductNameAvailability('add');
            await this.loadProductCatalogNames(addCategory.dataset.value || addCategory.value || null);
            this.updatePriceSuggestion('add');
        });
        if (editCategory) editCategory.addEventListener('change', async () => {
            const editNameEl = document.getElementById('edit-product-name');
            if (editNameEl) editNameEl.value = '';
            this.syncProductNameAvailability('edit');
            await this.loadProductCatalogNames(editCategory.dataset.value || editCategory.value || null);
            this.updatePriceSuggestion('edit');
        });

        const addPrice = document.getElementById('product-price');
        if (addPrice) addPrice.addEventListener('focus', () => this.updatePriceSuggestion('add'));

        const editPrice = document.getElementById('edit-product-price');
        if (editPrice) editPrice.addEventListener('focus', () => this.updatePriceSuggestion('edit'));

        if (addUnit) {
            addUnit.addEventListener('change', () => this.updatePriceSuggestion('add'));
        }
        if (editUnit) {
            editUnit.addEventListener('change', () => this.updatePriceSuggestion('edit'));
        }

        this.syncProductNameAvailability('add');
        this.syncProductNameAvailability('edit');
    }

    async submitCustomProductRequest() {
        const categoryInput = document.getElementById('product-category');
        const categoryId = String(categoryInput?.dataset.value || categoryInput?.value || '').trim();
        const name = String(document.getElementById('custom-product-name-request')?.value || '').trim();
        const notes = String(document.getElementById('custom-product-request-notes')?.value || '').trim();

        if (!categoryId) {
            this.showMessage('Please choose a category first.', 'error');
            return;
        }
        if (!name) {
            this.showMessage('Please enter the product name you want to request.', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/products/category-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ category_id: Number(categoryId), name, notes })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Unable to submit request', 'error');
                return;
            }

            this.showMessage('Request submitted for staff approval.', 'success');
            const requestNameEl = document.getElementById('custom-product-name-request');
            const requestNotesEl = document.getElementById('custom-product-request-notes');
            if (requestNameEl) requestNameEl.value = '';
            if (requestNotesEl) requestNotesEl.value = '';
        } catch (error) {
            console.error('Submit custom product request error:', error);
            this.showMessage('Unable to submit request right now.', 'error');
        }
    }

    async updatePriceSuggestion(mode = 'add') {
        const isEdit = mode === 'edit';
        const nameInput = document.getElementById(isEdit ? 'edit-product-name' : 'product-name');
        const categoryInput = document.getElementById(isEdit ? 'edit-product-category' : 'product-category');
        const unitInput = document.getElementById(isEdit ? 'edit-product-unit' : 'product-unit');
        const priceInput = document.getElementById(isEdit ? 'edit-product-price' : 'product-price');
        const hint = document.getElementById(isEdit ? 'edit-product-price-suggestion' : 'product-price-suggestion');

        if (!nameInput || !hint) return;

        const name = String(nameInput.value || '').trim();
        const categoryId = String(categoryInput?.dataset?.value || categoryInput?.value || '').trim();
        const unit = String(unitInput?.value || '').trim();
        if (!name) {
            hint.textContent = 'Suggested lowest price: —';
            return;
        }

        try {
            hint.textContent = 'Suggested lowest price: checking...';
            const params = new URLSearchParams({ name });
            if (categoryId) params.set('category_id', categoryId);
            if (unit) params.set('unit', unit);

            const response = await fetch(`${this.apiBase}/products/pricing/suggestion?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                hint.textContent = 'Suggested lowest price: —';
                return;
            }

            const data = await response.json();
            const hasSystemSample = Number(data?.sample_count || 0) > 0;
            const lowest = hasSystemSample ? Number(data.suggested_lowest_price || 0) : 0;
            hint.textContent = lowest > 0
                ? `Suggested lowest price: ${this.fmtCurrency(lowest)}`
                : 'Suggested lowest price: —';

            if (priceInput && (!priceInput.value || Number(priceInput.value) <= 0) && lowest > 0) {
                priceInput.value = lowest.toFixed(2);
            }
        } catch (error) {
            console.error('Error updating price suggestion:', error);
            hint.textContent = 'Suggested lowest price: —';
        }
    }

    setupSidebarNavigation() {
        const links = document.querySelectorAll('.admin-sidebar .sidebar-link[data-section]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (!section) return;
                this.showSection(section);
                document.body.classList.remove('toggle-sidebar');
            });
        });

        // Initial section based on saved state, hash, or default
        const validSections = new Set(['overview', 'products', 'orders', 'chat', 'shop', 'reviews']);
        const savedSectionRaw = localStorage.getItem('farmerActiveSection');
        const savedSection = String(savedSectionRaw || '').trim();
        const hash = String((window.location.hash || '')).replace('#', '').trim();

        const initialSection = validSections.has(savedSection)
            ? savedSection
            : (validSections.has(hash) ? hash : 'overview');

        this.showSection(initialSection);
    }

    todayDateOnly() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    setInputError(el, on) {
        if (!el) return;
        el.classList.toggle('input-error', !!on);
    }

    setupProductDateConstraints() {
        const harvest = document.getElementById('harvest-date');
        const expiry = document.getElementById('expiry-date');
        const editHarvest = document.getElementById('edit-harvest-date');
        const editExpiry = document.getElementById('edit-expiry-date');

        const applyMin = (harvestEl, expiryEl) => {
            if (!harvestEl || !expiryEl) return;
            const today = this.todayDateOnly();
            harvestEl.min = today;

            const harvestVal = String(harvestEl.value || '').trim();
            if (harvestVal) {
                // Expiry must be after harvest (next day or later)
                const dt = new Date(`${harvestVal}T00:00:00`);
                if (!Number.isNaN(dt.getTime())) {
                    dt.setDate(dt.getDate() + 1);
                    const y = dt.getFullYear();
                    const m = String(dt.getMonth() + 1).padStart(2, '0');
                    const d = String(dt.getDate()).padStart(2, '0');
                    expiryEl.min = `${y}-${m}-${d}`;
                } else {
                    expiryEl.min = today;
                }
            } else {
                expiryEl.min = today;
            }
        };

        const attach = (harvestEl, expiryEl) => {
            if (!harvestEl || !expiryEl) return;
            applyMin(harvestEl, expiryEl);
            harvestEl.addEventListener('change', () => {
                applyMin(harvestEl, expiryEl);
                this.setInputError(harvestEl, false);
                this.setInputError(expiryEl, false);
            });
            expiryEl.addEventListener('change', () => {
                applyMin(harvestEl, expiryEl);
                this.setInputError(harvestEl, false);
                this.setInputError(expiryEl, false);
            });
        };

        attach(harvest, expiry);
        attach(editHarvest, editExpiry);
    }

    validateProductDates({ harvestEl, expiryEl }) {
        const harvestVal = String(harvestEl?.value || '').trim();
        const expiryVal = String(expiryEl?.value || '').trim();
        const today = this.todayDateOnly();

        this.setInputError(harvestEl, false);
        this.setInputError(expiryEl, false);
        // Dates are optional now. If neither provided, it's valid.
        if (!harvestVal && !expiryVal) return true;

        // If harvest provided, it cannot be in the past
        if (harvestVal) {
            if (harvestVal < today) {
                this.setInputError(harvestEl, true);
                this.showMessage('Expected Harvest Date cannot be in the past.', 'error');
                return false;
            }
        }

        // If expiry provided and harvest provided, expiry must be after harvest
        if (expiryVal && harvestVal) {
            if (expiryVal <= harvestVal) {
                this.setInputError(harvestEl, true);
                this.setInputError(expiryEl, true);
                this.showMessage('Best Before must be after the Expected Harvest Date.', 'error');
                return false;
            }
        }

        // If expiry provided alone, require it be in the future
        if (expiryVal && !harvestVal) {
            if (expiryVal <= today) {
                this.setInputError(expiryEl, true);
                this.showMessage('Best Before must be in the future.', 'error');
                return false;
            }
        }

        return true;
    }

    showSection(section) {
        const validSections = new Set(['overview', 'products', 'orders', 'chat', 'shop', 'reviews']);
        const normalized = String(section || '').trim();
        const safeSection = validSections.has(normalized) ? normalized : 'overview';

        this.activeSection = safeSection;
        // Save current section to localStorage
        localStorage.setItem('farmerActiveSection', safeSection);

        document.querySelectorAll('.admin-sidebar .sidebar-link[data-section]').forEach(a => {
            a.classList.toggle('active', a.getAttribute('data-section') === safeSection);
        });
        document.querySelectorAll('main.admin-main .admin-section-card').forEach(sec => {
            sec.classList.toggle('active', sec.id === safeSection);
        });

        const titles = {
            overview: 'Overview',
            products: 'My Products',
            orders: 'Order Management',
            chat: 'Chat',
            shop: 'Shop Profile',
            reviews: 'Reviews'
        };
        const titleEl = document.getElementById('farmer-page-title');
        if (titleEl) titleEl.textContent = titles[safeSection] || 'Overview';

        // Update breadcrumb
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbCurrent) {
            const breadcrumbLabels = {
                overview: 'Farmer Dashboard',
                products: 'My Products',
                orders: 'Order Management',
                reviews: 'Reviews',
                shop: 'Shop Profile',
                chat: 'Messages'
            };
            breadcrumbCurrent.textContent = breadcrumbLabels[safeSection] || 'Farmer Dashboard';
        }

        // Load data when switching to specific sections
        if (safeSection === 'orders') {
            this.loadMyOrders();
        } else if (safeSection === 'products') {
            this.switchTab('list-products');
            this.loadMyProducts();
        } else if (safeSection === 'overview') {
            this.loadOverviewMetrics();
            this.loadAnnouncements();
        } else if (safeSection === 'chat') {
            this.loadFarmerStats({ skipProducts: true });
        } else if (safeSection === 'shop') {
            this.loadShopProfile();
        } else if (safeSection === 'reviews') {
            if (!this._reviewsLoaded) {
                this._reviewsLoaded = true;
                this.loadReviews(1);
            }
        }

        // Update hash (non-destructive)
        try {
            window.history.replaceState({}, '', `#${safeSection}`);
        } catch (_) {
            // ignore
        }
    }

    setupDetailPanel() {
        const closeBtn = document.getElementById('close-farmer-panel');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDetailPanel());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeDetailPanel();
        });
    }

    openDetailPanel(html) {
        const panel = document.getElementById('farmer-detail-panel');
        const content = document.getElementById('farmer-detail-content');
        if (!panel || !content) return;
        content.innerHTML = html;
        panel.classList.add('active');
    }

    closeDetailPanel() {
        const panel = document.getElementById('farmer-detail-panel');
        if (!panel) return;
        panel.classList.remove('active');
    }

    async loadFarmerStats({ skipProducts = false } = {}) {
        try {
            if (!skipProducts) {
                if (!this.farmerId) return;
                // Load my products count
                const productsResponse = await fetch(`${this.apiBase}/products/farmer/${this.farmerId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (productsResponse.ok) {
                    const productsData = await productsResponse.json();
                    const availableProducts = (productsData.products || []).filter(p => {
                        const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
                        return isAvailable && p.status === 'approved';
                    });
                    const myProductsEl = document.getElementById('my-products');
                    if (myProductsEl) myProductsEl.textContent = this.fmtNumber(availableProducts.length);
                    const shopTotalProducts = document.getElementById('shop-total-products');
                    if (shopTotalProducts) {
                        shopTotalProducts.textContent = this.fmtNumber(availableProducts.length);
                    }
                }
            }

            // Load farmer stats
            const statsUrl = `${this.apiBase}/farmers/me/stats`;
            const statsResponse = await fetch(statsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                const unreadMessagesEl = document.getElementById('unread-messages');

                // Overview totals are rendered from /farmers/me/metrics so they match the delivered trend chart.
                // Avoid racing /me/stats updates that can cause the Revenue card and chart to disagree.
                if (this.activeSection !== 'overview') {
                    const totalOrdersEl = document.getElementById('total-orders');
                    const totalSoldEl = document.getElementById('total-sold');
                    const totalRevenueEl = document.getElementById('total-revenue');
                    if (totalOrdersEl) totalOrdersEl.textContent = this.fmtNumber(stats.total_orders ?? 0);
                    if (totalSoldEl) totalSoldEl.textContent = this.fmtNumber(stats.total_sold ?? 0);
                    if (totalRevenueEl) totalRevenueEl.textContent = this.fmtCurrency(stats.total_revenue || 0);
                }
                const unread = stats.unread_customers ?? 0;
                if (unreadMessagesEl) unreadMessagesEl.textContent = this.fmtNumber(unread);

                const chatBadge = document.getElementById('chat-unread-badge');
                if (chatBadge) {
                    chatBadge.textContent = this.fmtNumber(unread);
                    chatBadge.style.display = Number(unread) > 0 ? 'inline-flex' : 'none';
                }
            }

        } catch (error) {
            console.error('Error loading farmer stats:', error);
        }
    }

    async loadShopProfile() {
        try {
            const response = await fetch(`${this.apiBase}/farmers/${this.farmerId}/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const fallbackUser = this.authProfile || {};

            const getName = (p) => String((p?.full_name || p?.username || '')).trim();
            const getLocation = (p) => String((p?.location || p?.address || '')).trim();
            const getDesc = (p) => String((p?.shop_description || p?.shopDescription || p?.description || '')).trim();

            if (response.ok) {
                const data = await response.json();
                const profile = data.profile || {};
                this.currentShopProfile = profile;

                const displayName = getName(profile) || getName(fallbackUser) || '—';
                const displayLocation = getLocation(profile) || getLocation(fallbackUser) || 'Farm location not set';
                const displayDesc = getDesc(profile) || getDesc(fallbackUser) || 'No description yet.';
                
                // Populate read-only display fields
                const shopNameDisplay = document.getElementById('shop-name-display');
                if (shopNameDisplay) {
                    shopNameDisplay.textContent = displayName;
                }
                const shopLocationDisplay = document.getElementById('shop-location-display');
                if (shopLocationDisplay) {
                    shopLocationDisplay.innerHTML = `<i class="fas fa-location-dot"></i> <span>${this.escapeHtml(displayLocation)}</span>`;
                }
                const shopDescDisplay = document.getElementById('shop-description-display');
                if (shopDescDisplay) {
                    shopDescDisplay.textContent = displayDesc;
                }

                // Populate editable fields
                const shopNameInput = document.getElementById('shop-name-input');
                const shopLocationInput = document.getElementById('shop-location-input');
                const shopDescriptionInput = document.getElementById('shop-description-input');
                
                if (shopNameInput) {
                    const v = getName(profile) || getName(fallbackUser) || '';
                    shopNameInput.value = v;
                    shopNameInput.placeholder = v || displayName;
                }
                if (shopLocationInput) {
                    const v = getLocation(profile) || getLocation(fallbackUser) || '';
                    shopLocationInput.value = v;
                    shopLocationInput.placeholder = v || displayLocation;
                }
                if (shopDescriptionInput) {
                    const v = getDesc(profile) || getDesc(fallbackUser) || '';
                    shopDescriptionInput.value = v;
                    shopDescriptionInput.placeholder = v || displayDesc;
                }

                // Always default to view mode after loading
                this.setShopProfileEditMode(false);
            } else {
                // Fallback: show at least auth profile details
                const shopNameDisplay = document.getElementById('shop-name-display');
                if (shopNameDisplay) shopNameDisplay.textContent = fallbackUser.full_name || fallbackUser.username || '—';
                const shopLocationDisplay = document.getElementById('shop-location-display');
                if (shopLocationDisplay) {
                    const loc = fallbackUser.address || 'Farm location not set';
                    shopLocationDisplay.innerHTML = `<i class="fas fa-location-dot"></i> <span>${this.escapeHtml(loc)}</span>`;
                }
                const shopDescDisplay = document.getElementById('shop-description-display');
                if (shopDescDisplay) shopDescDisplay.textContent = (getDesc(fallbackUser) || 'No description yet.');

                // Ensure edit fields still reflect fallback
                const shopNameInput = document.getElementById('shop-name-input');
                const shopLocationInput = document.getElementById('shop-location-input');
                const shopDescriptionInput = document.getElementById('shop-description-input');
                if (shopNameInput) {
                    const v = getName(fallbackUser);
                    shopNameInput.value = v;
                    shopNameInput.placeholder = v || 'My Farm Shop';
                }
                if (shopLocationInput) {
                    const v = getLocation(fallbackUser);
                    shopLocationInput.value = v;
                    shopLocationInput.placeholder = v || 'Farm location not set';
                }
                if (shopDescriptionInput) {
                    const v = getDesc(fallbackUser);
                    shopDescriptionInput.value = v;
                    shopDescriptionInput.placeholder = v || 'Add a short description about your farm and products.';
                }
            }
        } catch (error) {
            console.error('Error loading shop profile:', error);
        }
    }

    setShopProfileEditMode(isEditing) {
        this.isShopProfileEditing = !!isEditing;
        const editWrap = document.getElementById('shop-profile-edit');
        const viewWrap = document.getElementById('shop-profile-view');

        if (editWrap) editWrap.style.display = this.isShopProfileEditing ? 'block' : 'none';
        if (viewWrap) viewWrap.style.display = this.isShopProfileEditing ? 'none' : 'block';

        if (this.isShopProfileEditing) {
            // Re-sync inputs/placeholders every time Edit is opened
            try {
                const profile = this.currentShopProfile || {};
                const fallbackUser = this.authProfile || {};
                const name = String((profile.full_name || fallbackUser.full_name || profile.username || fallbackUser.username || '')).trim();
                const loc = String((profile.location || fallbackUser.address || '')).trim();
                const desc = String((profile.shop_description || fallbackUser.shop_description || '')).trim();

                const nameInput = document.getElementById('shop-name-input');
                const locInput = document.getElementById('shop-location-input');
                const descInput = document.getElementById('shop-description-input');

                if (nameInput) {
                    nameInput.value = name;
                    nameInput.placeholder = name || 'My Farm Shop';
                }
                if (locInput) {
                    locInput.value = loc;
                    locInput.placeholder = loc || 'Farm location not set';
                }
                if (descInput) {
                    descInput.value = desc;
                    descInput.placeholder = desc || 'Add a short description about your farm and products.';
                }
            } catch (_) {
                // ignore
            }
        }
    }

    cancelShopProfileEdit() {
        try {
            // Reset inputs to last loaded profile
            const profile = this.currentShopProfile || {};
            const fallbackUser = this.authProfile || {};
            const shopNameInput = document.getElementById('shop-name-input');
            const shopLocationInput = document.getElementById('shop-location-input');
            const shopDescriptionInput = document.getElementById('shop-description-input');

            if (shopNameInput) {
                const v = profile.full_name || fallbackUser.full_name || profile.username || fallbackUser.username || '';
                shopNameInput.value = v;
                shopNameInput.placeholder = v || 'My Farm Shop';
            }
            if (shopLocationInput) {
                const v = profile.location || fallbackUser.address || '';
                shopLocationInput.value = v;
                shopLocationInput.placeholder = v || 'Farm location not set';
            }
            if (shopDescriptionInput) {
                const v = profile.shop_description || '';
                shopDescriptionInput.value = v;
                shopDescriptionInput.placeholder = v || 'Add a short description about your farm and products.';
            }
        } catch (_) {
            // ignore
        }
        this.setShopProfileEditMode(false);
    }

    async handleShopProfileUpdate(e) {
        e.preventDefault();
        
        const shopNameInput = document.getElementById('shop-name-input');
        const shopDescriptionInput = document.getElementById('shop-description-input');
        const firstNameInput = document.getElementById('account-first-name');
        const middleNameInput = document.getElementById('account-middle-name');
        const lastNameInput = document.getElementById('account-last-name');
        const firstName = firstNameInput?.value?.trim() || '';
        const middleName = middleNameInput?.value?.trim() || '';
        const lastName = lastNameInput?.value?.trim() || '';

        // Get address from the PSGC display field
        const composedAddress = document.getElementById('shop-location-input')?.value?.trim() || '';
        
        const payload = {};

        if (firstName || middleName || lastName) {
            if (!firstName || !lastName) {
                this.showMessage('First name and last name are required.', 'error');
                return;
            }
            payload.first_name = firstName;
            payload.middle_name = middleName || null;
            payload.last_name = lastName;
        }
        
        if (shopNameInput && shopNameInput.value.trim()) {
            payload.full_name = shopNameInput.value.trim();
        }
        
        if (composedAddress) {
            payload.address = composedAddress;
        }
        
        if (shopDescriptionInput && shopDescriptionInput.value.trim()) {
            payload.shop_description = shopDescriptionInput.value.trim();
        }

        if (Object.keys(payload).length === 0) {
            this.showMessage('Please fill in at least one field to update', 'info');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/farmers/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.showMessage('Shop profile updated!', 'success');
                await this.loadShopProfile();
                this.setShopProfileEditMode(false);
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to update shop profile', 'error');
            }
        } catch (error) {
            console.error('Error updating shop profile:', error);
            this.showMessage('Error updating shop profile', 'error');
        }
    }


    async uploadShopImage(type, file) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`${this.apiBase}/upload/${type}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        const data = await response.json();
        return data.imageUrl;
    }

    async uploadProductImage(file, metadata = {}) {
        const formData = new FormData();
        formData.append('image', file);
        if (metadata.name) formData.append('name', metadata.name);
        if (metadata.category_id) formData.append('category_id', metadata.category_id);
        if (metadata.category_name) formData.append('category_name', metadata.category_name);

        const response = await fetch(`${this.apiBase}/upload/product-image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Product image upload failed');
        }

        return response.json();
    }

    renderShopImagePreview(previewId, imageUrl) {
        const preview = document.getElementById(previewId);
        if (!preview || !imageUrl) return;
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Preview';
        preview.appendChild(img);
    }

    async loadMyProducts() {
        try {
            if (!this.farmerId) return;
            const response = await fetch(`${this.apiBase}/products/farmer/${this.farmerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.myProductsCache = Array.isArray(data.products) ? data.products : [];
                this.renderMyProducts(data.products);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    refreshOverviewMetricsSoon() {
        if (this.overviewRefreshTimer) clearTimeout(this.overviewRefreshTimer);
        this.overviewRefreshTimer = setTimeout(() => {
            this.loadOverviewMetrics({ force: true });
        }, 600);
    }

    formatLocalDateInputValue(dt) {
        try {
            const d = dt instanceof Date ? dt : new Date(dt);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        } catch (_) {
            return '';
        }
    }

    normalizeDateKey(value) {
        if (!value) return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            const direct = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
            if (direct) return direct[1];
        }

        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return '';

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    async loadAnnouncements() {
        const el = document.getElementById('farmer-announcements');
        const countEl = document.getElementById('farmer-announce-count');
        if (!el) return;
        const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        try {
            const res = await fetch(`${this.apiBase}/notifications?type=announcement&limit=10`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.notifications || data.data || []);
            if (!items.length) {
                el.innerHTML = '<div style="color:#9ca3af;font-size:0.85rem;padding:8px 0;">No announcements at this time.</div>';
                if (countEl) countEl.textContent = '';
                return;
            }
            if (countEl) countEl.textContent = `${items.length} item${items.length > 1 ? 's' : ''}`;
            el.innerHTML = items.map(n => `
                <div style="padding:8px 0;border-bottom:1px solid var(--border,#e5e7eb);">
                    <div style="font-size:0.88rem;font-weight:600;color:var(--text,#111827);">${esc(n.title || n.message || '')}</div>
                    ${n.body || n.content ? `<div style="font-size:0.8rem;color:#4b5563;margin-top:2px;">${esc(n.body || n.content)}</div>` : ''}
                    <div style="font-size:0.75rem;color:#9ca3af;margin-top:3px;">${n.created_at ? new Date(n.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : ''}</div>
                </div>
            `).join('');
        } catch (err) {
            el.innerHTML = '<div style="color:#9ca3af;font-size:0.85rem;padding:8px 0;">No announcements at this time.</div>';
        }
    }

    async loadOverviewMetrics({ force = false } = {}) {
        try {
            if (!this.token) return;
            if (!document.getElementById('reportsChart')) return;

            const now = Date.now();
            if (!force && now - this.overviewLastFetchAt < 5000) return;
            if (this.overviewFetchInFlight) return this.overviewFetchInFlight;

            this.overviewLastFetchAt = now;
            const lastUpdatedEl = document.getElementById('overview-last-updated');
            if (lastUpdatedEl) lastUpdatedEl.textContent = 'Refreshing report…';

            const rangeDays = this._periodToRangeDays(this._reportPeriod);
            const params = new URLSearchParams();
            params.set('rangeDays', rangeDays);
            // Also pass entries-per-page limits for backend to use if supported
            const roPg = this.pagination['recent-orders'];
            const tpPg = this.pagination['top-products'];
            if (roPg) {
                params.set('recentOrdersLimit', String(roPg.limit));
                params.set('recentOrdersPage', String(roPg.page));
            }
            if (tpPg) {
                params.set('topProductsLimit', String(tpPg.limit));
                params.set('topProductsPage', String(tpPg.page));
            }

            const url = `${this.apiBase}/farmers/me/metrics?${params.toString()}`;
            this.overviewFetchInFlight = fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            })
                .then(async (res) => {
                    const json = await res.json().catch(() => null);
                    if (!res.ok) throw new Error(json?.message || 'Failed to load metrics');
                    return json;
                })
                .then((metrics) => {
                    this.overviewMetrics = metrics;
                    this.renderOverview(metrics);
                })
                .catch((err) => {
                    const el = document.getElementById('overview-last-updated');
                    if (el) el.textContent = 'Could not load report.';
                    console.error('Overview metrics error:', err);
                })
                .finally(() => {
                    this.overviewFetchInFlight = null;
                });

            return this.overviewFetchInFlight;
        } catch (error) {
            console.error('Error loading overview metrics:', error);
        }
    }

    renderOverview(metrics) {
        const lastUpdatedEl = document.getElementById('overview-last-updated');
        if (lastUpdatedEl) {
            const ts = new Date();
            const periodLabel = this._periodLabel(this._reportPeriod);
            lastUpdatedEl.textContent = `${periodLabel} • Updated: ${ts.toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        }

        // Update period labels on all widgets (synced via _syncAllPeriods, but also update here for initial load)
        const periodText = this._periodLabel(this._reportPeriod);
        const periodLabels = [
            'total-orders-period-label',
            'items-sold-period-label',
            'total-revenue-period-label',
            'reports-period-label',
            'status-period-label'
        ];
        periodLabels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = `| ${periodText}`;
        });

        // Recent Orders and Top Products are independent - use their own periods
        const roLbl = document.getElementById('recent-orders-period-label');
        if (roLbl) roLbl.textContent = `| ${this._periodLabel(this._recentOrdersPeriod)}`;
        const tpLbl = document.getElementById('top-products-period-label');
        if (tpLbl) tpLbl.textContent = `| ${this._periodLabel(this._topProductsPeriod)}`;

        // Load KPI cards with their current periods
        for (const [card, period] of Object.entries(this._kpiPeriods)) {
            this.loadKpiCard(card, period, metrics);
        }

        const statusCounts = this.getOverviewStatusCounts(metrics);

        this.loadFarmerReportsChart(this._reportPeriod);
        this.renderOverviewCharts(metrics, statusCounts);
        this.renderRecentOrdersTable(metrics.recentOrders || []);
        this.renderTopProductsTable(metrics.topProducts || []);
    }

    getOverviewStatusCounts(metrics) {
        const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        const apiCounts = metrics?.ordersByStatus || {};
        const useLiveOrderCounts =
            this.hasLoadedOrders && String(metrics?.range || '').toLowerCase() === 'all';

        return statuses.reduce((acc, status) => {
            const sourceCount = useLiveOrderCounts
                ? Number(this.ordersCountByStatus?.[status] || 0)
                : Number(apiCounts?.[status] || 0);
            acc[status] = Number.isFinite(sourceCount) ? sourceCount : 0;
            return acc;
        }, {});
    }

    loadKpiCard(card, period, metrics) {
        const periodLabel = this._periodLabel(period);
        const periodEl = document.getElementById(`${card}-period`);
        if (periodEl) periodEl.textContent = `| ${periodLabel}`;

        const valEl = document.getElementById('my-products');
        if (card === 'kpi-products' && valEl) {
            // Product count is static (current total listings)
            if (this.myProductsCache) {
                const availableProducts = this.myProductsCache.filter(p => {
                    const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
                    return isAvailable && p.status === 'approved';
                });
                valEl.textContent = this.fmtNumber(availableProducts.length);
            }
            return;
        }

        // For orders, sold, revenue — derive from the metrics data.
        // Since /farmers/me/metrics returns data for a single period,
        // all KPIs share the same data. If period differs from _reportPeriod,
        // metrics reflect _reportPeriod; ideally we'd refetch per card.
        const statusCounts = this.getOverviewStatusCounts(metrics);
        if (card === 'kpi-orders') {
            const totalOrders = Object.values(statusCounts).reduce((sum, v) => sum + Number(v || 0), 0);
            const el = document.getElementById('total-orders');
            if (el) el.textContent = this.fmtNumber(totalOrders);
        }
        if (card === 'kpi-sold') {
            const el = document.getElementById('total-sold');
            if (el) el.textContent = this.fmtNumber(statusCounts.delivered || 0);
        }
        if (card === 'kpi-revenue') {
            const totalRevenue = (Array.isArray(metrics?.revenueByDay)
                ? metrics.revenueByDay.reduce((sum, row) => sum + Number(row?.revenue || 0), 0)
                : 0);
            const el = document.getElementById('total-revenue');
            if (el) el.textContent = this.fmtCurrency(totalRevenue);
        }
    }

    renderTopProductsTable(topProducts) {
        const tbody = document.getElementById('top-products-tbody');
        if (!tbody) return;

        const list = (Array.isArray(topProducts) ? topProducts : [])
            .slice()
            .sort((a, b) => {
                const soldDiff = Number(b.sold_qty || 0) - Number(a.sold_qty || 0);
                if (soldDiff !== 0) return soldDiff;
                return Number(b.revenue || 0) - Number(a.revenue || 0);
            });
        this.overviewTopProductsCache = list;
        const pg = this.pagination['top-products'];
        pg.total = list.length;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3 small">No sales yet</td></tr>';
            this.renderPagination('top-products-pagination', pg, () => {});
            return;
        }

        const start = (pg.page - 1) * pg.limit;
        const pageItems = list.slice(start, start + pg.limit);

        tbody.innerHTML = pageItems.map(p => {
            const sold = Number(p.sold_qty || 0);
            const revenue = this.fmtCurrency(p.revenue || 0);
            const price = this.fmtCurrency(p.price || 0);
            const productImage = p.product_image || '/images/placeholder-product.jpg';
            return `
            <tr>
                <td class="text-center"><img src="${this.escapeHtml(productImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td class="small">${this.escapeHtml(p.product_name || '—')}</td>
                <td class="small text-center">${price}</td>
                <td class="small text-center">${this.fmtNumber(sold)}</td>
                <td class="small text-center">${revenue}</td>
            </tr>
            `;
        }).join('');

        this.renderPagination('top-products-pagination', pg, (page) => {
            pg.page = page;
            this.renderTopProductsTable(this.overviewTopProductsCache);
        });

        // Initialize simple-datatables with admin.js pattern
        if (typeof window.simpleDatatables?.DataTable !== 'undefined') {
            const existing = this.sortableTables?.['top-products-table'];
            if (existing && typeof existing.destroy === 'function') {
                try { existing.destroy(); } catch (_) {}
                delete this.sortableTables['top-products-table'];
            }
            const table = document.getElementById('top-products-table');
            if (table) {
                this.sortableTables['top-products-table'] = new window.simpleDatatables.DataTable(table, {
                    searchable: false,
                    paging: false,
                    perPageSelect: false,
                    sortable: true,
                    fixedHeight: false,
                    destroyable: true,
                    labels: { placeholder: '', noRows: 'No entries found', noResults: 'No results found' }
                });
            }
        }
    }

    renderOverviewStatusBreakdown(metrics, statusCounts = null) {
        const wrap = document.getElementById('overview-status-breakdown');
        if (!wrap) return;

        const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        const cards = statuses.map((status) => {
            return `
                <div class="status-breakdown-pill" style="display:flex; align-items:center; justify-content:center; padding:0.5rem 0.9rem; border:1px solid #e5e7eb; border-radius:999px; background:#ffffff; color:#111827; font-weight:600; min-width:10.5rem;">
                    <span>${this.formatStatusLabel(status)}</span>
                </div>
            `;
        }).join('');

        wrap.innerHTML = cards;
    }

    buildLastNDaysLabels(revenueByDay, days) {
        const toKey = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const labels = [];
        const values = [];
        const map = new Map();
        for (const row of (Array.isArray(revenueByDay) ? revenueByDay : [])) {
            const key = this.normalizeDateKey(row?.date);
            if (key) map.set(key, Number(row.revenue) || 0);
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = toKey(d);
            labels.push(key);
            values.push(map.get(key) || 0);
        }
        return { labels, values };
    }

    buildDateSpanLabels(revenueByDay, from, to) {
        const toKey = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const labels = [];
        const values = [];
        const map = new Map();
        for (const row of (Array.isArray(revenueByDay) ? revenueByDay : [])) {
            const key = this.normalizeDateKey(row?.date);
            if (key) map.set(key, Number(row.revenue) || 0);
        }

        const start = new Date(`${from}T00:00:00`);
        const end = new Date(`${to}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
            return { labels: [], values: [] };
        }

        const d = new Date(start);
        while (d.getTime() <= end.getTime()) {
            const key = toKey(d);
            labels.push(key);
            values.push(map.get(key) || 0);
            d.setDate(d.getDate() + 1);
        }
        return { labels, values };
    }

    async loadFarmerReportsChart(period) {
        try {
            const res = await fetch(`${this.apiBase}/farmers/me/report?period=${period}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { data } = await res.json();

            const el = document.getElementById('reportsChart');
            if (!el) return;

            if (this.overviewCharts.reports) {
                this.overviewCharts.reports.destroy();
                this.overviewCharts.reports = null;
            }
            el.innerHTML = '';

            if (typeof ApexCharts === 'undefined') return;

            if (!data || data.length === 0) {
                el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:350px;color:#9ca3af;font-size:14px;">No data available</div>';
                return;
            }

            const labels = data.map(d => {
                const dt = new Date(d.label);
                if (period === 'today') return dt.getHours() + ':00';
                if (period === 'year' || period === 'all') return dt.toLocaleString('default', { month: 'short' });
                return dt.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            });

            this.overviewCharts.reports = new ApexCharts(el, {
                series: [
                    { name: 'Revenue (₱)', data: data.map(d => parseFloat(d.revenue) || 0) },
                    { name: 'Orders', data: data.map(d => parseInt(d.orders) || 0) },
                    { name: 'Items Sold', data: data.map(d => parseInt(d.items_sold) || 0) },
                ],
                chart: {
                    height: 350,
                    type: 'area',
                    toolbar: { show: false },
                    animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 800,
                    }
                },
                markers: {
                    size: 4,
                    hover: {
                        size: 8,
                        sizeOffset: 4
                    }
                },
                colors: ['#4154f1', '#2eca6a', '#ff771d'],
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.3,
                        opacityTo: 0.4,
                        stops: [0, 90, 100]
                    }
                },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2, hover: { width: 4 } },
                xaxis: {
                    categories: labels,
                    tickAmount: Math.min(labels.length, 7),
                },
                yaxis: [
                    { labels: { formatter: v => '₱' + this.fmtNumber(v) } },
                    { opposite: true, labels: { formatter: v => String(Math.round(v)) } },
                ],
                tooltip: {
                    shared: true,
                    intersect: false,
                    y: {
                        formatter: (v, { seriesIndex }) => seriesIndex === 0 ? '₱' + Number(v).toLocaleString() : String(Math.round(v))
                    }
                },
                states: {
                    hover: {
                        filter: {
                            type: 'darken',
                            value: 0.1
                        }
                    }
                },
            });
            this.overviewCharts.reports.render();
        } catch (err) {
            console.warn('Farmer reports chart error:', err);
        }
    }

    renderOverviewCharts(metrics, statusCounts = null) {
        // Orders by status pie chart — Chart.js (NiceAdmin style)
        const statusWrap = document.getElementById('statusChart');
        if (!statusWrap) return;

        const statusKeys = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        const counts = statusCounts || this.getOverviewStatusCounts(metrics);
        const data = statusKeys.map(k => Number(counts?.[k] || 0));
        const totalOrders = data.reduce((sum, val) => sum + val, 0);

        if (this.overviewCharts.status) {
            this.overviewCharts.status.destroy();
            this.overviewCharts.status = null;
        }
        statusWrap.innerHTML = '';

        if (totalOrders === 0) {
            statusWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#9ca3af;font-size:14px;">No orders yet</div>';
            return;
        }

        if (typeof Chart === 'undefined') return;

        const canvas = document.createElement('canvas');
        canvas.style.maxHeight = '320px';
        statusWrap.appendChild(canvas);

        this.overviewCharts.status = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: statusKeys.map(k => this.formatStatusLabel(k)),
                datasets: [{
                    label: 'Orders',
                    data,
                    backgroundColor: statusKeys.map(k => this.getStatusColor(k)),
                    hoverOffset: 15,
                    hoverBorderColor: '#fff',
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 800,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 16, font: { size: 12 }, usePointStyle: true },
                        onHover: (event, legendItem, legend) => {
                            event.native.target.style.cursor = 'pointer';
                            const chart = legend.chart;
                            if (legendItem) {
                                chart.setActiveElements([{ datasetIndex: 0, index: legendItem.index }]);
                                chart.update('none');
                            }
                        },
                        onLeave: (event, legendItem, legend) => {
                            event.native.target.style.cursor = 'default';
                            const chart = legend.chart;
                            chart.setActiveElements([]);
                            chart.update('none');
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} orders`
                        }
                    }
                },
                onHover: (event, elements) => {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                }
            }
        });
    }

    renderRecentOrdersTable(orders) {
        const tbody = document.getElementById('recent-orders-tbody');
        if (!tbody) return;

        const list = Array.isArray(orders) ? orders : [];
        this.overviewRecentOrdersCache = list;
        const pg = this.pagination['recent-orders'];
        pg.total = list.length;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3 small">No recent orders</td></tr>';
            this.renderPagination('recent-orders-pagination', pg, () => {});
            return;
        }

        const start = (pg.page - 1) * pg.limit;
        const pageItems = list.slice(start, start + pg.limit);

        tbody.innerHTML = pageItems.map(o => {
            const statusLabel = this.formatStatusLabel(o.status);
            const customerName = o.customer_name || 'Customer';
            const productImage = o.product_image || '/images/placeholder-product.jpg';
            const price = this.fmtCurrency(o.price || 0);
            return `
            <tr>
                <td class="text-center"><img src="${this.escapeHtml(productImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td class="small text-center">#${o.id}</td>
                <td class="small">${this.escapeHtml(o.product_name || '—')}</td>
                <td class="small">${this.escapeHtml(customerName)}</td>
                <td class="small text-center">${price}</td>
                <td class="small text-center">${this.fmtCurrency(o.total_amount)}</td>
                <td class="text-center"><span class="badge bg-${this.getStatusBadgeColor(o.status)}">${statusLabel}</span></td>
            </tr>
            `;
        }).join('');

        this.renderPagination('recent-orders-pagination', pg, (page) => {
            pg.page = page;
            this.renderRecentOrdersTable(this.overviewRecentOrdersCache);
        });

        // Initialize simple-datatables with admin.js pattern
        if (typeof window.simpleDatatables?.DataTable !== 'undefined') {
            const existing = this.sortableTables?.['recent-orders-table'];
            if (existing && typeof existing.destroy === 'function') {
                try { existing.destroy(); } catch (_) {}
                delete this.sortableTables['recent-orders-table'];
            }
            const table = document.getElementById('recent-orders-table');
            if (table) {
                this.sortableTables['recent-orders-table'] = new window.simpleDatatables.DataTable(table, {
                    searchable: false,
                    paging: false,
                    perPageSelect: false,
                    sortable: true,
                    fixedHeight: false,
                    destroyable: true,
                    labels: { placeholder: '', noRows: 'No entries found', noResults: 'No results found' }
                });
            }
        }
    }

    renderOverviewLowStock() {
        const wrap = document.getElementById('overview-low-stock');
        if (!wrap) return;

        const threshold = 5;
        const products = Array.isArray(this.myProductsCache) ? this.myProductsCache : [];
        const low = products
            .filter(p => Number(p.stock_quantity) <= threshold)
            .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity))
            .slice(0, 8);

        if (low.length === 0) {
            wrap.innerHTML = '<div class="empty-state"><p>No low stock items.</p></div>';
            return;
        }

        wrap.innerHTML = low.map(p => {
            const stock = Number(p.stock_quantity) || 0;
            const searchText = `${p.name} ${stock}`.toLowerCase();
            return `
                <div class="overview-row" data-search-text="${this.escapeAttr(searchText)}">
                    <div class="overview-row-main">
                        <div class="overview-row-title">${this.escapeHtml(p.name || 'Product')}</div>
                        <div class="overview-row-sub">Stock left: ${this.fmtNumber(stock)}</div>
                    </div>
                    <div class="overview-row-meta">
                        <span class="overview-pill" data-status="low">Low</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    parseFilenameFromDisposition(disposition) {
        try {
            const m = String(disposition || '').match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
            const raw = decodeURIComponent(m?.[1] || m?.[2] || '');
            return raw || null;
        } catch (_) {
            return null;
        }
    }

    renderMyProducts(products) {
        this.destroySortableTable('products-table');
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        // Update KPI cards
        this.updateProductKPIs(products);

        if (!products.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No products found</td></tr>`;
            this.refreshSortableTable('products-table', { columns: [{ select: 0, sortable: false }, { select: 8, sortable: false }] });
            return;
        }

        tbody.innerHTML = products.map(product => {
            const stock = Number(product.stock_quantity ?? 0);
            const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
            const statusLabel = !isAvailable ? 'Disabled' : (stock <= 0 ? 'No Stock' : 'Available');
            const statusKey = !isAvailable ? 'disabled' : (stock <= 0 ? 'no_stock' : 'available');
            const reviewCount = Number(product.total_reviews || 0);
            const avgRating = this.fmtNumber(product.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            const categoryName = String(product.category_name || '').trim();
            const createdAt = product.created_at ? new Date(product.created_at) : null;
            const createdLabel = createdAt ? createdAt.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const createdOrder = createdAt ? createdAt.getTime() : 0;

            // Normalize image URL
            let productImageUrl = product.image_url || '';
            if (productImageUrl && !productImageUrl.startsWith('http') && !productImageUrl.startsWith('/')) {
                productImageUrl = '/' + productImageUrl;
            }
            if (!productImageUrl || productImageUrl === 'null' || productImageUrl === 'undefined') {
                productImageUrl = '/images/logo.png';
            }

            const thumb = productImageUrl
                ? `<img src="${this.escapeHtml(productImageUrl)}" class="product-thumb" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">`
                : '';
            const placeholder = `<div class="product-thumb-placeholder" ${productImageUrl ? 'style="display:none"' : ''}><i class="bi bi-image"></i></div>`;

            return `
            <tr>
                <td>${thumb}${placeholder}</td>
                <td class="text-muted">${product.id}</td>
                <td class="fw-semibold">${this.escapeHtml(product.name)}</td>
                <td class="text-muted">${this.escapeHtml(categoryName || '—')}</td>
                <td>${this.fmtCurrency(product.price)}</td>
                <td>${this.fmtNumber(stock)}</td>
                <td>${this.renderStatus(statusLabel, statusKey)}</td>
                <td class="text-muted">${reviewCount} (${avgRating}★)</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green product-edit-btn" data-product-id="${product.id}">Edit</button>
                </td>
            </tr>
        `;
        }).join('');

        this.refreshProductCategoryFilterOptions(products);
        this.refreshSortableTable('products-table', { columns: [{ select: 0, sortable: false }, { select: 8, sortable: false }], defaultSort: [7, 'desc'] });
    }

    updateProductKPIs(products) {
        const total = products.length;
        const active = products.filter(p => {
            const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
            const stock = Number(p.stock_quantity ?? 0);
            return isAvailable && stock > 0;
        }).length;
        const lowStock = products.filter(p => {
            const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
            const stock = Number(p.stock_quantity ?? 0);
            return isAvailable && stock > 0 && stock <= 5;
        }).length;
        const pending = products.filter(p => p.status === 'pending').length;

        const totalEl = document.getElementById('kpi-total-products');
        const activeEl = document.getElementById('kpi-active-products');
        const lowStockEl = document.getElementById('kpi-low-stock');
        const pendingEl = document.getElementById('kpi-pending-products');

        if (totalEl) totalEl.textContent = total;
        if (activeEl) activeEl.textContent = active;
        if (lowStockEl) lowStockEl.textContent = lowStock;
        if (pendingEl) pendingEl.textContent = pending;
    }

    updateBatchBar() {
        const checked = document.querySelectorAll('#my-products-grid .product-select-cb:checked');
        const bar = document.getElementById('products-batch-bar');
        const countEl = document.getElementById('batch-selected-count');
        if (!bar) return;
        if (checked.length > 0) {
            bar.style.display = 'flex';
            if (countEl) countEl.textContent = `${checked.length} selected`;
        } else {
            bar.style.display = 'none';
        }
    }

    async handleBatchAction(action) {
        const checked = Array.from(document.querySelectorAll('#my-products-grid .product-select-cb:checked'));
        const ids = checked.map(cb => Number(cb.getAttribute('data-id'))).filter(Boolean);
        if (!ids.length) return this.showMessage('No products selected.', 'error');

        const actionLabel = action === 'available' ? 'mark as available'
            : action === 'soldout' ? 'mark as sold out'
            : 'delete';

        if (!await showConfirm(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} ${ids.length} product(s)?`, { title: 'Batch Action', okLabel: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1), danger: action === 'delete' })) return;

        try {
            let successCount = 0;
            for (const id of ids) {
                try {
                    if (action === 'available') {
                        const res = await fetch(`${this.apiBase}/products/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
                            body: JSON.stringify({ is_available: true })
                        });
                        if (res.ok) successCount++;
                    } else if (action === 'soldout') {
                        const res = await fetch(`${this.apiBase}/products/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
                            body: JSON.stringify({ stock_quantity: 0 })
                        });
                        if (res.ok) successCount++;
                    } else if (action === 'delete') {
                        const res = await fetch(`${this.apiBase}/products/${id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${this.token}` }
                        });
                        if (res.ok) successCount++;
                    }
                } catch (_) { /* skip failed items */ }
            }
            this.showMessage(`Done: ${successCount}/${ids.length} products updated.`, 'success');
            await this.loadMyProducts();
            this.updateBatchBar();
        } catch (e) {
            console.error('Batch action error:', e);
            this.showMessage('Batch action failed.', 'error');
        }
    }

    async duplicateProduct(productId) {
        const product = (Array.isArray(this.myProductsCache) ? this.myProductsCache : []).find(p => Number(p.id) === Number(productId));
        if (!product) return this.showMessage('Product not found.', 'error');

        if (!await showConfirm(`Duplicate "${product.name}"? A copy will be created as disabled.`, { title: 'Duplicate Product', okLabel: 'Duplicate' })) return;

        try {
            const formData = new FormData();
            formData.append('name', product.name + ' (Copy)');
            if (product.description) formData.append('description', product.description);
            formData.append('price', String(product.price));
            if (product.category_id) formData.append('category_id', String(product.category_id));
            formData.append('stock_quantity', String(product.stock_quantity || 0));
            formData.append('unit', product.unit || 'kg');
            if (product.location) formData.append('location', product.location);
            if (product.image_url) formData.append('image_url', product.image_url);

            const res = await fetch(`${this.apiBase}/products`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.token}` },
                body: formData
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return this.showMessage(data.message || 'Duplicate failed.', 'error');
            this.showMessage('Product duplicated. Edit and enable it when ready.', 'success');
            await this.loadMyProducts();
        } catch (e) {
            console.error('Duplicate product error:', e);
            this.showMessage('Unable to duplicate product.', 'error');
        }
    }

    async loadReviews(page = 1) {
        this._reviewsPage = page;
        const listEl = document.getElementById('reviews-list');
        const paginationEl = document.getElementById('reviews-pagination');
        if (listEl) listEl.innerHTML = '<div class="empty-state"><p>Loading reviews...</p></div>';
        try {
            const res = await fetch(`${this.apiBase}/reviews/mine?page=${page}&limit=20`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) {
                if (listEl) listEl.innerHTML = '<div class="empty-state"><p>Unable to load reviews.</p></div>';
                return;
            }
            const data = await res.json();
            this._renderReviews(data, listEl, paginationEl);
        } catch (e) {
            console.error('Load reviews error:', e);
            if (listEl) listEl.innerHTML = '<div class="empty-state"><p>Unable to load reviews.</p></div>';
        }
    }

    _renderReviews(data, listEl, paginationEl) {
        const aggEl = document.getElementById('reviews-aggregate');
        if (aggEl) {
            const avg = Number(data.avgRating || 0);
            const filledStars = Math.round(avg);
            const stars = '★'.repeat(filledStars) + '☆'.repeat(Math.max(0, 5 - filledStars));
            aggEl.innerHTML = `
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                    <span style="font-size:2rem;font-weight:700;color:var(--primary-color,#16a34a);">${this.fmtNumber(avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                    <span style="font-size:1.4rem;color:#f59e0b;">${stars}</span>
                    <span style="color:var(--text-secondary,#64748b);">${data.totalReviews || 0} review${(data.totalReviews || 0) !== 1 ? 's' : ''} total</span>
                </div>
            `;
        }

        if (!listEl) return;
        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        if (!reviews.length) {
            listEl.innerHTML = '<div class="empty-state"><p>No reviews yet.</p></div>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }

        listEl.innerHTML = `
            <div style="overflow-x:auto;">
                <table class="admin-table" style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Product</th>
                            <th>Rating</th>
                            <th>Comment</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reviews.map(r => {
                            const filledR = Number(r.rating || 0);
                            const starsHtml = `<span style="color:#f59e0b;">${'★'.repeat(filledR)}</span><span style="color:#cbd5e1;">${'☆'.repeat(Math.max(0, 5 - filledR))}</span>`;
                            const customerName = r.first_name
                                ? `${r.first_name} ${r.last_name || ''}`.trim()
                                : (r.customer_name || 'Anonymous');
                            const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                            return `
                                <tr>
                                    <td>${this.escapeHtml(customerName)}</td>
                                    <td>${this.escapeHtml(r.product_name || '—')}</td>
                                    <td style="white-space:nowrap;">${starsHtml} (${r.rating})</td>
                                    <td style="max-width:260px;">${this.escapeHtml(r.comment || '—')}</td>
                                    <td style="white-space:nowrap;">${this.escapeHtml(date)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (paginationEl) {
            const p = Number(data.page || 1);
            const tp = Number(data.totalPages || 1);
            if (tp <= 1) {
                paginationEl.innerHTML = '';
            } else {
                paginationEl.innerHTML = `
                    <button type="button" class="btn btn-secondary btn-sm" ${p <= 1 ? 'disabled' : ''} onclick="farmerDashboard.loadReviews(${p - 1})">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span style="padding:0 0.75rem;font-weight:700;">${p} / ${tp}</span>
                    <button type="button" class="btn btn-secondary btn-sm" ${p >= tp ? 'disabled' : ''} onclick="farmerDashboard.loadReviews(${p + 1})">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                `;
            }
        }
    }

    refreshProductCategoryFilterOptions(products) {
        const categoryFilter = document.getElementById('product-category-filter');
        if (!categoryFilter) return;

        const previousValue = String(categoryFilter.value || '').trim().toLowerCase();
        const categories = Array.from(new Set(
            (Array.isArray(products) ? products : [])
                .map((p) => String(p?.category_name || '').trim())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b));

        categoryFilter.innerHTML = ['<option value="">Category: All</option>']
            .concat(categories.map((category) => `<option value="${this.escapeAttr(category.toLowerCase())}">${this.escapeHtml(category)}</option>`))
            .join('');

        if (previousValue && categories.some((category) => category.toLowerCase() === previousValue)) {
            categoryFilter.value = previousValue;
        }
    }

    openMyProductPreview(productId) {
        const product = (Array.isArray(this.myProductsCache) ? this.myProductsCache : []).find((p) => Number(p.id) === Number(productId));
        if (!product) return;

        const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
        const status = isAvailable ? 'Available' : 'Disabled';
        const toggleLabel = isAvailable ? 'Disable' : 'Enable';
        const toggleArg = !isAvailable;
        const harvestDate = product.harvest_date ? new Date(product.harvest_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified';
        const expiryDate = product.expiry_date ? new Date(product.expiry_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified';
        const reviewCount = this.fmtNumber(product.total_reviews || 0);
        const avgRating = this.fmtNumber(product.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        const body = document.getElementById('farmer-product-preview-body');
        const modal = document.getElementById('farmer-product-preview-modal');
        if (!(body && modal)) return;

            // Normalize product image for preview
            let previewImageUrl = product.image_url || '';
            if (previewImageUrl && !previewImageUrl.startsWith('http') && !previewImageUrl.startsWith('/')) {
                previewImageUrl = '/' + previewImageUrl;
            }
            if (!previewImageUrl || previewImageUrl === 'null' || previewImageUrl === 'undefined') {
                previewImageUrl = '/images/logo.png';
            }

        body.innerHTML = `
            <div class="farmer-product-preview-grid" style="display:grid;grid-template-columns:minmax(220px,320px) 1fr;gap:1.15rem;align-items:start;">
                <img src="${this.escapeAttr(previewImageUrl)}" alt="${this.escapeAttr(product.name)}" style="width:100%;max-width:260px;border-radius:12px;border:1px solid #e2e8f0;object-fit:cover;" onerror="this.src='/images/logo.png'">
                <div>
                    <h3 style="margin:0 0 0.5rem 0;">${this.escapeHtml(product.name)}</h3>
                    <div style="font-weight:700;color:var(--primary-color);margin-bottom:0.5rem;">${this.fmtCurrency(product.price)} per ${this.escapeHtml(product.unit || 'item')}</div>
                    <div style="display:grid;gap:0.45rem;color:var(--text-secondary);line-height:1.5;">
                        <div><strong>Status:</strong> ${this.escapeHtml(status)}</div>
                        <div><strong>Stock:</strong> ${this.fmtNumber(product.stock_quantity || 0)}</div>
                        <div><strong>Expected Harvest Date:</strong> ${this.escapeHtml(harvestDate)}</div>
                        <div><strong>Best Before:</strong> ${this.escapeHtml(expiryDate)}</div>
                        <div><strong>Reviews:</strong> ${reviewCount} (${avgRating}★)</div>
                        <div><strong>Location:</strong> ${this.escapeHtml(product.location || 'Not specified')}</div>
                        <div><strong>Description:</strong> ${this.escapeHtml(product.description || 'No description provided.')}</div>
                    </div>
                    <div class="product-preview-actions" style="display:flex;gap:0.55rem;flex-wrap:wrap;margin-top:1rem;">
                        <button type="button" class="btn product-preview-action-btn" onclick="farmerDashboard.closeMyProductPreview(); farmerDashboard.editProduct(${product.id});">Edit</button>
                        <button type="button" class="btn product-preview-action-btn" onclick="farmerDashboard.closeMyProductPreview(); farmerDashboard.toggleProductStatus(${product.id}, ${toggleArg});">${toggleLabel}</button>
                        <button type="button" class="btn btn-danger product-preview-action-btn" onclick="farmerDashboard.closeMyProductPreview(); farmerDashboard.deleteProduct(${product.id});">Delete</button>
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }

    closeMyProductPreview() {
        const modal = document.getElementById('farmer-product-preview-modal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    async handleAddProduct(e) {
        e.preventDefault();

        if (this.isSubmittingAddProduct) {
            return;
        }

        const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
        const originalSubmitText = submitBtn ? submitBtn.textContent : '';
        this.isSubmittingAddProduct = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
        }

        try {

        const name = document.getElementById('product-name').value;
        const description = document.getElementById('product-description').value;
        const price = document.getElementById('product-price').value;
        const categoryInput = document.getElementById('product-category');
        const category_id = categoryInput?.dataset.value || categoryInput?.value;
        const stock_quantity = document.getElementById('product-stock').value;
        const unitInput = document.getElementById('product-unit');
        const unit = unitInput?.dataset.value || unitInput?.value;
        const locationDisplay = document.getElementById('product-location-display');
        const location = locationDisplay?.value || document.getElementById('product-location').value;
        const harvestDate = document.getElementById('harvest-date').value;
        const expiryDate = document.getElementById('expiry-date').value;

        if (Number(price) < 0 || Number(stock_quantity) < 0) {
            this.showMessage('Price and stock must be zero or higher.', 'error');
            return;
        }

        if (!this.validateProductDates({
            harvestEl: document.getElementById('harvest-date'),
            expiryEl: document.getElementById('expiry-date')
        })) {
            return;
        }

        // Upload image through backend so production domain always stores Cloudinary URLs consistently.
        let imageUrl = '';
        let imagePublicId = '';
        const imageFile = document.getElementById('product-image').files[0];
        if (imageFile) {
            try {
                const categorySelect = document.getElementById('product-category');
                const uploaded = await this.uploadProductImage(imageFile, {
                    name,
                    category_id,
                    category_name: categorySelect?.selectedOptions?.[0]?.text || ''
                });
                imageUrl = uploaded.imageUrl || '';
                imagePublicId = uploaded.public_id || '';
            } catch (err) {
                this.showMessage('Image upload failed: ' + err.message, 'error');
                return;
            }
        }

        // Now send product data to backend
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('price', price);
        formData.append('category_id', category_id);
        formData.append('stock_quantity', stock_quantity);
        formData.append('unit', unit);
        formData.append('location', location);
        formData.append('harvest_date', harvestDate);
        formData.append('expiry_date', expiryDate);
        if (imageUrl) formData.append('image_url', imageUrl);
        if (typeof imagePublicId !== 'undefined' && imagePublicId) formData.append('cloudinary_public_id', imagePublicId);

        try {
            const response = await fetch(`${this.apiBase}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Product added successfully!', 'success');
                document.getElementById('add-product-form').reset();
                const preview = document.getElementById('product-image-preview');
                if (preview) preview.innerHTML = '';
                this.closeAddProductModal(true);
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to add product', 'error');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showMessage('Error adding product', 'error');
        }
        } finally {
            this.isSubmittingAddProduct = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalSubmitText || 'Add Product';
            }
        }
    }

    async handleEditProduct(e) {
        e.preventDefault();

        if (this.isSubmittingEditProduct) {
            return;
        }

        const submitBtn = document.querySelector('#edit-product-form button[type="submit"]');
        const originalSubmitText = submitBtn ? submitBtn.textContent : '';
        this.isSubmittingEditProduct = true;
        this.setEditModalBusyState(true, originalSubmitText || 'Update Product');

        try {

        const productId = document.getElementById('edit-product-id').value;
        if (!productId) {
            this.showMessage('Missing product ID', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('name', document.getElementById('edit-product-name').value);
        formData.append('description', document.getElementById('edit-product-description').value);
        formData.append('price', document.getElementById('edit-product-price').value);
        const editCategoryInput = document.getElementById('edit-product-category');
        const editUnitInput = document.getElementById('edit-product-unit');
        formData.append('category_id', editCategoryInput?.dataset.value || editCategoryInput?.value);
        formData.append('stock_quantity', document.getElementById('edit-product-stock').value);
        formData.append('unit', editUnitInput?.dataset.value || editUnitInput?.value);
        
        // Compose address from PSGC fields
        const zoneEl = document.getElementById('product-location-zone');
        const provinceEl = document.getElementById('product-location-province');
        const cityEl = document.getElementById('product-location-city');
        const barangayEl = document.getElementById('product-location-barangay');
        const streetEl = document.getElementById('product-location-street');
        const previewEl = document.getElementById('product-location-full');
        
        // Read final composed address from the display field (set on confirm)
        const displayEl = document.getElementById('edit-product-location-display');
        let location = '';
        if (displayEl?.value) {
            location = displayEl.value;
        } else if (window.PSGC && previewEl?.value) {
            location = previewEl.value;
        } else if (streetEl?.value) {
            location = streetEl.value;
        }
        formData.append('location', location);

        const harvestDate = document.getElementById('edit-harvest-date').value;
        const expiryDate = document.getElementById('edit-expiry-date').value;

        const editPrice = Number(document.getElementById('edit-product-price').value);
        const editStock = Number(document.getElementById('edit-product-stock').value);
        if (editPrice < 0 || editStock < 0) {
            this.showMessage('Price and stock must be zero or higher.', 'error');
            return;
        }

        if (!this.validateProductDates({
            harvestEl: document.getElementById('edit-harvest-date'),
            expiryEl: document.getElementById('edit-expiry-date')
        })) {
            return;
        }

        formData.append('harvest_date', harvestDate);
        formData.append('expiry_date', expiryDate);

        const imageFile = document.getElementById('edit-product-image').files[0];
        if (imageFile) {
            try {
                const editName = document.getElementById('edit-product-name').value;
                const editCategoryInput = document.getElementById('edit-product-category');
                const editCategoryId = editCategoryInput?.dataset.value || editCategoryInput?.value;
                const editCategorySelect = document.getElementById('edit-product-category');
                const uploaded = await this.uploadProductImage(imageFile, {
                    name: editName,
                    category_id: editCategoryId,
                    category_name: editCategorySelect?.selectedOptions?.[0]?.text || ''
                });
                if (uploaded.imageUrl) formData.append('image_url', uploaded.imageUrl);
                if (uploaded.public_id) formData.append('cloudinary_public_id', uploaded.public_id);
            } catch (err) {
                this.showMessage('Image upload failed: ' + err.message, 'error');
                return;
            }
        }

        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                this.showMessage('Product updated successfully!', 'success');
                this.closeEditModal(true);
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to update product', 'error');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showMessage('Error updating product', 'error');
        }
        } finally {
            this.isSubmittingEditProduct = false;
            this.setEditModalBusyState(false, originalSubmitText || 'Update Product');
        }
    }

    previewImage(input, previewId) {
        const preview = document.getElementById(previewId);
        if (!preview) return;
        preview.innerHTML = '';

        const file = input.files[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            preview.innerHTML = '<p class="error">Invalid file type. Use JPG, PNG, or WEBP.</p>';
            input.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            preview.innerHTML = '<p class="error">File too large (max 5MB).</p>';
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Preview';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    async toggleProductStatus(productId, newStatus) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ is_available: newStatus })
            });

            if (response.ok) {
                this.showMessage('Product status updated!', 'success');
                this.loadMyProducts();
            } else {
                this.showMessage('Failed to update product status', 'error');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showMessage('Error updating product', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!await showConfirm('Are you sure you want to remove this product? Products with order history will be disabled.', { title: 'Delete Product', okLabel: 'Delete', danger: true })) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json().catch(() => ({ message: 'Unknown error' }));

            if (response.ok) {
                this.showMessage(data.message || 'Product updated successfully!', 'success');
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                console.error('Delete product error:', data);
                this.showMessage(data.message || 'Failed to delete product', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showMessage(`Error deleting product: ${error.message}`, 'error');
        }
    }

    async editProduct(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const product = data.product;

                // Populate edit form
                document.getElementById('edit-product-id').value = product.id;
                document.getElementById('edit-product-name').value = product.name;
                document.getElementById('edit-product-price').value = product.price;
                const editCategoryInput = document.getElementById('edit-product-category');
                const editCategoryDropdown = document.getElementById('edit-product-category-dropdown');
                const editUnitInput = document.getElementById('edit-product-unit');
                const editUnitDropdown = document.getElementById('edit-product-unit-dropdown');
                
                // Set category value and label
                if (editCategoryInput && editCategoryDropdown) {
                    const categoryOption = editCategoryDropdown.querySelector(`[data-value="${product.category_id}"]`);
                    if (categoryOption) {
                        editCategoryInput.value = categoryOption.getAttribute('data-label');
                        editCategoryInput.dataset.value = product.category_id;
                        editCategoryDropdown.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
                        categoryOption.classList.add('selected');
                    }
                }
                
                // Set unit value and label
                if (editUnitInput && editUnitDropdown) {
                    const unitOption = editUnitDropdown.querySelector(`[data-value="${product.unit}"]`);
                    if (unitOption) {
                        editUnitInput.value = unitOption.getAttribute('data-label');
                        editUnitInput.dataset.value = product.unit;
                        editUnitDropdown.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
                        unitOption.classList.add('selected');
                    }
                }
                
                document.getElementById('edit-product-stock').value = product.stock_quantity;
                document.getElementById('edit-product-description').value = product.description || '';
                
                // Parse and populate PSGC address fields
                const productLocation = product.location || '';
                const shopLocation = this.currentShopProfile?.location || '';
                const location = productLocation || shopLocation;
                const zoneEl = document.getElementById('product-location-zone');
                const provinceEl = document.getElementById('product-location-province');
                const cityEl = document.getElementById('product-location-city');
                const barangayEl = document.getElementById('product-location-barangay');
                const streetEl = document.getElementById('product-location-street');
                const previewEl = document.getElementById('product-location-full');
                
                const displayEl = document.getElementById('edit-product-location-display');
                
                if (location) {
                    if (displayEl) displayEl.value = location;
                }
                
                if (location && window.PSGC) {
                    try {
                        const parsed = window.PSGC.parseAddress(location);
                        if (parsed) {
                            if (zoneEl) zoneEl.value = parsed.zone || '';
                            if (provinceEl) provinceEl.value = parsed.province || '';
                            if (cityEl) cityEl.value = parsed.city || '';
                            if (barangayEl) barangayEl.value = parsed.barangay || '';
                            // Only set street field if it doesn't contain the full address (avoid duplication)
                            if (streetEl) {
                                const streetValue = parsed.street || '';
                                // Check if street value contains city/province/barangay keywords (indicates parsing error)
                                const hasAddressKeywords = streetValue.match(/barangay|city|municipality|province/i);
                                if (!hasAddressKeywords && streetValue.length < 100) {
                                    streetEl.value = streetValue;
                                } else {
                                    streetEl.value = '';
                                }
                            }
                            if (previewEl) previewEl.value = location;
                            
                            // Enable cascading selects based on parsed values
                            if (parsed.zone && provinceEl) provinceEl.disabled = false;
                            if (parsed.province && cityEl) cityEl.disabled = false;
                            if (parsed.city && barangayEl) barangayEl.disabled = false;
                        }
                    } catch (e) {
                        // If parsing fails, set preview to full address but leave street field empty
                        if (previewEl) previewEl.value = location;
                        if (streetEl) streetEl.value = '';
                    }
                } else if (location) {
                    // Fallback if PSGC not available - set preview to full address but leave street field empty
                    if (previewEl) previewEl.value = location;
                    if (streetEl) streetEl.value = '';
                }
                
                await this.loadProductCatalogNames(product.category_id || null);
                this.syncProductNameAvailability('edit');
                this.updatePriceSuggestion('edit');
                
                if (product.harvest_date) {
                    document.getElementById('edit-harvest-date').value = product.harvest_date;
                }
                if (product.expiry_date) {
                    document.getElementById('edit-expiry-date').value = product.expiry_date;
                }

                // Apply date constraints for edit form
                try {
                    const today = this.todayDateOnly();
                    const hEl = document.getElementById('edit-harvest-date');
                    const eEl = document.getElementById('edit-expiry-date');
                    if (hEl) hEl.min = today;
                    const harvestVal = String(hEl?.value || '').trim();
                    if (eEl) {
                        if (harvestVal) {
                            const dt = new Date(`${harvestVal}T00:00:00`);
                            if (!Number.isNaN(dt.getTime())) {
                                dt.setDate(dt.getDate() + 1);
                                const y = dt.getFullYear();
                                const m = String(dt.getMonth() + 1).padStart(2, '0');
                                const d = String(dt.getDate()).padStart(2, '0');
                                eEl.min = `${y}-${m}-${d}`;
                            } else {
                                eEl.min = today;
                            }
                        } else {
                            eEl.min = today;
                        }
                    }
                } catch (_) {
                    // ignore
                }

                // Show current image
                const preview = document.getElementById('edit-product-image-preview');
                if (preview) {
                    let editPreviewUrl = product.image_url || '';
                    if (editPreviewUrl && !editPreviewUrl.startsWith('http') && !editPreviewUrl.startsWith('/')) {
                        editPreviewUrl = '/' + editPreviewUrl;
                    }
                    if (!editPreviewUrl || editPreviewUrl === 'null' || editPreviewUrl === 'undefined') {
                        editPreviewUrl = '/images/logo.png';
                    }
                    preview.innerHTML = `<img src="${this.escapeAttr(editPreviewUrl)}" alt="Current product image" style="max-width: 200px; margin-top: 10px;">`;
                }

                // Show modal
                this.setEditModalBusyState(false, 'Update Product');
                document.getElementById('edit-product-modal').classList.add('open');
                this.switchTab('list-products');
            } else {
                this.showMessage('Failed to load product details', 'error');
            }
        } catch (error) {
            console.error('Error loading product:', error);
            this.showMessage('Error loading product', 'error');
        }
    }

    closeEditModal(forceClose = false) {
        if (this.isSubmittingEditProduct && !forceClose) {
            return;
        }
        this.setEditModalBusyState(false, 'Update Product');
        document.getElementById('edit-product-modal').classList.remove('open');
        document.getElementById('edit-product-form').reset();
        document.getElementById('edit-product-image-preview').innerHTML = '';
    }

    setEditModalBusyState(isBusy, submitLabel = 'Update Product') {
        const modalEl = document.getElementById('edit-product-modal');
        const submitBtn = document.querySelector('#edit-product-form button[type="submit"]');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const closeBtn = document.querySelector('#edit-product-modal .close-btn');

        if (modalEl) {
            modalEl.classList.toggle('busy', Boolean(isBusy));
        }

        if (submitBtn) {
            submitBtn.disabled = Boolean(isBusy);
            submitBtn.textContent = isBusy ? 'Updating...' : submitLabel;
            submitBtn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
        }
        if (cancelBtn) {
            cancelBtn.disabled = Boolean(isBusy);
            cancelBtn.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
        }
        if (closeBtn) {
            closeBtn.disabled = Boolean(isBusy);
            closeBtn.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
        }
    }

    switchTab(tabName) {
        // Product tabs only (avoid touching order tabs)
        document.querySelectorAll('[data-tab-scope="products"].tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.product-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));

        // Show selected tab
        const targetSection = document.getElementById(`${tabName}-section`);
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetSection) targetSection.classList.add('active');
        if (targetTab) targetTab.classList.add('active');

        const productsSearchRow = document.querySelector('.products-search-row');
        if (productsSearchRow) {
            productsSearchRow.style.display = tabName === 'list-products' ? '' : 'none';
        }
    }

    filterProducts() {
        // Table-based filtering handled by simple-datatables
        // This function is kept for compatibility but delegates to the table
        const table = this.sortableTables['products-table'];
        if (table) {
            const searchTerm = (document.getElementById('products-search-input')?.value || '').toLowerCase().trim();
            const statusFilter = (document.getElementById('product-status-filter')?.value || '').toLowerCase().trim();
            const categoryFilter = (document.getElementById('product-category-filter')?.value || '').toLowerCase().trim();

            // Apply filters using simple-datatables API
            table.search = searchTerm;
            table.page = 1;
            table.update();
        }
    }

    applyProductSort() {
        // Sorting handled by simple-datatables column headers
        // This function is kept for compatibility
    }

    openAccountPanel() {
        const profile = this.currentShopProfile || {};
        const fallbackUser = this.authProfile || {};
        const personalName = this.getPersonalNameParts(fallbackUser);

        const name = String((profile.full_name || fallbackUser.full_name || profile.username || fallbackUser.username || '')).trim();
        const location = String((profile.location || fallbackUser.address || '')).trim();
        const desc = String((profile.shop_description || fallbackUser.shop_description || '')).trim();
        const email = String((fallbackUser.email || profile.email || '')).trim();

        const html = `
            <div class="panel-section">
                <h3 style="margin:0 0 6px 0;">Account</h3>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${this.escapeHtml(email || '—')}</div>
            </div>

            <div class="panel-section">
                <h4 style="margin:0 0 10px 0;">Personal Details</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="account-first-name">First Name</label>
                        <input type="text" id="account-first-name" class="editable-field" value="${this.escapeAttr(personalName.firstName)}" placeholder="First name">
                    </div>
                    <div class="form-group">
                        <label for="account-middle-name">Middle Name</label>
                        <input type="text" id="account-middle-name" class="editable-field" value="${this.escapeAttr(personalName.middleName)}" placeholder="Optional">
                    </div>
                    <div class="form-group">
                        <label for="account-last-name">Last Name</label>
                        <input type="text" id="account-last-name" class="editable-field" value="${this.escapeAttr(personalName.lastName)}" placeholder="Last name">
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h4 style="margin:0 0 10px 0;">Shop Profile</h4>
                <form id="account-shop-form" class="product-form">
                    <div class="form-group">
                        <label for="shop-name-input">Farm Name</label>
                        <input type="text" id="shop-name-input" class="editable-field" value="${this.escapeAttr(name)}" placeholder="My Farm Shop">
                    </div>
                    <div class="form-group">
                        <label for="shop-zone-input"><i class="fas fa-location-dot"></i> Farm Location — Zone</label>
                        <select id="shop-zone-input" class="editable-field">
                            <option value="">Select Zone (Metro / North / South Luzon)</option>
                        </select>
                        <select id="shop-province-input" class="editable-field" disabled style="margin-top:6px">
                            <option value="">Select Province</option>
                        </select>
                        <select id="shop-city-input" class="editable-field" disabled style="margin-top:6px">
                            <option value="">Select City / Municipality</option>
                        </select>
                        <select id="shop-barangay-input" class="editable-field" disabled style="margin-top:6px">
                            <option value="">Select Barangay</option>
                        </select>
                        <input type="text" id="shop-street-input" class="editable-field" placeholder="Street / Building / House No." style="margin-top:6px">
                        <textarea id="shop-address-preview" class="editable-field" rows="2" readonly placeholder="Address preview will appear here" style="margin-top:6px;resize:none;background:var(--surface-alt,#f5f5f5);"></textarea>
                        <small style="color:var(--text-secondary,#888);font-size:0.8rem;">Current: ${this.escapeHtml(location || 'Not set')}</small>
                    </div>
                    <div class="form-group">
                        <label for="shop-description-input">Farm Description</label>
                        <textarea id="shop-description-input" class="editable-field" rows="3" placeholder="Add a short description about your farm and products.">${this.escapeHtml(desc)}</textarea>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button type="submit" class="btn btn-primary btn-sm">Save Shop Profile</button>
                    </div>
                </form>
            </div>

            <div class="panel-section">
                <div class="my-account-password-section">
                    <button type="button" class="btn btn-outline btn-full" id="toggle-my-password-section" aria-expanded="false" aria-controls="my-account-password-fields">
                        <i class="fas fa-key"></i> Change Password
                    </button>
                </div>
            </div>

            <div id="my-account-password-fields" class="my-account-password-fields" hidden>
                <div class="my-account-password-header">
                    <button type="button" class="my-account-password-back" id="my-account-password-back"><i class="fas fa-arrow-left"></i> Back</button>
                    <h4>Change Password</h4>
                </div>
                <form id="account-password-form" class="product-form">
                    <div class="form-group" style="position:relative;">
                        <label for="account-current-password">Current Password</label>
                        <input type="password" id="account-current-password" class="editable-field" autocomplete="current-password" required>
                        <button type="button" class="password-toggle" data-target="account-current-password" aria-label="Show current password">Show</button>
                    </div>
                    <div class="form-group" style="position:relative;">
                        <label for="account-new-password">New Password</label>
                        <input type="password" id="account-new-password" class="editable-field" autocomplete="new-password" required>
                        <button type="button" class="password-toggle" data-target="account-new-password" aria-label="Show new password">Show</button>
                    </div>
                    <div class="form-group" style="position:relative;">
                        <label for="account-confirm-password">Confirm New Password</label>
                        <input type="password" id="account-confirm-password" class="editable-field" autocomplete="new-password" required>
                        <button type="button" class="password-toggle" data-target="account-confirm-password" aria-label="Show confirm password">Show</button>
                    </div>
                    <div id="account-password-error" class="field-error" style="display:none;margin-top:8px;margin-bottom:6px;"></div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button type="submit" class="btn btn-primary btn-sm" id="account-password-submit">Update Password</button>
                    </div>
                </form>
            </div>
        `;

        // Render as a centered modal instead of the side detail panel
        const modalId = 'my-account-modal';
        let modal = document.getElementById(modalId);
        const modalInner = `
            <div class="modal-header">
                <h3>My Account</h3>
                <button class="close-btn" id="close-my-account-modal" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">${html}</div>
        `;

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal open';
            modal.innerHTML = `<div class="modal-content">${modalInner}</div>`;
            document.body.appendChild(modal);
        } else {
            const content = modal.querySelector('.modal-content');
            if (content) content.innerHTML = modalInner;
            modal.classList.add('open');
        }

        // Close handlers (use modal-scoped selectors to avoid timing issues)
        const closeFn = () => {
            try { modal.classList.remove('open'); } catch (_) {}
            try { modal.parentNode && modal.parentNode.removeChild(modal); } catch (_) {}
        };
        const closeBtn = modal.querySelector('#close-my-account-modal');
        if (closeBtn) closeBtn.addEventListener('click', closeFn);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeFn();
        });

        // Bind forms and toggles inside modal
        document.getElementById('account-shop-form')?.addEventListener('submit', (e) => this.handleShopProfileUpdate(e));
        document.getElementById('account-password-form')?.addEventListener('submit', (e) => this.handleChangePassword(e));

        // Bind PSGC zone cascade for shop location
        const initPsgc = async () => {
            const psgc = await this.waitForPsgc();
            const zoneEl = modal.querySelector('#shop-zone-input');
            const provinceEl = modal.querySelector('#shop-province-input');
            const cityEl = modal.querySelector('#shop-city-input');
            const barangayEl = modal.querySelector('#shop-barangay-input');
            const streetEl = modal.querySelector('#shop-street-input');
            const previewEl = modal.querySelector('#shop-address-preview');

            if (!psgc) {
                if (zoneEl) {
                    zoneEl.innerHTML = '<option value="">Address options unavailable</option>';
                    zoneEl.disabled = true;
                }
                return;
            }

            const updatePreview = () => {
                if (!previewEl) return;
                const prov = provinceEl?.value?.trim() || '';
                const city = cityEl?.value?.trim() || '';
                const bgy  = barangayEl?.value?.trim() || '';
                const str  = streetEl?.value?.trim() || '';
                previewEl.value = psgc.formatAddress({ street: str, barangay: bgy, city, province: prov });
            };

            if (zoneEl) {
                psgc.loadZones(zoneEl);
                zoneEl.addEventListener('change', async () => {
                    await psgc.onZoneChange(zoneEl.value, { provinceEl, cityEl, barangayEl }).catch(() => {});
                    updatePreview();
                });
            }
            if (provinceEl) {
                provinceEl.addEventListener('change', async () => {
                    await psgc.onProvinceChange(provinceEl.value, { cityEl, barangayEl }).catch(() => {});
                    updatePreview();
                });
            }
            if (cityEl) {
                cityEl.addEventListener('change', async () => {
                    const city = cityEl.value;
                    if (city) {
                        await psgc.loadBarangays(city, barangayEl).catch(() => {});
                        if (barangayEl) barangayEl.disabled = false;
                    } else {
                        psgc.setSelectOptions(barangayEl, [], 'Select Barangay');
                        if (barangayEl) barangayEl.disabled = true;
                    }
                    updatePreview();
                });
            }
            if (barangayEl) barangayEl.addEventListener('change', updatePreview);
            if (streetEl) streetEl.addEventListener('input', updatePreview);
        };
        initPsgc();

        // Bind password toggle buttons
        modal.querySelectorAll('.password-toggle').forEach(btn => {
            try {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;
                btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    btn.textContent = isPassword ? 'Hide' : 'Show';
                    btn.setAttribute('aria-pressed', String(isPassword));
                });
            } catch (err) {
                // ignore binding errors
            }
        });

        // Bind toggle for showing/hiding the change-password fields
        const togglePwBtn = document.getElementById('toggle-my-password-section');
        const pwFields = document.getElementById('my-account-password-fields');
        if (togglePwBtn) {
            togglePwBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                if (!pwFields) return;
                const isHidden = pwFields.hasAttribute('hidden');
                if (isHidden) {
                    pwFields.removeAttribute('hidden');
                    togglePwBtn.setAttribute('aria-expanded', 'true');
                } else {
                    pwFields.setAttribute('hidden', '');
                    togglePwBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }

        const pwBackBtn = document.getElementById('my-account-password-back');
        if (pwBackBtn && pwFields) {
            pwBackBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                pwFields.setAttribute('hidden', '');
                const toggleEl = document.getElementById('toggle-my-password-section');
                if (toggleEl) toggleEl.setAttribute('aria-expanded', 'false');
            });
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();

        const currentPassword = String(document.getElementById('account-current-password')?.value || '');
        const newPassword = String(document.getElementById('account-new-password')?.value || '');
        const confirmPassword = String(document.getElementById('account-confirm-password')?.value || '');

        if (!currentPassword || !newPassword) {
            this.showMessage('Please fill in all password fields.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            this.showMessage('New password must be at least 6 characters.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            this.showMessage('New password and confirmation do not match.', 'error');
            return;
        }

        const submitBtn = document.getElementById('account-password-submit');
        const errorEl = document.getElementById('account-password-error');
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.orig = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Updating...';
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (response.ok) {
                this.showMessage('Password updated!', 'success');
                const curEl = document.getElementById('account-current-password');
                const newEl = document.getElementById('account-new-password');
                const confEl = document.getElementById('account-confirm-password');
                if (curEl) curEl.value = '';
                if (newEl) newEl.value = '';
                if (confEl) confEl.value = '';
            } else {
                let err = null;
                try { err = await response.json(); } catch (_) { err = null; }
                const msg = (err && (err.message || err.error || err.detail)) || `Failed to update password (status ${response.status})`;
                if (errorEl) {
                    errorEl.style.display = '';
                    errorEl.textContent = msg;
                }
                this.showMessage(msg, 'error');
                if (response.status === 401) {
                    // Token problems: prompt re-login
                    // Optionally clear local token
                    try { localStorage.removeItem('token'); } catch (_) {}
                }
            }
        } catch (error) {
            console.error('Change password error:', error);
            const msg = (error && error.message) ? error.message : 'Error updating password';
            if (errorEl) {
                errorEl.style.display = '';
                errorEl.textContent = msg;
            }
            this.showMessage(msg, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.orig || 'Update Password';
            }
        }
    }

    async loadOrdersByStatus(status) {
        try {
            if (!this.farmerId) return;
            const response = await fetch(`${this.apiBase}/orders/farmer/${this.farmerId}?status=${status}&t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                const orders = Array.isArray(data.orders) ? data.orders : [];
                if (status === 'cancelled' && orders.length === 0) {
                    const fallbackResponse = await fetch(`${this.apiBase}/orders/farmer/${this.farmerId}?t=${Date.now()}`, {
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        },
                        cache: 'no-store'
                    });

                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        const cancelledOrders = (Array.isArray(fallbackData.orders) ? fallbackData.orders : []).filter((order) => {
                            const item = (order.items && order.items[0]) || order;
                            return String(item.status || order.status || '').toLowerCase() === 'cancelled';
                        });
                        this.renderOrders(cancelledOrders, status);
                        this.updateOrdersTabCounts();
                        return;
                    }
                }

                this.renderOrders(orders, status);
                this.updateOrdersTabCounts();
            } else {
                const errorData = await response.json();
                console.error('Error loading orders:', errorData);
                this.showMessage(errorData.message || 'Failed to load orders', 'error');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showMessage('Error loading orders', 'error');
        }
    }

    clearAllOrdersFromUI() {
        // Clear all in-memory caches
        this.lastOrdersById.clear();
        this.lastOrdersByStatus = { pending: [], confirmed: [], preparing: [], out_for_delivery: [], delivered: [], cancelled: [] };
        
        // Clear all order containers in UI
        const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        statuses.forEach(status => {
            const container = document.getElementById(`${status}-orders-list`);
            if (container) {
                const statusLabel = this.formatStatusLabel(status);
                container.innerHTML = `<div class="empty-state"><p>No ${statusLabel} orders found.</p></div>`;
            }
        });
        this.updateOrdersTabCounts();
        
        // Force reload from server
        this.loadMyOrders();
    }

    async loadMyOrders() {
        // Load all 6 order statuses
        try {
            await Promise.all([
                this.loadOrdersByStatus('pending'),
                this.loadOrdersByStatus('confirmed'),
                this.loadOrdersByStatus('preparing'),
                this.loadOrdersByStatus('out_for_delivery'),
                this.loadOrdersByStatus('delivered'),
                this.loadOrdersByStatus('cancelled')
            ]);
        } catch (error) {
            console.error('Error loading all orders:', error);
        }
    }

    updateOrdersTabCounts() {
        const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        statuses.forEach((status) => {
            const tab = document.getElementById(`${status}-orders-tab`);
            const badge = document.getElementById(`${status}-orders-count`);
            const count = Array.isArray(this.lastOrdersByStatus[status]) ? this.lastOrdersByStatus[status].length : 0;

            this.ordersCountByStatus[status] = count;
            if (badge) {
                badge.textContent = String(count);
                // Always keep the badge visible for consistent UX; dim when zero
                badge.style.display = 'inline-flex';
                badge.style.opacity = count > 0 ? '1' : '0.45';
                badge.setAttribute('aria-label', `${this.formatStatusLabel(status)}: ${count}`);
            } else if (tab) {
                const label = this.formatStatusLabel(status);
                tab.innerHTML = count > 0
                    ? `${label} <span class="tab-count" style="background:#ef4444;color:#fff;border-radius:12px;padding:2px 6px;margin-left:8px;font-size:0.85rem;vertical-align:middle;">${count}</span>`
                    : label;
            }
        });

        this.hasLoadedOrders = true;
        if (this.overviewMetrics && (String(this.overviewMetrics?.range || '').toLowerCase() === 'all' || this.overviewRangeMode === 'all')) {
            this.renderOverview(this.overviewMetrics);
        }
    }

    switchOrderTab(status, skipLoad = false) {
        const ordersEl = document.getElementById('orders');
        const scope = ordersEl || document;

        // Hide all order tabs (scope to #orders to avoid touching product tabs)
        scope.querySelectorAll('.order-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        scope.querySelectorAll('[data-tab-scope="orders"].tab-content').forEach(content => content.classList.remove('active'));

        // Show selected order tab
        const section = document.getElementById(`${status}-orders-section`);
        const tab = document.getElementById(`${status}-orders-tab`);
        if (section) section.classList.add('active');
        if (tab) {
            tab.classList.add('active');
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }

        this.applyOrdersSearch();

        // Load orders for this status unless we're skipping (e.g., already loaded)
        if (!skipLoad) {
            this.loadOrdersByStatus(status);
        }
    }

    getOrderStatusBadge(status) {
        const statusMap = {
            pending: { class: 'pending', label: 'Pending' },
            confirmed: { class: 'confirmed', label: 'Confirmed' },
            preparing: { class: 'preparing', label: 'Preparing' },
            out_for_delivery: { class: 'out_for_delivery', label: 'Out for Delivery' },
            delivered: { class: 'delivered', label: 'Delivered' },
            cancelled: { class: 'cancelled', label: 'Cancelled' }
        };
        const config = statusMap[status] || { class: 'pending', label: status };
        return `<span class="order-card-status ${config.class}">${config.label}</span>`;
    }

    getOrderActionButtons(order) {
        const status = order.status;
        const orderId = order.id;
        
        if (status === 'pending') {
            return `
                <button class="btn btn-sm btn-success order-confirm-btn" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="confirmed">
                    <i class="bi bi-check-lg me-1"></i>Confirm
                </button>
                <button class="btn btn-sm btn-danger order-cancel-btn" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="cancelled">
                    <i class="bi bi-x-lg me-1"></i>Cancel
                </button>
            `;
        } else if (status === 'confirmed') {
            return `
                <button class="btn btn-sm btn-primary order-prepare-btn" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="preparing">
                    <i class="bi bi-box-seam me-1"></i>Start Preparing
                </button>
            `;
        } else if (status === 'preparing') {
            return `
                <button class="btn btn-sm btn-info order-ship-btn" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="out_for_delivery">
                    <i class="bi bi-truck me-1"></i>Mark as Out for Delivery
                </button>
            `;
        } else if (status === 'out_for_delivery') {
            return `
                <button class="btn btn-sm btn-success order-deliver-btn" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="delivered">
                    <i class="bi bi-check-circle me-1"></i>Mark as Delivered
                </button>
            `;
        } else {
            return `
                <button class="btn btn-sm btn-secondary order-view-btn" data-action="view-order" data-order-id="${orderId}">
                    <i class="bi bi-eye me-1"></i>View Details
                </button>
            `;
        }
    }

    renderOrders(orders, status) {
        // Index orders for detail panel usage
        this.lastOrdersByStatus[status] = Array.isArray(orders) ? orders : [];
        this.lastOrdersByStatus[status].forEach(o => this.lastOrdersById.set(Number(o.id), o));

        const container = document.getElementById('orders-grid');

        if (orders.length === 0) {
            const statusLabel = this.formatStatusLabel(status);
            container.innerHTML = `
                <div class="orders-empty-state">
                    <i class="bi bi-inbox orders-empty-state-icon"></i>
                    <p class="orders-empty-state-text">No ${statusLabel} orders found</p>
                </div>
            `;
            this.updateOrdersTabCounts();
            return;
        }

        // CRITICAL: container.innerHTML completely replaces content - removes orphaned orders not in database
        container.innerHTML = orders.map(order => {
            // Per-item order: order is already one item
            // Validate order has an ID
            if (!order || !order.id) {
                console.error('Invalid order data:', order);
                return '';
            }
            
            const item = (order.items && order.items[0]) || order;
            const currentStatus = item.status || order.status || 'pending';
            let productImage = item.image_url || order.product_image || '/images/logo.png';
            if (productImage && !productImage.startsWith('http') && !productImage.startsWith('/')) {
                productImage = '/' + productImage;
            }
            if (!productImage || productImage === 'null' || productImage === 'undefined') {
                productImage = '/images/logo.png';
            }
            const productName = item.product_name || order.product_name || 'Product';
            const quantity = item.quantity || order.quantity || 1;
            const price = item.price || order.price || 0;
            const totalAmount = item.total_amount || order.total_amount || 0;
            const orderId = Number(order.id);
            const orderDate = order.created_at ? new Date(order.created_at) : null;
            const deliveryAddress = String(order.delivery_address || '').trim();
            const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified';
            const specialInstructions = String(order.special_instructions || '').trim();
            const customerName = String(order.customer_name || '—').trim();
            const customerRating = Number(order.customer_average_rating || 0);
            const customerTotalRatings = Number(order.customer_total_ratings || 0);
            const searchText = `${String(orderId)} ${productName} ${customerName}`.toLowerCase();
            const dateLabel = orderDate && !Number.isNaN(orderDate.getTime())
                ? orderDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
                : '—';
            
            return `
            <div class="order-card" data-order-id="${orderId}">
                <div class="order-card-header">
                    <div>
                        <div class="order-card-id">#${orderId}</div>
                        <div class="order-card-date">${dateLabel}</div>
                    </div>
                    ${this.getOrderStatusBadge(currentStatus)}
                </div>
                <div class="order-card-product">
                    <img src="${this.escapeAttr(productImage)}" 
                         alt="${this.escapeHtml(productName)}" class="order-card-product-img">
                    <div>
                        <div class="order-card-product-name">${this.escapeHtml(productName)}</div>
                        <div class="order-card-product-qty">Qty: ${quantity}</div>
                    </div>
                </div>
                <div class="order-card-customer">
                    <div class="order-card-customer-name">${this.escapeHtml(customerName)}</div>
                    <div class="order-card-customer-location">${this.escapeHtml(deliveryAddress || '—')}</div>
                </div>
                <div class="order-card-pricing">
                    <div class="order-card-unit-price">₱${this.fmtCurrency(price)} / unit</div>
                    <div class="order-card-total">₱${this.fmtCurrency(totalAmount)}</div>
                </div>
                <div class="order-card-actions">
                    ${this.getOrderActionButtons({ id: orderId, status: currentStatus })}
                </div>
            </div>
`;
        }).join('');

        this.applyOrdersSearch();

        this.updateOrdersTabCounts();
    }

    openOrderDetails(orderId) {
        const order = this.lastOrdersById.get(Number(orderId));
        if (!order) {
            this.showMessage('Order details not loaded yet. Please refresh orders.', 'error');
            return;
        }

        // This function is no longer used - orders are displayed inline
    }

    getStatusColor(status) {
        const colors = {
            'pending': '#f59e0b',
            'confirmed': '#3b82f6',
            'preparing': '#8b5cf6',
            'out_for_delivery': '#06b6d4',
            'delivered': '#10b981',
            'cancelled': '#ef4444'
        };
        return colors[status] || '#64748b';
    }

    getStatusBadgeColor(status) {
        const map = {
            'pending': 'warning',
            'confirmed': 'primary',
            'preparing': 'info',
            'out_for_delivery': 'info',
            'delivered': 'success',
            'cancelled': 'danger'
        };
        return map[status] || 'secondary';
    }

    formatStatusLabel(status) {
        const labels = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'preparing': 'Preparing',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return labels[status] || status;
    }

    applyTopSearch() {
        const q = (document.getElementById('farmer-search-input')?.value || '').trim().toLowerCase();

        if (this.activeSection === 'products') {
            this.filterProducts();
            return;
        }

        if (!q) {
            // reset simple visibility for common lists
            document.querySelectorAll('.orders-list .order-card').forEach(el => (el.style.display = ''));
            document.querySelectorAll('#conversation-list .conversation-item').forEach(el => (el.style.display = ''));
            document.querySelectorAll('#overview .overview-row').forEach(el => (el.style.display = ''));
            this.updateOrdersSearchEmptyState();
            return;
        }

        if (this.activeSection === 'orders') {
            document.querySelectorAll('.orders-list .order-card').forEach(card => {
                const text = (card.textContent || '').toLowerCase();
                card.style.display = text.includes(q) ? '' : 'none';
            });
            this.updateOrdersSearchEmptyState();
        } else if (this.activeSection === 'chat') {
            document.querySelectorAll('#conversation-list .conversation-item').forEach(item => {
                const text = (item.textContent || '').toLowerCase();
                item.style.display = text.includes(q) ? '' : 'none';
            });
        } else if (this.activeSection === 'overview') {
            document.querySelectorAll('#overview .overview-row').forEach(row => {
                const text = (row.getAttribute('data-search-text') || row.textContent || '').toLowerCase();
                row.style.display = text.includes(q) ? '' : 'none';
            });
        }
    }

    applyOrdersSearch() {
        const q = (document.getElementById('orders-search-input')?.value || '').trim().toLowerCase();
        const cards = document.querySelectorAll('.orders-list .order-card');

        cards.forEach((card) => {
            if (!q) {
                card.style.display = '';
                return;
            }
            const text = String(card.getAttribute('data-search-text') || '').toLowerCase();
            card.style.display = text.includes(q) ? '' : 'none';
        });

        this.updateOrdersSearchEmptyState();
    }

    updateOrdersSearchEmptyState() {
        const emptyEl = document.getElementById('orders-search-empty');
        if (!emptyEl) return;

        const activeSection = document.querySelector('[data-tab-scope="orders"].tab-content.active');
        if (!activeSection) {
            emptyEl.style.display = 'none';
            return;
        }

        const cards = activeSection.querySelectorAll('.order-card');
        const q = (document.getElementById('orders-search-input')?.value || '').trim().toLowerCase();
        const allCards = document.querySelectorAll('.orders-list .order-card');
        if (!cards.length) {
            emptyEl.style.display = 'none';
            return;
        }

        const hasVisible = Array.from(cards).some((card) => card.style.display !== 'none');
        if (!hasVisible) {
            const hasVisibleAnywhere = Array.from(allCards).some((card) => card.style.display !== 'none');
            const p = emptyEl.querySelector('p');
            if (p) {
                p.textContent = q && !hasVisibleAnywhere
                    ? 'No orders match your search in any status.'
                    : 'No orders match your search in this status.';
            }
        }
        emptyEl.style.display = hasVisible ? 'none' : 'block';
    }

    escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[ch]));
    }

    escapeAttr(str) {
        return this.escapeHtml(str).replace(/`/g, '&#096;');
    }

    async updateOrderItemStatus(orderId, orderItemId, newStatus) {
        try {
            // Validate inputs
            if (!orderId || isNaN(orderId) || orderId <= 0) {
                this.showMessage('Invalid order ID', 'error');
                return;
            }
            if (!newStatus) {
                this.showMessage('Invalid status', 'error');
                return;
            }
            
            let note = '';
            if (newStatus === 'cancelled') {
                note = prompt('Reason for cancellation (optional):') || '';
            }
            
            // Ensure orderItemId is valid (use orderId if not)
            const actualOrderItemId = (orderItemId && !isNaN(orderItemId) && orderItemId > 0) ? orderItemId : orderId;
            
            const response = await fetch(`${this.apiBase}/orders/${orderId}/items/${actualOrderItemId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status: newStatus, note })
            });

            if (response.ok) {
                this.showMessage(`Pre-order status updated to ${newStatus}!`, 'success');
                // Reload all order tabs to ensure order moves from old status to new status
                await this.loadMyOrders();
                // Defer tab switch so DOM updates from loadMyOrders are applied first, then switch to new status tab
                const switchToTab = () => {
                    if (newStatus === 'pending') {
                        this.switchOrderTab('pending', true);
                    } else if (newStatus === 'confirmed') {
                        this.switchOrderTab('confirmed', true);
                    } else if (newStatus === 'preparing') {
                        this.switchOrderTab('preparing', true);
                    } else if (newStatus === 'out_for_delivery') {
                        this.switchOrderTab('out_for_delivery', true);
                    } else if (newStatus === 'delivered') {
                        this.switchOrderTab('delivered', true);
                    } else if (newStatus === 'cancelled') {
                        this.switchOrderTab('cancelled', true);
                    }
                };
                requestAnimationFrame(() => {
                    setTimeout(switchToTab, 50);
                });
            } else {
                const data = await response.json().catch(() => ({}));
                this.showMessage(data.message || 'Failed to update order item status', 'error');
            }
        } catch (error) {
            console.error('Error updating order:', error);
            this.showMessage('Error updating order', 'error');
        }
    }

    async rateCustomerForOrder(orderId) {
        if (!orderId) return;

        try {
            const eligibilityRes = await fetch(`${this.apiBase}/orders/${orderId}/customer-rating/eligibility`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const eligibility = await eligibilityRes.json().catch(() => ({}));
            if (!eligibilityRes.ok || !eligibility?.can_rate) {
                this.showMessage(eligibility?.reason || 'You can rate only delivered orders within 1 month.', 'error');
                return;
            }

            const existingRating = eligibility?.my_rating?.rating || 0;
            this.openCustomerRatingModal({
                orderId,
                rating: existingRating,
                hasExisting: !!eligibility?.my_rating
            });
        } catch (error) {
            console.error('Rate customer error:', error);
            this.showMessage('Unable to submit rating right now.', 'error');
        }
    }

    openCustomerRatingModal({ orderId, rating = 0, hasExisting = false }) {
        this.customerRatingDraft = {
            orderId: Number(orderId || 0),
            rating: Number(rating || 0),
            hasExisting: !!hasExisting
        };

        const orderLabel = document.getElementById('customer-rating-order');
        if (orderLabel) {
            orderLabel.textContent = `Pre-order #${this.customerRatingDraft.orderId}`;
        }

        const submitBtn = document.getElementById('customer-rating-submit');
        if (submitBtn) {
            submitBtn.textContent = this.customerRatingDraft.hasExisting ? 'Update Rating' : 'Save Rating';
        }

        this.setCustomerRatingValue(this.customerRatingDraft.rating);

        const modal = document.getElementById('customer-rating-modal');
        if (modal) modal.classList.add('open');
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    }

    closeCustomerRatingModal() {
        const modal = document.getElementById('customer-rating-modal');
        if (modal) modal.classList.remove('open');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        this.customerRatingDraft = { orderId: null, rating: 0, hasExisting: false };
    }

    setCustomerRatingValue(value) {
        const rating = Math.max(0, Math.min(5, Number(value || 0)));
        this.customerRatingDraft.rating = rating;

        document.querySelectorAll('#customer-rating-modal .order-rating-star-btn').forEach((button) => {
            const starValue = Number(button.getAttribute('data-rating') || 0);
            button.classList.toggle('active', starValue <= rating);
        });

        const valueEl = document.getElementById('customer-rating-value');
        if (valueEl) {
            valueEl.textContent = rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Select a rating';
        }
    }

    async submitCustomerRatingForm(e) {
        e.preventDefault();

        const orderId = Number(this.customerRatingDraft.orderId || 0);
        const rating = Number(this.customerRatingDraft.rating || 0);
        if (!orderId) return;
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            this.showMessage('Rating must be between 1 and 5.', 'error');
            return;
        }

        const submitBtn = document.getElementById('customer-rating-submit');
        const originalText = submitBtn ? submitBtn.textContent : '';
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            const method = this.customerRatingDraft.hasExisting ? 'PUT' : 'POST';
            const response = await fetch(`${this.apiBase}/orders/${orderId}/customer-rating`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ rating })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Unable to submit rating.', 'error');
                return;
            }

            this.showMessage('Customer rating saved.', 'success');
            this.closeCustomerRatingModal();
            await this.loadMyOrders();
        } catch (error) {
            console.error('Submit customer rating error:', error);
            this.showMessage('Unable to submit rating right now.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText || 'Save Rating';
            }
        }
    }

    openChatWithCustomer(customerId, orderId) {
        if (!customerId) {
            this.showMessage('Customer information not available', 'error');
            return;
        }
        const order = this.lastOrdersById?.get(Number(orderId));
        const productName = order?.product_name || order?.name || '';
        const quantity = Number(order?.quantity || 0) || 1;
        const returnUrl = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `/chat.html?customerId=${customerId}&orderId=${orderId}&productName=${encodeURIComponent(productName)}&quantity=${quantity}&returnUrl=${encodeURIComponent(returnUrl)}`;
    }

    viewOrderDetails(orderId) {
        // For now, just show a message that details will be implemented
        this.showMessage('Order details feature coming soon!', 'info');
    }

    logout() {
        localStorage.removeItem('token');
        window.location.href = '/';
    }

    showMessage(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 300px;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize farmer dashboard when DOM is loaded
let farmerDashboard;
document.addEventListener('DOMContentLoaded', () => {
    farmerDashboard = new FarmerDashboard();
    // Make it globally accessible for inline onclick handlers
    window.farmerDashboard = farmerDashboard;
});