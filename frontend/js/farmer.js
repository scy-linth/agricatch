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
        this.lastOrdersByStatus = { pending: [], preorder_reserved: [], confirmed: [], preparing: [], scheduled: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.ordersCountByStatus = { pending: 0, preorder_reserved: 0, confirmed: 0, preparing: 0, scheduled: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
        this.activeOrderStatus = 'pending';
        this.activeSection = 'overview';
        this.currentShopProfile = null;
        this.isShopProfileEditing = false;
        this.currentAddressTarget = null;

        this.overviewCharts = { sales: null, status: null };
        this.overviewMetrics = null;
        this.hasLoadedOrders = false;
        this.isSubmittingAddProduct = false;

        // Make instance accessible globally for onclick handlers
        window.farmerApp = this;
        this.isSubmittingEditProduct = false;
        this.isSubmittingRequestProduct = false;
        this.overviewRecentOrdersCache = [];
        this.overviewTopProductsCache = [];
        this.overviewLastFetchAt = 0;
        this.overviewFetchInFlight = null;
        this.sortableTables = {};
        this.overviewRefreshTimer = null;
        this.myProductsCache = [];
        this.requestsCache = [];
        this.catalogProductNames = [];
        this.productNameActiveIndex = { add: -1, edit: -1 };
        this.realtimeSource = null;
        this.customerRatingDraft = { orderId: null, rating: 0, hasExisting: false };
        this.lowStockThreshold = 15;

        // Subscription tier system
        this.subscriptionData = null;
        this.selectedDuration = 1;
        this.selectedPaymentAccount = null;

        // Support tickets
        this.supportTickets = [];
        this.supportTicketsCurrentPage = 1;
        this.supportTicketsPerPage = 10;
        this.supportTicketsTotal = 0;
        this.currentTicketId = null;
        this.ticketPollInterval = null;
        this.ticketPollFailures = 0;

        // Chat polling for real-time unread message updates
        this.chatPollInterval = null;
        this.chatPollFailures = 0;

        // Notifications polling for real-time updates
        this.notifPollInterval = null;
        this.notifPollFailures = 0;

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();

        // Setup chat scroll observer after initialization
        setTimeout(() => this.setupChatScrollObserver(), 500);
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

    setupChatScrollObserver() {
        const chatSection = document.getElementById('chat');
        if (!chatSection) return;

        // Watch for chat section becoming active
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (chatSection.classList.contains('active')) {
                        // Chat section became active, scroll browser to bottom
                        window.scrollTo(0, document.body.scrollHeight);

                        // Scroll chat messages to bottom
                        const chatMessages = document.getElementById('chat-messages');
                        if (chatMessages && chatMessages.children.length > 0) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                }
            });
        });

        observer.observe(chatSection, { attributes: true });

        // Also scroll to bottom on initial load if chat section is already active
        if (chatSection.classList.contains('active')) {
            setTimeout(() => {
                // Scroll browser to bottom
                window.scrollTo(0, document.body.scrollHeight);

                // Scroll chat messages to bottom
                const chatMessages = document.getElementById('chat-messages');
                if (chatMessages && chatMessages.children.length > 0) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 500);
        }
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
        const map = { today: 'vs prev today', week: 'vs prev week', month: 'vs prev month', year: 'vs prev year', all: '' };
        return map[String(period || '').trim().toLowerCase()] || 'vs prev today';
    }

    isPremium() {
        return this.subscriptionData?.status === 'active';
    }

    isVerified() {
        return this.currentVerificationRequest?.status === 'approved' || this.authProfile?.is_verified === true;
    }

    updateKpiChange(changeId, labelId, change, period) {
        const changeEl = document.getElementById(changeId);
        const labelEl = document.getElementById(labelId);
        if (period === 'all') {
            if (changeEl) changeEl.textContent = '';
            if (labelEl) labelEl.textContent = '';
            return;
        }

        const value = Number(change) || 0;
        const isPositive = value >= 0;
        if (changeEl) {
            changeEl.className = `small pt-1 fw-bold ${isPositive ? 'text-success' : 'text-danger'}`;
            changeEl.textContent = `${isPositive ? '+' : ''}${value}%`;
        }
        if (labelEl) labelEl.textContent = this._comparisonLabel(period);
    }

    _loadPeriods() {
        try {
            const saved = localStorage.getItem('farmerDashboardPeriods');
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed.kpiPeriods) this._kpiPeriods = { ...this._kpiPeriods, ...parsed.kpiPeriods };
            if (parsed.reportPeriod) this._reportPeriod = parsed.reportPeriod;
            if (parsed.statusPeriod) this._statusPeriod = parsed.statusPeriod;
            if (parsed.recentOrdersPeriod) this._recentOrdersPeriod = parsed.recentOrdersPeriod;
            if (parsed.topProductsPeriod) this._topProductsPeriod = parsed.topProductsPeriod;
            if (parsed.lowStockThreshold) this.lowStockThreshold = parsed.lowStockThreshold;
        } catch (_) {}
    }

    _savePeriods() {
        try {
            localStorage.setItem('farmerDashboardPeriods', JSON.stringify({
                kpiPeriods: this._kpiPeriods,
                reportPeriod: this._reportPeriod,
                statusPeriod: this._statusPeriod,
                recentOrdersPeriod: this._recentOrdersPeriod,
                topProductsPeriod: this._topProductsPeriod,
                lowStockThreshold: this.lowStockThreshold,
            }));
        } catch (_) {}
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
            fixedHeight: false,
            perPageSelect: false,
            sortable: true,
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

        // Save sort state when user clicks a header
        const wrapper = this.sortableTables[tableId].wrapperDOM;
        if (wrapper) {
            const headers = wrapper.querySelectorAll('th');
            headers.forEach((th, index) => {
                th.addEventListener('click', () => {
                    // Toggle direction: if clicking same column, flip direction; otherwise use asc
                    const currentSort = localStorage.getItem(`farmerTableSort_${tableId}`);
                    let newDirection = 'asc';
                    if (currentSort) {
                        try {
                            const [savedCol, savedDir] = JSON.parse(currentSort);
                            if (savedCol === index) {
                                newDirection = savedDir === 'asc' ? 'desc' : 'asc';
                            }
                        } catch (_) {}
                    }
                    localStorage.setItem(`farmerTableSort_${tableId}`, JSON.stringify([index, newDirection]));
                });
            });
        }
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
        // Default to 'month' for verified users' metrics (orders, sold, revenue, recent orders, top products)
        this._kpiPeriods = { 'kpi-products': 'all', 'kpi-orders': 'month', 'kpi-sold': 'month', 'kpi-revenue': 'month' };
        this._reportPeriod = 'month';
        this._statusPeriod = 'month';
        this._recentOrdersPeriod = 'month';
        this._topProductsPeriod = 'month';
        // Load saved periods from localStorage
        this._loadPeriods();
        // Force reset to 'month' for verified users only if no saved periods exist (first-time load)
        // This allows premium users to keep their saved "all time" preference
        const hasSavedPeriods = localStorage.getItem('farmerDashboardPeriods');
        if (this.isVerified() && !hasSavedPeriods) {
            this._kpiPeriods = { 'kpi-products': 'all', 'kpi-orders': 'month', 'kpi-sold': 'month', 'kpi-revenue': 'month' };
            this._reportPeriod = 'month';
            this._statusPeriod = 'month';
            this._recentOrdersPeriod = 'month';
            this._topProductsPeriod = 'month';
            this._savePeriods();
        }
        // Update low stock threshold label
        const labelEl = document.getElementById('low-stock-threshold-label');
        if (labelEl) labelEl.textContent = `| ≤${this.lowStockThreshold}`;
        // Set active state in dropdown for current threshold
        const lowStockDropdown = document.querySelector('.dropdown-menu .low-stock-threshold')?.closest('.dropdown-menu');
        if (lowStockDropdown) {
            lowStockDropdown.querySelectorAll('.low-stock-threshold').forEach(item => {
                item.classList.remove('active');
                if (Number(item.dataset.threshold) === this.lowStockThreshold) {
                    item.classList.add('active');
                }
            });
        }
        this.pagination = {
            'recent-orders': { page: 1, total: 0, limit: 5 },
            'top-products': { page: 1, total: 0, limit: 5 },
            'products': { page: 1, total: 0, limit: 50 },
            'requests': { page: 1, total: 0, limit: 25 },
        };
        this.showDeniedBanner();
        await this.checkFarmerAuth();
        await this.loadVerificationStatus();
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
        this.loadNotifications();
        this.loadMessages();
        this.startChatPolling();
        this.startNotifPolling();
        this.updateHeaderUser();
        // Re-trigger verification UI update after header is updated
        this.updateVerificationUI();

        // Load initial section data before hiding loading screen
        this.loadInitialSectionData();
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
        
        // Reset to step 1
        document.getElementById('add-product-step-1').style.display = 'block';
        document.getElementById('add-product-step-2').style.display = 'none';
        
        // Check if farmer already has products of each type
        const hasAvailable = this.myProductsCache?.some(p => !p.is_preorder && p.status === 'approved');
        const hasPreorder = this.myProductsCache?.some(p => p.is_preorder && p.status === 'approved');
        
        // Disable cards if farmer already has that type
        const availableCard = document.getElementById('product-type-available');
        const preorderCard = document.getElementById('product-type-preorder');
        const warningDiv = document.getElementById('product-type-warning');
        const warningText = document.getElementById('product-type-warning-text');
        
        if (availableCard) {
            if (hasAvailable) {
                availableCard.classList.add('disabled');
                availableCard.style.opacity = '0.5';
                availableCard.style.pointerEvents = 'none';
            } else {
                availableCard.classList.remove('disabled');
                availableCard.style.opacity = '1';
                availableCard.style.pointerEvents = 'auto';
            }
        }
        
        if (preorderCard) {
            if (hasPreorder) {
                preorderCard.classList.add('disabled');
                preorderCard.style.opacity = '0.5';
                preorderCard.style.pointerEvents = 'none';
            } else {
                preorderCard.classList.remove('disabled');
                preorderCard.style.opacity = '1';
                preorderCard.style.pointerEvents = 'auto';
            }
        }
        
        // Show warning if both types are disabled
        if (hasAvailable && hasPreorder) {
            warningDiv.style.display = 'block';
            warningText.textContent = 'You already have both an Available Now and a Pre-order product. Contact support to add more.';
        } else if (hasAvailable) {
            warningDiv.style.display = 'block';
            warningText.textContent = 'You already have an Available Now product. You can add a Pre-order product.';
        } else if (hasPreorder) {
            warningDiv.style.display = 'block';
            warningText.textContent = 'You already have a Pre-order product. You can add an Available Now product.';
        } else {
            warningDiv.style.display = 'none';
        }
        
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

    selectProductType(productType) {
        const productTypeInput = document.getElementById('add-product-type');
        const availableFields = document.getElementById('available-now-fields');
        const preorderFields = document.getElementById('preorder-fields');
        
        if (productTypeInput) {
            productTypeInput.value = productType;
        }
        
        // Show/hide specific fields based on product type
        if (productType === 'available') {
            if (availableFields) availableFields.style.display = 'block';
            if (preorderFields) preorderFields.style.display = 'none';
        } else if (productType === 'preorder') {
            if (availableFields) availableFields.style.display = 'none';
            if (preorderFields) preorderFields.style.display = 'block';
        }
        
        // Re-render product name suggestions to filter out existing products for this type
        this.renderProductNameSuggestions('add', true);
        
        // Move to step 2
        document.getElementById('add-product-step-1').style.display = 'none';
        document.getElementById('add-product-step-2').style.display = 'block';
    }

    setupNonNegativeInputs() {
        const inputIds = [
            'product-price',
            'product-stock',
            'edit-price',
            'edit-stock-quantity'
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
                this.showMessage('Request submitted for admin approval.', 'success');
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
            const res = await fetch(`${this.apiBase}/products/requests/mine`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (res.ok) {
                const data = await res.json();
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
            } else {
                const listEl = document.getElementById('request-product-history');
                if (listEl) listEl.innerHTML = '<div class="overview-list-item">Failed to load requests</div>';
            }
        } catch (e) {
            console.error('Load request history error:', e);
        }
    }

    async loadRequestsTable() {
        try {
            const res = await fetch(`${this.apiBase}/products/product-requests/mine`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                this.renderRequestsTable(data.requests || []);
            } else {
                const tbody = document.getElementById('requests-tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3 small">Failed to load requests</td></tr>';
            }
        } catch (error) {
            console.error('Error loading requests:', error);
            const tbody = document.getElementById('requests-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3 small">Failed to load requests</td></tr>';
        }
    }

    renderRequestsTable(requests) {
        const tbody = document.getElementById('requests-tbody');
        if (!tbody) return;

        const list = Array.isArray(requests) ? requests : [];
        this.requestsCache = list;
        const pg = this.pagination['requests'];
        pg.total = list.length;

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3 small">No pending products</td></tr>';
            this.renderPagination('requests-pagination', pg, () => {});
            return;
        }

        const start = (pg.page - 1) * pg.limit;
        const pageItems = list.slice(start, start + pg.limit);

        tbody.innerHTML = pageItems.map(r => {
            const status = String(r.status || 'pending');
            const statusClass = status === 'approved' ? 'bg-success' : status === 'rejected' ? 'bg-danger' : 'bg-secondary';
            const cat = this.escapeHtml(r.category_name || 'Uncategorized');
            const when = new Date(r.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
            return `
            <tr>
                <td class="small text-center">#${r.id}</td>
                <td class="small">${this.escapeHtml(r.name)}</td>
                <td class="small">${cat}</td>
                <td class="small text-center">${when}</td>
                <td class="text-center"><span class="badge ${statusClass}">${status}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.farmerApp.viewRequestDetails(${r.id}, 'product_request')">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        this.renderPagination('requests-pagination', pg, (page) => {
            pg.page = page;
            this.renderRequestsTable(this.requestsCache);
        });
    }

    async viewRequestDetails(requestId, requestType = 'catalog_request') {
        try {
            const modal = document.getElementById('product-request-details-modal');
            const contentEl = document.getElementById('request-details-content');
            const resubmitBtn = document.getElementById('resubmit-product-request-btn');
            if (!modal || !contentEl) return;

            modal.classList.add('open');
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');

            // Hide resubmit button initially
            if (resubmitBtn) resubmitBtn.style.display = 'none';

            contentEl.innerHTML = `
                <div class="table-skeleton">
                    <div class="skeleton-row"></div>
                    <div class="skeleton-row"></div>
                    <div class="skeleton-row"></div>
                </div>
            `;

            if (requestType === 'product_request') {
                const res = await fetch(`${this.apiBase}/products/${requestId}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const product = data.product;
                    const status = product.status || 'pending';
                    const statusClass = status === 'approved' ? 'bg-success' : status === 'rejected' ? 'bg-danger' : 'bg-secondary';
                    const when = new Date(product.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    
                    // Show resubmit button for rejected products
                    if (status === 'rejected' && resubmitBtn) {
                        resubmitBtn.style.display = 'inline-block';
                        resubmitBtn.dataset.productId = requestId;
                    }
                    
                    contentEl.innerHTML = `
                        <div class="mb-3">
                            <label class="small text-muted">Product Name</label>
                            <div class="fw-bold">${this.escapeHtml(product.name)}</div>
                        </div>
                        <div class="mb-3">
                            <label class="small text-muted">Category</label>
                            <div>${this.escapeHtml(product.category_name || 'Uncategorized')}</div>
                        </div>
                        <div class="mb-3">
                            <label class="small text-muted">Description</label>
                            <div>${this.escapeHtml(product.description || 'No description')}</div>
                        </div>
                        <div class="mb-3">
                            <label class="small text-muted">Price</label>
                            <div>₱${this.fmtCurrency(product.price || 0)}</div>
                        </div>
                        <div class="mb-3">
                            <label class="small text-muted">Stock</label>
                            <div>${product.stock_quantity || 0} units</div>
                        </div>
                        <div class="mb-3">
                            <label class="small text-muted">Status</label>
                            <div><span class="badge ${statusClass}">${status}</span></div>
                        </div>
                        ${product.rejection_reason ? `
                        <div class="mb-3">
                            <label class="small text-muted">Rejection Reason</label>
                            <div class="text-danger">${this.escapeHtml(product.rejection_reason)}</div>
                        </div>
                        ` : ''}
                        <div class="mb-3">
                            <label class="small text-muted">Requested Date</label>
                            <div>${when}</div>
                        </div>
                    `;
                } else {
                    contentEl.innerHTML = '<div class="text-center text-muted py-3">Failed to load product details</div>';
                }
            } else {
                contentEl.innerHTML = '<div class="text-center text-muted py-3">Catalog request details not implemented yet</div>';
            }
        } catch (error) {
            console.error('Error loading request details:', error);
            const contentEl = document.getElementById('request-details-content');
            if (contentEl) contentEl.innerHTML = '<div class="text-center text-muted py-3">Failed to load details</div>';
        }
    }

    closeRequestDetailsModal() {
        const modal = document.getElementById('product-request-details-modal');
        if (!modal) return;
        modal.classList.remove('open');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    async resubmitProductRequest(productId) {
        try {
            const res = await fetch(`${this.apiBase}/products/${productId}/resubmit`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (res.ok) {
                this.showMessage('Product resubmitted for approval', 'success');
                this.closeRequestDetailsModal();
                this.loadRequestsTable();
            } else {
                this.showMessage(data.message || 'Failed to resubmit product', 'error');
            }
        } catch (error) {
            console.error('Resubmit product error:', error);
            this.showMessage('Failed to resubmit product', 'error');
        }
    }

    filterRequests() {
        const statusFilter = document.getElementById('request-status-filter')?.value || '';
        const searchInput = document.getElementById('requests-search-input')?.value?.toLowerCase() || 
                          document.getElementById('approval-search-input')?.value?.toLowerCase() || '';
        const categoryFilter = document.getElementById('approval-category-filter')?.value?.toLowerCase() || '';
        
        let filtered = this.requestsCache;
        
        if (statusFilter) {
            filtered = filtered.filter(r => String(r.status || 'pending') === statusFilter);
        }
        
        if (categoryFilter) {
            filtered = filtered.filter(r => 
                (r.category_name || r.requested_category_name || '').toLowerCase().includes(categoryFilter)
            );
        }
        
        if (searchInput) {
            filtered = filtered.filter(r => 
                (r.name || '').toLowerCase().includes(searchInput) ||
                (r.category_name || r.requested_category_name || '').toLowerCase().includes(searchInput)
            );
        }
        
        this.renderRequestsTable(filtered);
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

            // Listen for new chat messages - instant badge update
            es.addEventListener('chat.message', () => {
                this.loadMessages();
            });

            es.addEventListener('chat.read', () => {
                this.loadMessages();
            });

            // Listen for support ticket messages
            es.addEventListener('support.message', () => {
                this.loadSupportTicketsBadge();
            });

            // Listen for support ticket read events
            es.addEventListener('support.read', () => {
                this.loadSupportTicketsBadge();
            });

            // Listen for new notifications
            es.addEventListener('notification.created', (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.user_id === this.userId) {
                        this.loadNotifications();
                    }
                } catch (e) {
                    // If parsing fails, refresh anyway as fallback
                    this.loadNotifications();
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
                            <div style="font-size:13px;">You tried to open the Admin Panel. Only admin can access it.</div>
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
                // If a admin user opens farmer page, send them back to admin panel
                if (data.user.role === 'admin') {
                    this.showAdminDeniedBannerAndRedirect();
                    return;
                }
                if (data.user.role !== 'farmer') {
                    window.location.href = '/';
                    return;
                }
                const nameEl = document.getElementById('user-name');
                const shopName = data.user.shop_name || data.user.full_name || data.user.username || 'Farmer';
                const formattedShopName = shopName.split(' ').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
                if (nameEl) nameEl.textContent = formattedShopName;
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

                this.loadFarmerStats();
                this.loadMyProducts();
                this.loadMyOrders();
                this.loadShopProfile();
                await this.loadSubscription();
                this.loadOverviewMetrics({ force: true });
                this.loadAnnouncements();
                this.loadSupportTicketsBadge();
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
                            <div style="font-size:13px;">Admin users cannot access the Farmer Dashboard. Redirecting to Admin Panel...</div>
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

        // Pre-order checkbox toggle for add product form
        document.getElementById('is-preorder')?.addEventListener('change', (e) => {
            const preorderFields = document.getElementById('preorder-fields');
            if (preorderFields) {
                preorderFields.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Pre-order checkbox toggle for edit product form
        document.getElementById('edit-is-preorder')?.addEventListener('change', (e) => {
            const preorderFields = document.getElementById('edit-preorder-fields');
            if (preorderFields) {
                preorderFields.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Harvest confirmation modal
        document.getElementById('close-harvest-confirm-modal')?.addEventListener('click', () => {
            document.getElementById('harvest-confirm-modal').classList.remove('open');
        });
        document.getElementById('cancel-harvest-btn')?.addEventListener('click', () => {
            document.getElementById('harvest-confirm-modal').classList.remove('open');
        });
        document.getElementById('confirm-harvest-btn')?.addEventListener('click', () => {
            const productId = document.getElementById('confirm-harvest-btn').dataset.productId;
            if (productId) {
                this.handleHarvestPreorder(productId);
            }
            document.getElementById('harvest-confirm-modal').classList.remove('open');
        });

        // Convert confirmation modal
        document.getElementById('close-convert-confirm-modal')?.addEventListener('click', () => {
            document.getElementById('convert-confirm-modal').classList.remove('open');
        });
        document.getElementById('cancel-convert-btn')?.addEventListener('click', () => {
            document.getElementById('convert-confirm-modal').classList.remove('open');
        });
        document.getElementById('confirm-convert-btn')?.addEventListener('click', () => {
            const productId = document.getElementById('confirm-convert-btn').dataset.productId;
            if (productId) {
                this.handleConvertPreorder(productId);
            }
            document.getElementById('convert-confirm-modal').classList.remove('open');
        });

        // Disable confirmation modal
        document.getElementById('close-disable-confirm-modal')?.addEventListener('click', () => {
            document.getElementById('disable-confirm-modal').classList.remove('open');
        });
        document.getElementById('cancel-disable-btn')?.addEventListener('click', () => {
            document.getElementById('disable-confirm-modal').classList.remove('open');
        });
        document.getElementById('confirm-disable-btn')?.addEventListener('click', () => {
            const productId = document.getElementById('confirm-disable-btn').dataset.productId;
            if (productId) {
                this.handleDisableProduct(productId);
            }
            document.getElementById('disable-confirm-modal').classList.remove('open');
        });

        // Edit modal action buttons
        document.getElementById('edit-harvest-now-btn')?.addEventListener('click', () => {
            const productId = document.getElementById('edit-product-id').value;
            if (productId) {
                document.getElementById('confirm-harvest-btn').dataset.productId = productId;
                document.getElementById('harvest-confirm-modal').classList.add('open');
            }
        });

        document.getElementById('edit-convert-inventory-btn')?.addEventListener('click', () => {
            const productId = document.getElementById('edit-product-id').value;
            if (productId) {
                document.getElementById('confirm-convert-btn').dataset.productId = productId;
                document.getElementById('convert-confirm-modal').classList.add('open');
            }
        });

        document.getElementById('edit-disable-product-btn')?.addEventListener('click', () => {
            const productId = document.getElementById('edit-product-id').value;
            if (productId) {
                document.getElementById('confirm-disable-btn').dataset.productId = productId;
                document.getElementById('disable-confirm-modal').classList.add('open');
            }
        });

        // Edit management tabs - toggle button visibility
        const editAvailableTab = document.querySelector('button[data-bs-target="#edit-available-now-tab"]');
        const editPreorderTab = document.querySelector('button[data-bs-target="#edit-preorders-tab"]');
        const harvestBtn = document.getElementById('edit-harvest-now-btn');
        const convertBtn = document.getElementById('edit-convert-inventory-btn');

        if (editAvailableTab) {
            editAvailableTab.addEventListener('shown.bs.tab', () => {
                if (harvestBtn) harvestBtn.style.display = 'none';
                if (convertBtn) convertBtn.style.display = 'none';
            });
        }

        if (editPreorderTab) {
            editPreorderTab.addEventListener('shown.bs.tab', () => {
                if (harvestBtn) harvestBtn.style.display = 'inline-block';
                if (convertBtn) convertBtn.style.display = 'inline-block';
            });
        }

        document.getElementById('add-product-form')?.addEventListener('submit', (e) => this.handleAddProduct(e));
        document.getElementById('edit-product-form')?.addEventListener('submit', (e) => this.handleEditProduct(e));
        document.getElementById('save-shop-profile-btn')?.addEventListener('click', (e) => this.handleShopProfileUpdate(e));
        document.getElementById('profile-edit-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });
        document.getElementById('profile-password-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });

        // Event delegation for product action buttons
        document.addEventListener('click', (e) => {
            // Harvest button
            const harvestBtn = e.target.closest('.btn-action-harvest');
            if (harvestBtn) {
                const productId = harvestBtn.dataset.productId;
                if (productId) {
                    document.getElementById('confirm-harvest-btn').dataset.productId = productId;
                    document.getElementById('harvest-confirm-modal').classList.add('open');
                }
                return;
            }

            // Convert button
            const convertBtn = e.target.closest('.btn-action-convert');
            if (convertBtn) {
                const productId = convertBtn.dataset.productId;
                if (productId) {
                    document.getElementById('confirm-convert-btn').dataset.productId = productId;
                    document.getElementById('convert-confirm-modal').classList.add('open');
                }
                return;
            }

            // Disable button
            const disableBtn = e.target.closest('.btn-action-disable');
            if (disableBtn) {
                const productId = disableBtn.dataset.productId;
                if (productId) {
                    document.getElementById('confirm-disable-btn').dataset.productId = productId;
                    document.getElementById('disable-confirm-modal').classList.add('open');
                }
                return;
            }
        });

        // Product tabs - Bootstrap tab event listeners
        const availableNowTab = document.querySelector('button[data-bs-target="#available-now-tab"]');
        const preordersTab = document.querySelector('button[data-bs-target="#preorders-tab"]');
        const approvalTab = document.querySelector('button[data-bs-target="#approval-tab"]');

        if (availableNowTab) {
            availableNowTab.addEventListener('shown.bs.tab', () => {
                // Show Available Now KPI cards and filter
                document.getElementById('kpi-available').style.display = 'flex';
                document.getElementById('kpi-preorder').style.display = 'none';
                document.getElementById('kpi-approval').style.display = 'none';
                document.getElementById('filter-available').style.display = 'flex';
                document.getElementById('filter-preorder').style.display = 'none';
                document.getElementById('filter-approval').style.display = 'none';
                this.filterAvailableProducts();
            });
        }

        if (preordersTab) {
            preordersTab.addEventListener('shown.bs.tab', () => {
                // Show Pre-orders KPI cards and filter
                document.getElementById('kpi-available').style.display = 'none';
                document.getElementById('kpi-preorder').style.display = 'flex';
                document.getElementById('kpi-approval').style.display = 'none';
                document.getElementById('filter-available').style.display = 'none';
                document.getElementById('filter-preorder').style.display = 'flex';
                document.getElementById('filter-approval').style.display = 'none';
                this.filterPreorderProducts();
            });
        }

        if (approvalTab) {
            approvalTab.addEventListener('shown.bs.tab', () => {
                // Show Approval KPI cards and filter
                document.getElementById('kpi-available').style.display = 'none';
                document.getElementById('kpi-preorder').style.display = 'none';
                document.getElementById('kpi-approval').style.display = 'flex';
                document.getElementById('filter-available').style.display = 'none';
                document.getElementById('filter-preorder').style.display = 'none';
                document.getElementById('filter-approval').style.display = 'flex';
                this.loadRequestsTable();
            });
        }

        // Format phone input with spaces (9XX XXX XXXX)
        const pePhone = document.getElementById('pe-phone');
        if (pePhone) {
            pePhone.addEventListener('input', () => {
                // Remove non-digits
                let digits = pePhone.value.replace(/\D/g, '');
                // Limit to 10 digits
                if (digits.length > 10) digits = digits.slice(0, 10);
                // Format as 9XX XXX XXXX
                if (digits.length > 0) {
                    let formatted = digits[0];
                    if (digits.length > 1) formatted += digits.slice(1, 3);
                    if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
                    if (digits.length > 6) formatted += ' ' + digits.slice(6, 10);
                    pePhone.value = formatted;
                } else {
                    pePhone.value = '';
                }
            });
        }

        // Topbar dropdown links
        document.getElementById('show-all-messages-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSection('chat');
        });
        document.getElementById('show-all-notifications-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSection('notifications');
        });
        document.getElementById('view-all-messages-badge')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSection('chat');
        });
        document.getElementById('notif-mark-all-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.markAllNotifsRead();
        });

        // Order details modal close button
        document.getElementById('close-order-details-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('order-details-modal');
            if (modal) modal.classList.remove('open');
        });

        // Close modal on backdrop click
        document.getElementById('order-details-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'order-details-modal') {
                e.target.classList.remove('open');
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('order-details-modal');
                if (modal && modal.classList.contains('open')) {
                    modal.classList.remove('open');
                }
            }
        });

        // Stop chat and notifications polling when user leaves page
        window.addEventListener('beforeunload', () => {
            this.stopChatPolling();
            this.stopNotifPolling();
        });

        // Stop polling when tab is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopChatPolling();
                this.stopNotifPolling();
            } else {
                this.startChatPolling();
                this.startNotifPolling();
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            this.startChatPolling();
            this.startNotifPolling();
            this.showMessage('Connection restored. Syncing...', 'success');
        });

        window.addEventListener('offline', () => {
            this.stopChatPolling();
            this.stopNotifPolling();
            this.showMessage('You are offline. Some features may be limited.', 'warning');
        });

        const editShopBtn = document.getElementById('edit-shop-profile-btn');
        if (editShopBtn) {
            editShopBtn.addEventListener('click', () => this.setShopProfileEditMode(true));
        }
        const cancelShopBtn = document.getElementById('cancel-shop-profile-btn');
        if (cancelShopBtn) {
            cancelShopBtn.addEventListener('click', () => this.cancelShopProfileEdit());
        }

        // Support tickets
        document.getElementById('dropdown-support-tickets')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSection('support-tickets');
        });

        document.getElementById('btn-create-support-ticket')?.addEventListener('click', () => {
            this.openCreateTicketModal();
        });

        document.getElementById('btn-submit-support-ticket')?.addEventListener('click', () => {
            this.submitSupportTicket();
        });

        document.getElementById('support-ticket-subject')?.addEventListener('input', (e) => {
            document.getElementById('subject-char-count').textContent = `${e.target.value.length}/200 characters`;
        });

        document.getElementById('support-ticket-description')?.addEventListener('input', (e) => {
            const count = e.target.value.length;
            const counterEl = document.getElementById('description-char-count');
            counterEl.textContent = `${count}/500 characters`;
            counterEl.style.color = count > 450 ? 'red' : '';
        });

        document.getElementById('support-tickets-entries')?.addEventListener('change', (e) => {
            this.supportTicketsPerPage = parseInt(e.target.value);
            this.supportTicketsCurrentPage = 1;
            this.loadSupportTickets();
        });

        // Support ticket view button opens dedicated support ticket chat section
        document.querySelector('#support-tickets-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-ticket-btn');
            if (!btn) return;
            const ticketId = btn.dataset.id;
            if (!ticketId) return;
            this.showSection('support-ticket-chat');
            if (window.supportTicketChat && typeof window.supportTicketChat.openTicket === 'function') {
                setTimeout(() => window.supportTicketChat.openTicket(ticketId), 300);
            }
        });

        // My Requests tab - load requests when tab is shown
        const requestsTab = document.querySelector('button[data-bs-target="#products-requests-tab"]');
        if (requestsTab) {
            requestsTab.addEventListener('show.bs.tab', (e) => {
                if (!this.isVerified()) {
                    e.preventDefault();
                    this.showMessage('Please verify your account to view product approvals.', 'error');
                    return false;
                }
            });
            requestsTab.addEventListener('shown.bs.tab', () => {
                this.loadRequestsTable();
            });
        }

        // Requests search button
        document.getElementById('requests-search-btn')?.addEventListener('click', () => {
            this.filterRequests();
        });

        // Requests refresh button
        document.getElementById('requests-refresh-btn')?.addEventListener('click', () => {
            this.loadRequestsTable();
        });

        // Requests status filter
        document.getElementById('request-status-filter')?.addEventListener('change', () => {
            this.filterRequests();
        });

        // Approval search button
        document.getElementById('approval-search-btn')?.addEventListener('click', () => {
            this.filterRequests();
        });

        // Approval refresh button
        document.getElementById('approval-refresh-btn')?.addEventListener('click', () => {
            this.loadRequestsTable();
        });

        // Approval category filter
        document.getElementById('approval-category-filter')?.addEventListener('change', () => {
            this.filterRequests();
        });

        // Product request details modal close buttons
        document.getElementById('close-request-details-modal')?.addEventListener('click', () => {
            this.closeRequestDetailsModal();
        });
        document.getElementById('close-request-details-btn')?.addEventListener('click', () => {
            this.closeRequestDetailsModal();
        });
        document.getElementById('product-request-details-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'product-request-details-modal') {
                this.closeRequestDetailsModal();
            }
        });
        document.getElementById('resubmit-product-request-btn')?.addEventListener('click', () => {
            const btn = document.getElementById('resubmit-product-request-btn');
            const productId = btn?.dataset.productId;
            if (productId) {
                this.resubmitProductRequest(productId);
            }
        });

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

        const logoutDropdownBtn = document.getElementById('farmer-logout-menu-btn');
        if (logoutDropdownBtn) {
            logoutDropdownBtn.addEventListener('click', () => this.logout());
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
            // Premium restriction: only allow changing from 'month' if user is premium
            if (!this.isPremium() && period !== 'month') {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
            this._savePeriods();
        });

        // Status chart period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.status-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            // Premium restriction: only allow changing from 'month' if user is premium
            if (!this.isPremium() && period !== 'month') {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
            this._savePeriods();
        });

        // Recent orders period filter (independent, not synced)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.recent-orders-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            // Premium restriction: only allow changing from 'month' if user is premium
            if (!this.isPremium() && period !== 'month') {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            this._recentOrdersPeriod = period;
            const lbl = document.getElementById('recent-orders-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            this.loadRecentOrders(period);
            this._savePeriods();
        });

        // Top products period filter (independent, not synced)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.top-products-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            // Premium restriction: only allow changing from 'month' if user is premium
            if (!this.isPremium() && period !== 'month') {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            this._topProductsPeriod = period;
            const lbl = document.getElementById('top-products-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            this.loadTopProducts(period);
            this._savePeriods();
        });

        // Total orders period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.total-orders-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            // Verified users can always use "this month", premium users can use any period
            if (!this.isPremium() && period !== 'month') {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
            this._savePeriods();
        });

        // Items sold period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.items-sold-period-filter');
            if (!link) return;
            e.preventDefault();
            // Free tier restriction: only allow This Month
            if (!this.isPremium()) {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
            this._savePeriods();
        });

        // Total revenue period filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.total-revenue-period-filter');
            if (!link) return;
            e.preventDefault();
            // Free tier restriction: only allow This Month
            if (!this.isPremium()) {
                this.showToast('🚀 Unlock advanced analytics! Upgrade to Premium to access custom timeframes and detailed insights.', 'warning');
                return;
            }
            const period = link.dataset.period;
            this._syncAllPeriods(period);
            this.loadOverviewMetrics({ force: true });
            this._savePeriods();
        });

        // Low stock threshold filter
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.low-stock-threshold');
            if (!link) return;
            e.preventDefault();
            const threshold = Number(link.dataset.threshold);
            if (Number.isFinite(threshold) && threshold > 0) {
                this.lowStockThreshold = threshold;
                this._savePeriods();
                // Update active state in dropdown
                const dropdown = link.closest('.dropdown-menu');
                if (dropdown) {
                    dropdown.querySelectorAll('.low-stock-threshold').forEach(item => item.classList.remove('active'));
                    link.classList.add('active');
                }
                // Update label
                const labelEl = document.getElementById('low-stock-threshold-label');
                if (labelEl) labelEl.textContent = `| ≤${threshold}`;
                // Always reload products to ensure fresh data for KPI calculation
                this.loadMyProducts();
            }
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
            if (!this.isVerified()) {
                this.showMessage('Please verify your account before adding products.', 'error');
                return;
            }
            this.openAddProductModal();
        });

        const addProductModal = document.getElementById('add-product-modal');
        const closeAddProductModalBtn = document.getElementById('close-add-product-modal');
        const backToStep1Btn = document.getElementById('back-to-step-1');
        
        if (closeAddProductModalBtn) {
            closeAddProductModalBtn.addEventListener('click', () => this.closeAddProductModal());
        }
        if (backToStep1Btn) {
            backToStep1Btn.addEventListener('click', () => {
                document.getElementById('add-product-step-1').style.display = 'block';
                document.getElementById('add-product-step-2').style.display = 'none';
            });
        }
        
        // Product type card click handlers
        document.querySelectorAll('.product-type-card').forEach(card => {
            card.addEventListener('click', () => {
                const productType = card.dataset.productType;
                this.selectProductType(productType);
            });
        });

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

        // Schedule delivery modal event listeners
        const scheduleDeliveryModal = document.getElementById('schedule-delivery-modal');
        const scheduleDeliveryClose = document.getElementById('schedule-delivery-close');
        const scheduleDeliveryCancel = document.getElementById('schedule-delivery-cancel');
        const scheduleDeliveryForm = document.getElementById('schedule-delivery-form');
        if (scheduleDeliveryClose) {
            scheduleDeliveryClose.addEventListener('click', () => this.closeScheduleDeliveryModal());
        }
        if (scheduleDeliveryCancel) {
            scheduleDeliveryCancel.addEventListener('click', () => this.closeScheduleDeliveryModal());
        }
        if (scheduleDeliveryForm) {
            scheduleDeliveryForm.addEventListener('submit', (e) => this.submitScheduleDeliveryForm(e));
        }
        if (scheduleDeliveryModal) {
            scheduleDeliveryModal.addEventListener('click', (e) => {
                if (e.target === scheduleDeliveryModal) {
                    this.closeScheduleDeliveryModal();
                }
            });
        }

        // Rejection reason modal event listeners
        const rejectionReasonClose = document.getElementById('rejection-reason-close');
        const rejectionReasonCloseBtn = document.getElementById('rejection-reason-close-btn');
        const rejectionReasonModal = document.getElementById('rejection-reason-modal');
        
        if (rejectionReasonClose) {
            rejectionReasonClose.addEventListener('click', () => this.closeRejectionReasonModal());
        }
        if (rejectionReasonCloseBtn) {
            rejectionReasonCloseBtn.addEventListener('click', () => this.closeRejectionReasonModal());
        }
        if (rejectionReasonModal) {
            rejectionReasonModal.addEventListener('click', (e) => {
                if (e.target === rejectionReasonModal) {
                    this.closeRejectionReasonModal();
                }
            });
        }

        document.querySelectorAll('#customer-rating-modal .order-rating-star-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const rating = Number(btn.getAttribute('data-rating') || 0);
                this.setCustomerRatingValue(rating);
            });
        });

        // Order status tabs - all statuses including preorder_reserved and scheduled
        document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
        document.getElementById('preorder_reserved-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preorder_reserved'));
        document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
        document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
        document.getElementById('scheduled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('scheduled'));
        document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));

        // Subscription buttons
        document.getElementById('btn-upgrade-premium')?.addEventListener('click', () => this.openSubscriptionModal('upgrade'));
        document.getElementById('btn-extend-subscription')?.addEventListener('click', () => this.openSubscriptionModal('extend'));
        document.getElementById('btn-renew-premium')?.addEventListener('click', () => this.openSubscriptionModal('renew'));
        document.getElementById('btn-submit-subscription')?.addEventListener('click', () => this.submitSubscriptionRequest());

        // Available products filters
        document.getElementById('available-category-filter')?.addEventListener('change', () => this.filterAvailableProducts());
        document.getElementById('available-status-filter')?.addEventListener('change', () => this.filterAvailableProducts());
        document.getElementById('available-search-btn')?.addEventListener('click', () => this.filterAvailableProducts());
        document.getElementById('available-refresh-btn')?.addEventListener('click', () => this.loadMyProducts());
        
        const availableSearchInput = document.getElementById('available-search-input');
        if (availableSearchInput) {
            availableSearchInput.addEventListener('input', () => this.filterAvailableProducts());
            availableSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filterAvailableProducts();
                }
            });
        }
        
        // Preorder products filters
        document.getElementById('preorder-category-filter')?.addEventListener('change', () => this.filterPreorderProducts());
        document.getElementById('preorder-status-filter')?.addEventListener('change', () => this.filterPreorderProducts());
        document.getElementById('preorder-search-btn')?.addEventListener('click', () => this.filterPreorderProducts());
        document.getElementById('preorder-refresh-btn')?.addEventListener('click', () => this.loadMyProducts());
        
        const preorderSearchInput = document.getElementById('preorder-search-input');
        if (preorderSearchInput) {
            preorderSearchInput.addEventListener('input', () => this.filterPreorderProducts());
            preorderSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.filterPreorderProducts();
                }
            });
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

        // Event delegation for new Edit buttons
        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-action-edit');
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

            if (action === 'schedule-delivery') {
                const orderId = Number(btn.getAttribute('data-order-id'));
                if (!orderId || isNaN(orderId)) {
                    console.error('Invalid order ID for schedule delivery:', { orderId });
                    this.showMessage('Invalid order information. Please refresh the page.', 'error');
                    return;
                }
                this.openScheduleDeliveryModal(orderId);
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

            // Only show products from the selected category
            const names = await fetchNames(categoryId || null);
            this.catalogProductNames = names.map(item => ({
                name: String(item.name || '').trim(),
                default_unit: String(item.default_unit || 'kg').trim()
            })).filter(n => n.name);
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
        
        // For add mode, filter out product names that already exist for the selected product type
        let filteredSource = source;
        if (!isEdit && this.myProductsCache) {
            const productType = document.getElementById('add-product-type')?.value || '';
            const existingProductNames = this.myProductsCache
                .filter(p => {
                    if (productType === 'available') {
                        return !p.is_preorder;
                    } else if (productType === 'preorder') {
                        return p.is_preorder;
                    }
                    return false;
                })
                .map(p => String(p.name || '').trim().toLowerCase());
            
            filteredSource = source.filter(item => 
                !existingProductNames.includes(String(item.name).trim().toLowerCase())
            );
        }
        
        const matches = filteredSource
            .filter((item) => !query || String(item.name).toLowerCase().includes(query))
            .slice(0, 10);

        if (!matches.length) {
            listEl.classList.remove('open');
            listEl.innerHTML = '';
            return;
        }

        const currentValue = String(nameInput.value || '').trim().toLowerCase();
        listEl.innerHTML = matches.map((item) => {
            const isSelected = currentValue && String(item.name).toLowerCase() === currentValue;
            return `<button type="button" class="product-name-option${isSelected ? ' selected' : ''}" data-name="${this.escapeAttr(item.name)}" data-unit="${this.escapeAttr(item.default_unit)}">${this.escapeHtml(item.name)}</button>`;
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
                const selectedUnit = String(btn.getAttribute('data-unit') || 'kg').trim();
                nameInput.value = selected;
                // Store the selected unit for later use
                nameInput.dataset.selectedUnit = selectedUnit;
                // Update the unit display field
                const unitInput = document.getElementById(isEdit ? 'edit-product-unit' : 'product-unit');
                if (unitInput) {
                    unitInput.value = selectedUnit;
                }
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
        const priceInput = document.getElementById(isEdit ? 'edit-price' : 'product-price');
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
            const addNameEl = document.getElementById('product-name');
            if (addNameEl) {
                addNameEl.disabled = true;
                addNameEl.placeholder = 'Loading products...';
            }
            await this.loadProductCatalogNames(addCategory.dataset.value || addCategory.value || null);
            if (addNameEl) {
                addNameEl.disabled = false;
                addNameEl.placeholder = 'Select a product';
            }
            this.updatePriceSuggestion('add');
        });
        if (editCategory) editCategory.addEventListener('change', async () => {
            const editNameEl = document.getElementById('edit-product-name');
            if (editNameEl) editNameEl.value = '';
            this.syncProductNameAvailability('edit');
            if (editNameEl) {
                editNameEl.disabled = true;
                editNameEl.placeholder = 'Loading products...';
            }
            await this.loadProductCatalogNames(editCategory.dataset.value || editCategory.value || null);
            if (editNameEl) {
                editNameEl.disabled = false;
                editNameEl.placeholder = 'Select a product';
            }
            this.updatePriceSuggestion('edit');
        });

        const addPrice = document.getElementById('product-price');
        if (addPrice) addPrice.addEventListener('focus', () => this.updatePriceSuggestion('add'));

        const editPrice = document.getElementById('edit-price');
        if (editPrice) editPrice.addEventListener('focus', () => this.updatePriceSuggestion('edit'));

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

            this.showMessage('Request submitted for admin approval.', 'success');
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
        const hint = document.getElementById(isEdit ? 'edit-product-price-suggestion' : 'product-price-suggestion');
        const priceInput = document.getElementById(isEdit ? 'edit-price' : 'product-price');

        if (!nameInput || !hint) return;

        const name = String(nameInput.value || '').trim();
        const categoryId = String(categoryInput?.dataset?.value || categoryInput?.value || '').trim();
        const unit = String(nameInput?.dataset.selectedUnit || 'kg').trim();
        if (!name) {
            hint.textContent = 'Suggested price: —';
            return;
        }

        try {
            hint.textContent = 'Suggested price: checking...';
            const params = new URLSearchParams({ name });
            if (categoryId) params.set('category_id', categoryId);
            if (unit) params.set('unit', unit);

            const response = await fetch(`${this.apiBase}/products/pricing/suggestion?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                hint.textContent = 'Suggested price: —';
                return;
            }

            const data = await response.json();
            const hasSystemSample = Number(data?.sample_count || 0) > 0;
            const lowest = hasSystemSample ? Number(data.suggested_lowest_price || 0) : 0;
            hint.textContent = lowest > 0
                ? `Suggested price: ${this.fmtCurrency(lowest)}`
                : 'Suggested price: —';
        } catch (error) {
            console.error('Error updating price suggestion:', error);
            hint.textContent = 'Suggested price: —';
        }
    }

    setupSidebarNavigation() {
        // Prevent hash from appearing in URL - clear any hash immediately
        const clearHash = () => {
            if (window.location.hash) {
                window.history.replaceState({}, '', window.location.pathname + window.location.search);
            }
        };

        // Clear hash on page load
        clearHash();

        // Clear hash on hashchange
        window.addEventListener('hashchange', clearHash);

        const links = document.querySelectorAll('.admin-sidebar .sidebar-link[data-section]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (!section) return;
                this.showSection(section);
                document.body.classList.remove('toggle-sidebar');
                // Clear hash immediately
                if (window.location.hash) {
                    window.history.replaceState({}, '', window.location.pathname + window.location.search);
                }
            });
        });

        // Initial section based on saved state, hash, or default
        const validSections = new Set(['overview', 'products', 'orders', 'chat', 'shop', 'reviews', 'profile', 'notifications', 'subscription', 'support-tickets', 'support-ticket-chat']);
        const savedSectionRaw = localStorage.getItem('farmerActiveSection');
        const savedSection = String(savedSectionRaw || '').trim();
        const hash = String((window.location.hash || '')).replace('#', '').trim();

        const initialSection = validSections.has(savedSection)
            ? savedSection
            : (validSections.has(hash) ? hash : 'overview');

        this.showSection(initialSection);

        // Stop chat polling if initial section is chat (chat.js handles it)
        if (initialSection === 'chat') {
            this.stopChatPolling();
        }

        // Clear hash from URL after using it for initial section
        if (window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }

        // Load profile data immediately if profile section is active
        if (initialSection === 'profile') {
            this.loadProfile();
        }
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

    async showSection(section, tab = null) {
        const validSections = new Set(['overview', 'products', 'orders', 'chat', 'shop', 'reviews', 'profile', 'notifications', 'subscription', 'support-tickets', 'support-ticket-chat']);
        const normalized = String(section || '').trim();
        const safeSection = validSections.has(normalized) ? normalized : 'overview';

        // Clear notification highlight when leaving notifications section
        if (this.activeSection === 'notifications' && safeSection !== 'notifications') {
            this.clearNotificationHighlight();
        }

        // Resume chat polling when leaving chat section
        if (this.activeSection === 'chat' && safeSection !== 'chat') {
            this.startChatPolling();
        }

        this.activeSection = safeSection;
        // Save current section to localStorage
        localStorage.setItem('farmerActiveSection', safeSection);

        // Clear hash from URL when navigating - use setTimeout to ensure it runs after all event handlers
        setTimeout(() => {
            if (window.location.hash) {
                window.history.replaceState({}, '', window.location.pathname + window.location.search);
            }
        }, 0);

        document.querySelectorAll('.admin-sidebar .sidebar-link[data-section]').forEach(a => {
            a.classList.toggle('active', a.getAttribute('data-section') === safeSection);
        });
        document.querySelectorAll('main.admin-main .admin-section-card').forEach(sec => {
            sec.classList.toggle('active', sec.id === safeSection);
        });

        // Prevent body scroll when chat section is active
        document.body.classList.toggle('chat-section-active', safeSection === 'chat');

        // Auto-switch to pending tab when orders section is opened
        if (safeSection === 'orders') {
            this.switchOrderTab('pending');
        }

        // Load profile when profile section is opened
        if (safeSection === 'profile') {
            this.loadProfile();
            this.activateProfileTab(tab || 'overview');
        }

        // Auto-select first ticket when support-ticket-chat section is opened
        if (safeSection === 'support-ticket-chat') {
            if (window.supportTicketChat && typeof window.supportTicketChat.onSectionVisible === 'function') {
                window.supportTicketChat.onSectionVisible();
            }
        }

        // Hide breadcrumbs when support-ticket-chat section is active
        const pagetitle = document.querySelector('.pagetitle');
        if (pagetitle) {
            pagetitle.style.display = safeSection === 'support-ticket-chat' ? 'none' : '';
        }

        // Load notifications when notifications section is opened
        if (safeSection === 'notifications') {
            this.loadNotifications(1).then(() => {
                // Apply highlight after notifications are loaded and DOM is updated
                requestAnimationFrame(() => {
                    if (this.highlightedNotifId) {
                        const item = document.querySelector(`.notification-item[data-id="${this.highlightedNotifId}"]`);
                        if (item) {
                            item.classList.add('highlighted');
                            item.style.background = '#fef9c3';
                            item.style.borderColor = '#facc15';
                            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Mark as read
                            this.markNotifRead(this.highlightedNotifId, null, true);

                            // Transition from yellow highlight to read status after 1 second
                            setTimeout(() => {
                                item.style.background = '#fafafa';
                                item.style.borderColor = '#e5e7eb';
                                item.style.opacity = '0.7';
                                this.highlightedNotifId = null;
                            }, 1000);
                        }
                    }
                });
            });
        }

        // Load support tickets when support-tickets section is opened
        if (safeSection === 'support-tickets') {
            this.loadSupportTickets();
        }

        // Load data when navigating to sections
        if (safeSection === 'products') {
            this.loadMyProducts();
        } else if (safeSection === 'reviews') {
            this.loadReviews(1);
        } else if (safeSection === 'shop') {
            this.loadShopProfile();
        } else if (safeSection === 'subscription') {
            this.loadSubscription();
        } else if (safeSection === 'overview') {
            // Ensure subscription data is loaded before checking premium status
            if (!this.subscriptionData) {
                await this.loadSubscription();
            }
            // Clear KPI values to N/A immediately only for unverified farmers to prevent visual flash
            if (!this.isVerified()) {
                this.clearKpiValues();
            }
            this.loadOverviewMetrics();
            this.loadAnnouncements();
        }

        const titles = {
            overview: 'Overview',
            products: 'My Products',
            orders: 'Order Management',
            chat: 'Messages',
            shop: 'Shop Profile',
            reviews: 'Reviews',
            profile: 'My Profile',
            notifications: 'Notifications',
            subscription: 'Subscription',
            'support-tickets': 'Support Tickets'
        };
        const titleEl = document.getElementById('farmer-page-title');
        if (titleEl) {
            // Hide page title for all sections with hero titles (all except overview)
            titleEl.style.display = safeSection === 'overview' ? 'block' : 'none';
            titleEl.textContent = titles[safeSection] || 'Overview';
        }

        // Update breadcrumb
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbCurrent) {
            const breadcrumbLabels = {
                overview: 'Farmer Dashboard',
                products: 'My Products',
                orders: 'Order Management',
                reviews: 'Reviews',
                shop: 'Shop Profile',
                chat: 'Messages',
                profile: 'My Profile',
                notifications: 'Notifications',
                subscription: 'Subscription',
                'support-tickets': 'Support Tickets'
            };
            breadcrumbCurrent.textContent = breadcrumbLabels[safeSection] || 'Farmer Dashboard';
        }

        // Load data when switching to specific sections
        if (safeSection === 'orders') {
            this.loadMyOrders();
        } else if (safeSection === 'products') {
            this.switchTab('list-products');
            this.loadMyProducts();
        } else if (safeSection === 'chat') {
            this.loadFarmerStats({ skipProducts: true });
            // Stop farmer.js chat polling since chat.js handles it in chat section
            this.stopChatPolling();
        } else if (safeSection === 'shop') {
            this.loadShopProfile();
        } else if (safeSection === 'subscription') {
            this.loadSubscription();
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

    activateProfileTab(tab = 'overview') {
        const targetMap = {
            overview: '#profile-overview',
            verification: '#profile-verification',
            edit: '#profile-edit',
            password: '#profile-change-password'
        };
        const targetSelector = targetMap[String(tab || 'overview').trim()] || targetMap.overview;
        const tabs = document.querySelectorAll('#profileTabs .nav-link');
        const panes = document.querySelectorAll('#profile .tab-pane');

        tabs.forEach((btn) => {
            const isActive = btn.getAttribute('data-bs-target') === targetSelector;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panes.forEach((pane) => {
            const isActive = `#${pane.id}` === targetSelector;
            pane.classList.toggle('show', isActive);
            pane.classList.toggle('active', isActive);
        });

        // Load verification status when verification tab is activated
        if (tab === 'verification') {
            this.loadVerificationStatus();
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
                        const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
                        return isAvailable && p.status === 'approved' && !isAdminDisabled;
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

                // Also update dropdown chat badge
                const dropdownChatBadge = document.getElementById('dropdown-chat-badge');
                if (dropdownChatBadge) {
                    dropdownChatBadge.textContent = this.fmtNumber(unread);
                    dropdownChatBadge.style.display = Number(unread) > 0 ? 'inline-block' : 'none';
                }

                // Also update topbar chat badge
                const topbarChatBadge = document.getElementById('chat-topbar-badge');
                if (topbarChatBadge) {
                    topbarChatBadge.textContent = this.fmtNumber(unread);
                    topbarChatBadge.style.display = Number(unread) > 0 ? 'inline-block' : 'none';
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

                const displayName = profile.shop_name || '—';
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
                    const v = profile.shop_name || '';
                    shopNameInput.value = v;
                    shopNameInput.placeholder = displayName || 'My Farm Shop';
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

    async loadProfile() {
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user || data;

                // Update profile card
                const shopNameEl = document.getElementById('profile-shop-name');
                const ownerNameEl = document.getElementById('profile-owner-name');
                const roleEl = document.getElementById('profile-role');
                const avatarImg = document.getElementById('profile-avatar-img');
                const avatarInitial = document.getElementById('profile-avatar-initial');
                if (shopNameEl) shopNameEl.textContent = user.shop_name || '—';
                if (ownerNameEl) ownerNameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';
                if (roleEl) roleEl.textContent = (user.role || '—').toUpperCase();
                
                // Handle avatar display
                if (avatarImg && avatarInitial) {
                    if (user.avatar_url) {
                        avatarImg.src = user.avatar_url;
                        avatarImg.style.display = 'block';
                        avatarInitial.style.display = 'none';
                    } else {
                        avatarImg.style.display = 'none';
                        const initial = (user.shop_name || user.first_name || user.username || 'F').charAt(0).toUpperCase();
                        avatarInitial.textContent = initial;
                        avatarInitial.style.display = 'flex';
                    }
                }

                // Update overview tab
                const poShopName = document.getElementById('po-shop-name');
                const poOwnerName = document.getElementById('po-owner-name');
                const poEmail = document.getElementById('po-email');
                const poPhone = document.getElementById('po-phone');
                const poRole = document.getElementById('po-role');
                const poJoined = document.getElementById('po-joined');

                if (poShopName) poShopName.textContent = user.shop_name || '—';
                if (poOwnerName) poOwnerName.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';
                if (poEmail) poEmail.textContent = user.email || '—';
                if (poPhone) poPhone.textContent = user.phone ? `+63${user.phone}` : '—';
                if (poRole) poRole.textContent = (user.role || '—').toUpperCase();
                if (poJoined) poJoined.textContent = user.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '—';

                // Pre-populate edit form
                const peFirstname = document.getElementById('pe-firstname');
                const peMiddlename = document.getElementById('pe-middlename');
                const peLastname = document.getElementById('pe-lastname');
                const pePhone = document.getElementById('pe-phone');

                if (peFirstname) peFirstname.value = user.first_name || '';
                if (peMiddlename) peMiddlename.value = user.middle_name || '';
                if (peLastname) peLastname.value = user.last_name || '';

                // Disable name fields if verified
                const isVerified = this.currentVerificationRequest?.status === 'approved' || user.is_verified === true;
                const nameInputs = [peFirstname, peMiddlename, peLastname];
                const verifiedHint = document.getElementById('pe-name-verified-hint');

                nameInputs.forEach(el => {
                    if (el) {
                        el.disabled = isVerified;
                    }
                });

                if (verifiedHint) {
                    verifiedHint.style.display = isVerified ? 'block' : 'none';
                }

                if (pePhone) {
                    // Format phone with spaces (9XX XXX XXXX)
                    const phoneDigits = String(user.phone || '').replace(/\D/g, '');
                    if (phoneDigits.length > 0) {
                        let formatted = phoneDigits[0];
                        if (phoneDigits.length > 1) formatted += phoneDigits.slice(1, 3);
                        if (phoneDigits.length > 3) formatted += ' ' + phoneDigits.slice(3, 6);
                        if (phoneDigits.length > 6) formatted += ' ' + phoneDigits.slice(6, 10);
                        pePhone.value = formatted;
                    } else {
                        pePhone.value = '';
                    }
                }
            } else {
                console.error('Profile response not OK:', response.status);
                this.showMessage('Failed to load profile', 'error');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showMessage('Error loading profile', 'error');
        }
    }

    // ── Subscription Methods ─────────────────────────────────────────────────
    async loadSubscription() {
        try {
            const [subRes, userRes] = await Promise.all([
                fetch(`${this.apiBase}/subscriptions/farmers/me/subscription`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }),
                fetch(`${this.apiBase}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                })
            ]);
            let hasFarmerProfile = false;
            if (userRes.ok) {
                const userData = await userRes.json();
                hasFarmerProfile = userData.user?.role === 'farmer';
            }
            if (subRes.ok) {
                this.subscriptionData = await subRes.json();
                if (!hasFarmerProfile) {
                    this.subscriptionData.profile_incomplete = true;
                }
            }
            this.updateSubscriptionUI();
            this.updatePremiumBadge();
            this.updateAddProductButton();
            this.loadSubscriptionHistory();
        } catch (e) { console.error('Load subscription error:', e); }
    }

    async loadSubscriptionHistory() {
        try {
            const res = await fetch(`${this.apiBase}/subscriptions/farmers/me/subscription/history`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                this.renderSubscriptionHistory(data.history || []);
            } else {
                document.getElementById('subscription-history-container').innerHTML = '<p class="text-muted small">Failed to load history.</p>';
            }
        } catch (e) {
            console.error('Load subscription history error:', e);
            document.getElementById('subscription-history-container').innerHTML = '<p class="text-muted small">Failed to load history.</p>';
        }
    }

    renderSubscriptionHistory(history) {
        const container = document.getElementById('subscription-history-container');
        if (!history || history.length === 0) {
            container.innerHTML = '<p class="text-muted small">No subscription history yet.</p>';
            return;
        }

        const statusColors = {
            pending: 'bg-warning',
            active: 'bg-success',
            expired: 'bg-secondary',
            rejected: 'bg-danger'
        };

        const statusIcons = {
            pending: 'hourglass',
            active: 'check-circle',
            expired: 'x-circle',
            rejected: 'x-circle'
        };

        let html = '<div class="table-responsive"><table class="table table-sm table-hover">';
        html += '<thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Period</th><th>Actions</th></tr></thead><tbody>';

        history.forEach(sub => {
            const date = new Date(sub.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
            const months = sub.plan_duration_months || 1;
            const amount = sub.amount_paid ? `₱${parseFloat(sub.amount_paid).toLocaleString()}` : '—';
            const status = sub.status || 'unknown';
            const statusClass = statusColors[status] || 'bg-secondary';
            const statusIcon = statusIcons[status] || 'question-circle';

            let period = '—';
            if (sub.starts_at && sub.expires_at) {
                const start = new Date(sub.starts_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
                const end = new Date(sub.expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                period = `${start} - ${end}`;
            }

            html += `
                <tr>
                    <td class="small">${date}</td>
                    <td class="small">${months} Month${months > 1 ? 's' : ''}</td>
                    <td class="small">${amount}</td>
                    <td><span class="badge ${statusClass}"><i class="bi bi-${statusIcon} me-1"></i>${status}</span></td>
                    <td class="small">${period}</td>
                    <td class="small">
                        <button class="btn btn-sm btn-success view-subscription-details-btn" data-id="${sub.id}">View</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Wire view details buttons
        container.querySelectorAll('.view-subscription-details-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const subscriptionId = btn.dataset.id;
                await this.showSubscriptionDetails(subscriptionId);
            });
        });
    }

    async showSubscriptionDetails(subscriptionId) {
        try {
            const res = await fetch(`${this.apiBase}/subscriptions/farmers/me/subscription/history`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) {
                this.showMessage('Failed to load subscription details', 'error');
                return;
            }
            const data = await res.json();
            const subscription = data.history.find(s => s.id === subscriptionId);
            
            if (!subscription) {
                this.showMessage('Subscription not found', 'error');
                return;
            }

            // Populate modal with full details
            const status = subscription.status || 'unknown';
            const statusClass = status === 'active' ? 'success' : status === 'pending' ? 'warning' : status === 'rejected' ? 'danger' : 'secondary';
            
            let reasonHtml = '';
            if (status === 'rejected' && subscription.rejection_reason) {
                reasonHtml = `
                    <div class="mt-3 p-3 bg-danger bg-opacity-10 rounded">
                        <label class="small fw-semibold text-danger">Rejection Reason</label>
                        <p class="mb-0 small text-danger">${this.escapeHtml(subscription.rejection_reason)}</p>
                    </div>
                `;
            } else if (status === 'expired' && subscription.expiry_reason) {
                reasonHtml = `
                    <div class="mt-3 p-3 bg-danger bg-opacity-10 rounded">
                        <label class="small fw-semibold text-danger">Expiry Reason</label>
                        <p class="mb-0 small text-danger">${this.escapeHtml(subscription.expiry_reason)}</p>
                    </div>
                `;
            }

            const modalHtml = `
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Plan</label>
                        <div class="fw-semibold">${subscription.tier || '—'}</div>
                    </div>
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Duration</label>
                        <div>${subscription.plan_duration_months} month${subscription.plan_duration_months > 1 ? 's' : ''}</div>
                    </div>
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Amount Paid</label>
                        <div>₱${Number(subscription.amount_paid || 0).toLocaleString()}</div>
                    </div>
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Status</label>
                        <div><span class="badge bg-${statusClass}">${status}</span></div>
                    </div>
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Requested Date</label>
                        <div>${new Date(subscription.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    ${subscription.starts_at ? `
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Start Date</label>
                        <div>${new Date(subscription.starts_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    ` : ''}
                    ${subscription.expires_at ? `
                    <div class="col-md-6">
                        <label class="small fw-semibold text-muted">Expiry Date</label>
                        <div>${new Date(subscription.expires_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    ` : ''}
                </div>
                ${reasonHtml}
            `;

            document.getElementById('subscription-reason-modal-title').textContent = 'Subscription Details';
            document.getElementById('subscription-reason-text').innerHTML = modalHtml;
            new bootstrap.Modal(document.getElementById('subscription-reason-modal')).show();
        } catch (e) {
            console.error('Error loading subscription details:', e);
            this.showMessage('Error loading subscription details', 'error');
        }
    }

    updateSubscriptionUI() {
        const d = this.subscriptionData;
        if (!d) {
            // Default to free tier if no data
            const freePanel = document.getElementById('subscription-free-panel');
            if (freePanel) freePanel.style.display = 'block';
            ['active','pending','expired'].forEach(s => {
                const p = document.getElementById(`subscription-${s}-panel`);
                if (p) p.style.display = 'none';
            });
            return;
        }
        const panels = ['free','active','pending','expired'].map(s => document.getElementById(`subscription-${s}-panel`));
        const badge = document.getElementById('subscription-status-badge');
        panels.forEach(p => { if(p) p.style.display = 'none'; });
        if (badge) badge.style.display = 'none';
        const show = (id, status, badgeClass) => {
            const el = document.getElementById(`subscription-${id}-panel`);
            if (el) el.style.display = 'block';
            if (badge) { badge.textContent = status; badge.className = `badge ${badgeClass} ms-auto`; badge.style.display = 'inline'; }
        };
        if (d.profile_incomplete) {
            const freePanel = document.getElementById('subscription-free-panel');
            if (freePanel) {
                // Show the comparison cards first, then add profile completion prompt
                const existingContent = freePanel.innerHTML;
                freePanel.innerHTML = `
                    <div class="alert alert-info mb-3">
                        <i class="bi bi-info-circle"></i> Complete your farmer profile to access subscription features.
                    </div>
                    <button class="btn ac-btn-primary btn-sm mb-3" onclick="window.farmerDashboard.showSection('profile','edit');return false;">
                        <i class="bi bi-person-check me-1"></i>Complete Profile
                    </button>
                    ${existingContent}
                `;
            }
            ['active','pending','expired'].forEach(s => {
                const p = document.getElementById(`subscription-${s}-panel`);
                if (p) p.style.display = 'none';
            });
            return;
        }
        if (d.status === 'pending') show('pending','Pending','bg-warning');
        else if (d.status === 'active') {
            show('active','Premium','bg-success');
            const expEl = document.getElementById('subscription-expiry-date');
            if (expEl && d.expires_at) expEl.textContent = new Date(d.expires_at).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
            // Expiry warning
            const warnEl = document.getElementById('subscription-expiry-warning');
            if (warnEl && d.expires_at) {
                const daysLeft = Math.ceil((new Date(d.expires_at) - new Date()) / (1000*60*60*24));
                if (daysLeft <= 7 && daysLeft > 0) {
                    warnEl.style.display = 'block';
                    warnEl.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Your Premium subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.</div>`;
                } else if (daysLeft <= 0) {
                    warnEl.style.display = 'block';
                    warnEl.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-circle"></i> Your Premium subscription has expired.</div>`;
                } else {
                    warnEl.style.display = 'none';
                }
            }
        } else if (d.status === 'expired') show('expired','Expired','bg-danger');
        else show('free','Free','bg-secondary');
    }

    updatePremiumBadge() {
        const icon = document.getElementById('header-premium-icon');
        if (!icon) return;
        const show = this.subscriptionData?.status === 'active';
        icon.style.display = show ? 'inline-block' : 'none';
        if (show && typeof bootstrap !== 'undefined') new bootstrap.Tooltip(icon);
    }

    updateAddProductButton() {
        const btn = document.getElementById('btn-add-product');
        if (!btn) return;
        const isVerified = this.isVerified();
        if (!isVerified) {
            btn.disabled = true;
            btn.title = 'Verify your account to start selling products';
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-primary', 'ac-btn-primary');
        } else {
            btn.disabled = false;
            btn.title = '';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-secondary');
        }
    }

    async openSubscriptionModal(mode) {
        // Check if user is verified before allowing premium upgrade
        if (!this.isVerified()) {
            this.showSection('profile', 'verification');
            this.showMessage('Please verify your account before upgrading to Premium.', 'warning');
            return;
        }

        const settingsRes = await fetch(`${this.apiBase}/subscriptions/settings`);
        const settings = await settingsRes.json();

        // Populate payment accounts dropdown
        const accountSelect = document.getElementById('sub-payment-account');
        accountSelect.innerHTML = '';
        if (settings.payment_accounts && settings.payment_accounts.length > 0) {
            settings.payment_accounts.forEach(acc => {
                const opt = document.createElement('option');
                opt.value = acc.id;
                opt.textContent = `${acc.name} (${acc.type === 'gcash' ? 'GCash' : 'Bank'}) — ${acc.account_number}`;
                accountSelect.appendChild(opt);
            });
            this.selectedPaymentAccount = settings.payment_accounts[0];
            this.showPaymentAccountDetails(this.selectedPaymentAccount);
        } else {
            accountSelect.innerHTML = '<option value="">No payment accounts available</option>';
        }
        accountSelect.onchange = (e) => {
            const selected = settings.payment_accounts.find(a => a.id === e.target.value);
            this.selectedPaymentAccount = selected || null;
            this.showPaymentAccountDetails(selected);
        };

        const opts = document.getElementById('subscription-plan-options');
        opts.innerHTML = '';
        Object.entries(settings.durations).forEach(([m, info]) => {
            const col = document.createElement('div'); col.className = 'col-md-4';
            const isDefault = m === '1';
            const borderClass = isDefault ? 'border-success' : '';
            const bgClass = isDefault ? 'bg-light' : '';
            col.innerHTML = `<div class="card h-100 plan-option ${borderClass} ${bgClass}" data-months="${m}" style="border-width:2px; border-color:${isDefault ? 'var(--ac-primary,#2d7a3a)' : 'var(--ac-border)'};">
                <div class="card-body text-center">
                    <h5>${info.months} Month${info.months>1?'s':''}</h5>
                    <p class="fw-bold mb-1" style="color:var(--ac-primary,#2d7a3a);">₱${info.total.toLocaleString()}</p>
                    ${info.discount_pct>0?`<small style="color:var(--ac-primary-dark,#1e5429);">Save ${info.discount_pct}%</small>`:''}
                </div></div>`;
            col.querySelector('.plan-option').addEventListener('click', () => {
                opts.querySelectorAll('.plan-option').forEach(el => {
                    el.classList.remove('border-success','bg-light');
                    el.style.borderColor = 'var(--ac-border)';
                });
                const selectedEl = col.querySelector('.plan-option');
                selectedEl.classList.add('border-success','bg-light');
                selectedEl.style.borderColor = 'var(--ac-primary,#2d7a3a)';
                this.selectedDuration = Number(m);
                document.getElementById('sub-amount-total').textContent = `₱${info.total.toLocaleString()}`;
                document.getElementById('sub-amount-total').dataset.amount = info.total;
                this.updateNewExpiryPreview();
            });
            opts.appendChild(col);
        });
        this.selectedDuration = 1;
        document.getElementById('sub-amount-total').textContent = `₱${settings.durations[1].total.toLocaleString()}`;
        document.getElementById('sub-amount-total').dataset.amount = settings.durations[1].total;
        const title = document.getElementById('subscription-modal-title');
        const currentInfo = document.getElementById('subscription-current-info');
        if (mode === 'extend' && this.subscriptionData?.expires_at) {
            title.textContent = 'Extend Subscription';
            currentInfo.style.display = 'block';
            document.getElementById('sub-current-expiry').textContent = new Date(this.subscriptionData.expires_at).toLocaleDateString('en-PH');
            this.updateNewExpiryPreview();
        } else {
            title.textContent = mode === 'renew' ? 'Renew Premium' : 'Go Premium';
            currentInfo.style.display = 'none';
        }
        new bootstrap.Modal(document.getElementById('subscription-modal')).show();
    }

    showPaymentAccountDetails(selected) {
        const details = document.getElementById('sub-payment-details');
        if (!selected) { if (details) details.style.display = 'none'; return; }
        document.getElementById('sub-pay-name').textContent = selected.name || '—';
        document.getElementById('sub-pay-number').textContent = selected.account_number || '—';
        document.getElementById('sub-pay-type').textContent = selected.type === 'gcash' ? 'GCash' : 'Bank Transfer';
        details.style.display = 'block';
    }

    updateNewExpiryPreview() {
        const months = this.selectedDuration;
        const currentExpiry = this.subscriptionData?.expires_at ? new Date(this.subscriptionData.expires_at) : new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setMonth(newExpiry.getMonth() + months);
        const el = document.getElementById('sub-new-expiry');
        if (el) el.textContent = newExpiry.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    async submitSubscriptionRequest() {
        const input = document.getElementById('sub-payment-proof');
        const submitBtn = document.getElementById('btn-submit-subscription');
        if (!input?.files?.length) {
            input?.classList.add('is-invalid');
            input?.focus();
            this.showMessage('Please upload your payment receipt screenshot before submitting.', 'error');
            return;
        }
        input.classList.remove('is-invalid');
        if (!this.selectedPaymentAccount) { this.showMessage('Please select a payment account.', 'error'); return; }

        // Loading state
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting...';

        const formData = new FormData();
        formData.append('payment_proof', input.files[0]);
        formData.append('plan_duration_months', this.selectedDuration);
        formData.append('payment_account_id', this.selectedPaymentAccount.id);
        formData.append('payment_method', this.selectedPaymentAccount.type);
        formData.append('expected_amount', document.getElementById('sub-amount-total').dataset.amount || '');

        try {
            const res = await fetch(`${this.apiBase}/subscriptions/farmers/me/subscription/request`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${this.token}` }, body: formData
            });
            const data = await res.json();
            if (res.ok) {
                bootstrap.Modal.getInstance(document.getElementById('subscription-modal')).hide();
                this.showMessage(data.message || 'Subscription request submitted.', 'success');
                input.value = ''; // Clear file input
                await this.loadSubscription();
            } else {
                const msg = data.message || 'Failed to submit request.';
                const userMsg = msg.toLowerCase().includes('cloudinary')
                    ? 'Failed to upload image. Please try again.'
                    : msg;
                this.showMessage(userMsg, 'error');
            }
        } catch (e) {
            console.error(e);
            this.showMessage('Network error. Please try again.', 'error');
        }
        finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async updateProfile() {
        const firstname = document.getElementById('pe-firstname').value.trim();
        const middlename = document.getElementById('pe-middlename').value.trim();
        const lastname = document.getElementById('pe-lastname').value.trim();
        const phone = document.getElementById('pe-phone').value.trim();

        if (!firstname || !lastname) {
            this.showMessage('First name and last name are required', 'error');
            return;
        }
        if (firstname.length > 40) {
            this.showMessage('First name must be 40 characters or less', 'error'); return;
        }
        if (middlename.length > 40) {
            this.showMessage('Middle name must be 40 characters or less', 'error'); return;
        }
        if (lastname.length > 40) {
            this.showMessage('Last name must be 40 characters or less', 'error'); return;
        }

        // Validate phone format (remove spaces for validation)
        const phoneDigits = phone.replace(/\s/g, '');
        if (phoneDigits && !/^9[0-9]{9}$/.test(phoneDigits)) {
            this.showMessage('Phone must be 10 digits starting with 9 (e.g. 912 345 6789)', 'error');
            return;
        }

        const saveBtn = document.getElementById('profile-save-btn');
        const spinner = document.getElementById('profile-save-spinner');
        const btnText = saveBtn.querySelector('.btn-text');

        saveBtn.disabled = true;
        spinner.classList.remove('d-none');
        btnText.textContent = 'Saving...';

        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ first_name: firstname, middle_name: middlename, last_name: lastname, phone: phoneDigits })
            });

            if (response.ok) {
                this.showMessage('Profile updated successfully', 'success');
                this.loadProfile();
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showMessage('Error updating profile', 'error');
        } finally {
            saveBtn.disabled = false;
            spinner.classList.add('d-none');
            btnText.textContent = 'Save Changes';
        }
    }

    async changePassword() {
        const current = document.getElementById('pp-current').value;
        const newPass = document.getElementById('pp-new').value;
        const confirm = document.getElementById('pp-confirm').value;
        const errorEl = document.getElementById('pp-error');

        if (!current || !newPass || !confirm) {
            errorEl.textContent = 'All password fields are required';
            errorEl.classList.remove('d-none');
            return;
        }

        if (newPass !== confirm) {
            errorEl.textContent = 'New password and confirmation do not match';
            errorEl.classList.remove('d-none');
            return;
        }

        if (newPass.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters';
            errorEl.classList.remove('d-none');
            return;
        }

        const submitBtn = document.getElementById('pp-submit-btn');
        const spinner = document.getElementById('pp-spinner');
        const btnText = submitBtn.querySelector('.btn-text');

        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        btnText.textContent = 'Changing...';
        errorEl.classList.add('d-none');

        try {
            const response = await fetch(`${this.apiBase}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ current_password: current, new_password: newPass })
            });

            if (response.ok) {
                this.showMessage('Password changed successfully', 'success');
                document.getElementById('profile-password-form').reset();
            } else {
                const errorData = await response.json();
                errorEl.textContent = errorData.message || 'Failed to change password';
                errorEl.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            errorEl.textContent = 'Error changing password';
            errorEl.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
            btnText.textContent = 'Change Password';
        }
    }

    togglePassword(inputId, button) {
        const input = document.getElementById(inputId);
        const icon = button.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('bi-eye-slash');
            icon.classList.add('bi-eye');
        } else {
            input.type = 'password';
            icon.classList.remove('bi-eye');
            icon.classList.add('bi-eye-slash');
        }
    }

    async loadNotifications(page = 1) {
        try {
            // Load notifications (no loading spinner for polling)
            const limit = 20;
            const res = await fetch(`${this.apiBase}/notifications?page=${page}&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            const items = data.notifications || data || [];
            const total = data.total || 0;

            // Initialize pagination state if not exists
            if (!this.pagination.notifications) {
                this.pagination.notifications = { page: 1, total: 0, limit };
            }
            this.pagination.notifications.page = page;
            this.pagination.notifications.total = total;
            this.pagination.notifications.limit = limit;

            this.renderNotifications(items);
            this.renderPagination('notifications-pagination', this.pagination.notifications, (p) => this.loadNotifications(p));
            this._updateNotifHeaderDropdown(items);

            const unread = items.filter(n => !n.is_read).length;
            const badge = document.getElementById('notif-badge');
            const count = document.getElementById('notif-count');
            const sidebarBadge = document.getElementById('notif-sidebar-badge');
            const dropdownNotifBadge = document.getElementById('dropdown-notif-badge');
            if (badge) {
                badge.textContent = unread > 99 ? '99+' : String(unread);
                badge.style.display = unread ? '' : 'none';
            }
            if (count) count.textContent = unread > 99 ? '99+' : String(unread);
            if (sidebarBadge) {
                sidebarBadge.textContent = unread > 99 ? '99+' : String(unread);
                sidebarBadge.style.display = unread ? '' : 'none';
            }
            if (dropdownNotifBadge) {
                dropdownNotifBadge.textContent = unread > 99 ? '99+' : String(unread);
                dropdownNotifBadge.style.display = unread ? 'inline-block' : 'none';
            }

            // Play notification sound if unread count increased
            if (this.previousUnreadCount !== undefined && unread > this.previousUnreadCount) {
                this.playNotificationSound();
            }
            this.previousUnreadCount = unread;
        } catch (err) {
            const list = document.getElementById('notifications-list');
            if (list) list.innerHTML = `<div class="text-center py-4 text-muted small">Failed to load notifications.</div>`;
            this._updateNotifHeaderDropdown([], true);
        }
    }

    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (err) {
            console.log('Audio play failed:', err);
        }
    }

    _updateNotifHeaderDropdown(items, error = null) {
        const dropdownList = document.getElementById('notif-list');
        if (!dropdownList) return;

        if (error) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-danger">Failed to load notifications</li>`;
            return;
        }

        const recent = items.slice(0, 5);
        if (!recent.length) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-muted">No notifications</li>`;
            return;
        }
        const iconMap = { order: 'bi-bag-check text-success', product: 'bi-box-seam text-primary', user: 'bi-person text-info', system: 'bi-gear text-secondary' };
        dropdownList.innerHTML = recent.map(n => {
            const ic = iconMap[n.type] || 'bi-bell text-muted';
            const relTime = this._relativeTime(new Date(n.created_at));
            const readStatus = n.is_read ? 'read' : 'unread';
            return `<li>
                <a class="dropdown-item notification-item-dropdown ${readStatus} py-2 notif-header-link" href="#" tabindex="0" style="border:none;padding:0.75rem 1rem;margin:0.25rem 0.5rem;border-radius:8px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="notification-icon-dropdown" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${n.is_read ? '#f3f4f6' : '#ecfdf5'};color:${n.is_read ? '#6b7280' : '#10b981'};font-size:0.875rem;">
                            <i class="bi ${ic}"></i>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div class="small" style="font-weight:${n.is_read ? '500' : '600'};color:${n.is_read ? '#111827' : '#065f46'};line-height:1.4;">${this.escapeHtml(n.title || 'Notification')}</div>
                            <div style="font-size:0.75rem;color:#9ca3af;">${relTime}</div>
                        </div>
                        ${!n.is_read ? '<div style="width:6px;height:6px;border-radius:50%;background:#10b981;flex-shrink:0;"></div>' : ''}
                    </div>
                </a>
            </li>`;
        }).join('');

        // Add click and keyboard handlers to navigate to notifications section and highlight selected notification
        dropdownList.querySelectorAll('.notif-header-link').forEach((link, index) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const notifId = recent[index]?.id;
                this.showSection('notifications');
                if (notifId) {
                    this.highlightNotification(notifId);
                }
            });
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const notifId = recent[index]?.id;
                    this.showSection('notifications');
                    if (notifId) {
                        this.highlightNotification(notifId);
                    }
                }
            });
        });
    }

    highlightNotification(notifId) {
        // Remove any existing highlight
        document.querySelectorAll('.notification-item.highlighted').forEach(item => {
            item.classList.remove('highlighted');
            item.style.background = '';
            item.style.borderColor = '';
        });

        // Store highlighted notification ID before navigation
        this.highlightedNotifId = notifId;
    }

    clearNotificationHighlight() {
        if (this.highlightedNotifId) {
            const item = document.querySelector(`.notification-item[data-id="${this.highlightedNotifId}"]`);
            if (item) {
                item.classList.remove('highlighted');
                item.style.background = '';
                item.style.borderColor = '';
            }
            this.highlightedNotifId = null;
        }
    }

    async loadMessages() {
        try {
            // Load conversations for dropdown (no loading spinner for polling)
            const res = await fetch(`${this.apiBase}/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const conversations = data.conversations || [];
                this._updateChatHeaderDropdown(conversations);
                
                // Calculate unread counts
                const usersWithUnread = conversations.filter(conv => conv.unread_count > 0).length;
                const totalUnreadMessages = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                
                // Update badges
                const topbarBadge = document.getElementById('chat-topbar-badge');
                const sidebarBadge = document.getElementById('chat-unread-badge');
                const unreadCountEl = document.getElementById('chat-unread-count');
                
                // Top header badge: number of users with unread messages
                if (topbarBadge) {
                    topbarBadge.textContent = usersWithUnread > 99 ? '99+' : String(usersWithUnread);
                    topbarBadge.style.display = usersWithUnread > 0 ? 'inline-block' : 'none';
                }
                if (sidebarBadge) {
                    sidebarBadge.textContent = usersWithUnread > 99 ? '99+' : String(usersWithUnread);
                    sidebarBadge.style.display = usersWithUnread > 0 ? 'inline-flex' : 'none';
                }
                // Dropdown header: total unread messages across all users
                if (unreadCountEl) {
                    unreadCountEl.textContent = totalUnreadMessages;
                }
            }
        } catch (err) {
            console.error('Error loading messages:', err);
            this._updateChatHeaderDropdown([], true);
        }
    }

    _updateChatHeaderDropdown(conversations, error = null) {
        const dropdownList = document.getElementById('chat-dropdown-list');
        if (!dropdownList) return;

        if (error) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-danger">Failed to load messages</li>`;
            return;
        }

        const recent = conversations.slice(0, 5);
        if (!recent.length) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-muted">No messages</li>`;
            return;
        }

        dropdownList.innerHTML = recent.map(conv => {
            const customerName = conv.other_shop_name || conv.other_full_name || conv.other_username || 'Customer';
            const lastMessage = conv.last_message || 'No messages yet';
            const lastMessageTime = conv.last_message_at ? this._relativeTime(new Date(conv.last_message_at)) : '';
            const unreadCount = conv.unread_count || 0;
            const isUnread = unreadCount > 0;

            return `<li>
                <a class="dropdown-item py-2 chat-dropdown-item ${isUnread ? 'chat-dropdown-item-unread' : ''}" href="#" data-conversation-id="${this.escapeAttr(conv.conversation_id)}" tabindex="0" style="border:none;padding:0.75rem 1rem;margin:0.25rem 0.5rem;border-radius:8px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="notification-icon-dropdown ${isUnread ? 'notification-icon-unread' : ''}" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.875rem;">
                            <i class="bi bi-person"></i>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div class="small" style="font-weight:${isUnread ? '600' : '500'};color:${isUnread ? '#065f46' : '#111827'};line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(customerName)}</div>
                            <div style="font-size:0.75rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(lastMessage)}</div>
                            <div style="font-size:0.7rem;color:#9ca3af;">${lastMessageTime}</div>
                        </div>
                        ${isUnread ? `<span class="badge bg-danger" style="font-size:0.65rem;padding:2px 6px;border-radius:10px;">${unreadCount}</span>` : ''}
                    </div>
                </a>
            </li>`;
        }).join('');

        // Add click and keyboard handlers for conversation items
        dropdownList.querySelectorAll('.chat-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const conversationId = item.dataset.conversationId;
                this.openConversation(conversationId);
            });
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const conversationId = item.dataset.conversationId;
                    this.openConversation(conversationId);
                }
            });
        });
    }

    async openConversation(conversationId) {
        try {
            // Mark conversation as read
            await fetch(`${this.apiBase}/messages/conversation/${conversationId}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            // Navigate to chat section
            this.showSection('chat');
            
            // Reload messages to update badges
            this.loadMessages();
            
            // If chat instance exists, select the conversation
            if (window.chatUI && typeof window.chatUI.openConversation === 'function') {
                window.chatUI.openConversation(conversationId);
            }
        } catch (err) {
            console.error('Error opening conversation:', err);
        }
    }

    startChatPolling() {
        if (this.chatPollInterval) {
            clearInterval(this.chatPollInterval);
        }
        this.chatPollFailures = 0;
        this.chatPollInterval = setInterval(() => {
            this.loadMessages().catch(err => {
                this.chatPollFailures++;
                console.error('Chat poll error:', err);
                if (this.chatPollFailures >= 5) {
                    this.stopChatPolling();
                    this.showMessage('Unable to load messages. Please refresh the page.', 'warning');
                }
            });
        }, 10000); // Poll every 10 seconds
    }

    stopChatPolling() {
        if (this.chatPollInterval) {
            clearInterval(this.chatPollInterval);
            this.chatPollInterval = null;
        }
        this.chatPollFailures = 0;
    }

    startNotifPolling() {
        if (this.notifPollInterval) {
            clearInterval(this.notifPollInterval);
        }
        this.notifPollFailures = 0;
        this.notifPollInterval = setInterval(() => {
            this.loadNotifications(1).catch(err => {
                this.notifPollFailures++;
                console.error('Notification poll error:', err);
                if (this.notifPollFailures >= 5) {
                    this.stopNotifPolling();
                    this.showMessage('Unable to load notifications. Please refresh the page.', 'warning');
                }
            });
        }, 10000); // Poll every 10 seconds (less frequent than chat)
    }

    stopNotifPolling() {
        if (this.notifPollInterval) {
            clearInterval(this.notifPollInterval);
            this.notifPollInterval = null;
        }
        this.notifPollFailures = 0;
    }

    updateHeaderUser() {
        const shopName = this.authProfile?.shop_name || this.authProfile?.full_name || this.authProfile?.username || 'Farmer';
        const formattedShopName = shopName.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        const userEmail = this.authProfile?.email || '';
        const userRole = this.authProfile?.role || 'farmer';

        document.getElementById('user-name').textContent = formattedShopName;
        document.getElementById('user-name-dd').textContent = formattedShopName;
        document.getElementById('user-email').textContent = userEmail;

        const roleBadge = document.getElementById('header-role-badge');
        if (roleBadge) {
            roleBadge.textContent = userRole.toUpperCase();
            roleBadge.style.display = 'inline-block';
        }

        // Show verified icon if farmer is verified
        const verifiedIcon = document.getElementById('header-verified-icon');
        if (verifiedIcon) {
            const isVerified = this.currentVerificationRequest?.status === 'approved';
            verifiedIcon.style.display = isVerified ? 'inline-block' : 'none';
            // Initialize Bootstrap tooltip
            if (isVerified && typeof bootstrap !== 'undefined') {
                new bootstrap.Tooltip(verifiedIcon);
            }
        }

        // Set profile initial from shop name
        const initial = formattedShopName.charAt(0).toUpperCase();
        const profileInitial = document.getElementById('header-profile-initial');
        if (profileInitial) {
            profileInitial.textContent = initial;
        }
    }

    async loadInitialSectionData() {
        try {
            const savedSection = localStorage.getItem('farmerActiveSection') || 'overview';
            const validSections = new Set(['overview', 'products', 'orders', 'chat', 'shop', 'reviews', 'profile', 'notifications', 'subscription', 'support-tickets', 'support-ticket-chat']);
            const safeSection = validSections.has(savedSection) ? savedSection : 'overview';

            // Load data based on initial section
            if (safeSection === 'overview') {
                await this.loadOverviewMetrics();
            } else if (safeSection === 'products') {
                await this.loadMyProducts();
            } else if (safeSection === 'orders') {
                await this.loadOrdersByStatus('pending');
            } else if (safeSection === 'support-tickets') {
                await this.loadSupportTickets();
            } else if (safeSection === 'notifications') {
                await this.loadNotifications(1);
            } else if (safeSection === 'profile') {
                await this.loadProfile();
            } else if (safeSection === 'reviews') {
                await this.loadReviews(1);
            } else if (safeSection === 'shop') {
                await this.loadShopProfile();
            } else if (safeSection === 'subscription') {
                await this.loadSubscription();
            }
        } catch (error) {
            console.error('Error loading initial section data:', error);
        } finally {
            // Always hide loading screen, even if there's an error
            const loadingScreen = document.getElementById('admin-loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        }
    }

    _relativeTime(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    renderNotifications(items) {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        if (!items.length) {
            list.innerHTML = `<div class="text-center py-5 text-muted">
                <i class="bi bi-bell-slash fs-2 d-block mb-2"></i>
                No notifications yet.
            </div>`;
            return;
        }
        const iconMap = {
            order: 'bi-bag-check text-success',
            product: 'bi-box-seam text-primary',
            product_approved: 'bi-check-circle text-success',
            product_rejected: 'bi-x-circle text-danger',
            product_deleted: 'bi-trash text-danger',
            products_disabled: 'bi-toggle-off text-warning',
            products_enabled: 'bi-toggle-on text-success',
            account_disabled: 'bi-person-x text-danger',
            account_enabled: 'bi-person-check text-success',
            account_verified: 'bi-shield-check text-success',
            account_unverified: 'bi-shield-x text-warning',
            role_changed: 'bi-person-gear text-info',
            new_review: 'bi-star-fill text-warning',
            review_updated: 'bi-star-half text-warning',
            order_cancelled_by_customer: 'bi-x-circle-fill text-danger',
            low_stock_alert: 'bi-exclamation-triangle-fill text-warning',
            product_back_in_stock: 'bi-arrow-up-circle-fill text-success',
            price_changed: 'bi-currency-peso text-info',
            new_product_submitted: 'bi-plus-circle text-primary',
            order_status: 'bi-truck text-info',
            order_placed: 'bi-bag-plus text-success',
            order_update: 'bi-arrow-repeat text-primary',
            product_removed: 'bi-bag-x-fill text-danger',
            announcement: 'bi-megaphone-fill text-primary',
            user: 'bi-person text-info',
            system: 'bi-gear text-secondary',
            payment: 'bi-credit-card text-warning',
        };
        list.innerHTML = items.map(n => {
            const iconClass  = iconMap[n.type] || 'bi-bell text-muted';
            const readStatus = n.is_read ? 'read' : 'unread';
            const relTime    = this._relativeTime(new Date(n.created_at));
            const cursorCls  = n.is_read ? '' : 'cursor-pointer';
            return `
            <div class="notification-item ${readStatus} ${cursorCls}" data-id="${n.id}">
                <div class="notification-icon">
                    <i class="bi ${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${this.escapeHtml(n.title || 'Notification')}</div>
                    <div class="notification-message">${this.escapeHtml(n.message || '')}</div>
                    <div class="notification-meta">
                        <span>${relTime}</span>
                    </div>
                </div>
                ${!n.is_read ? `<div class="notification-actions">
                    <button class="notification-mark-read-btn" data-id="${n.id}" title="Mark read">
                        <i class="bi bi-check2"></i>
                    </button>
                </div>` : ''}
            </div>`;
        }).join('');

        // Add click handlers for mark read buttons
        list.querySelectorAll('.notification-mark-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.id);
                this.markNotifRead(id, btn);
            });
        });

        // Add click handlers for notification items
        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = Number(item.dataset.id);
                const notif = items.find(n => n.id === id);
                if (notif && !notif.is_read) {
                    const btn = item.querySelector('.notification-mark-read-btn');
                    if (btn) this.markNotifRead(id, btn);
                }
            });
        });
    }

    async markNotifRead(id, btn, skipReload = false) {
        try {
            const response = await fetch(`${this.apiBase}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                if (btn) {
                    const actionsDiv = btn.closest('.notification-actions');
                    if (actionsDiv) actionsDiv.remove();
                }
                const item = document.querySelector(`.notification-item[data-id="${id}"]`);
                if (item && !skipReload) {
                    item.classList.remove('unread', 'cursor-pointer');
                    item.classList.add('read');
                }
                if (!skipReload) {
                    this.loadNotifications();
                }
            }
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    }

    async markAllNotifsRead() {
        const btn = document.getElementById('notif-mark-all-btn');
        if (btn) btn.disabled = true;
        try {
            const response = await fetch(`${this.apiBase}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                this.showMessage('Failed to mark all as read', 'error');
                return;
            }
            this.loadNotifications();
        } catch (err) {
            this.showMessage('Failed to mark all as read', 'error');
        } finally {
            if (btn) btn.disabled = false;
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
                const name = String((profile.shop_name || '')).trim();
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
                const v = profile.shop_name || '';
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
            if (firstName.length > 40) {
                this.showMessage('First name must be 40 characters or less.', 'error'); return;
            }
            if (middleName.length > 40) {
                this.showMessage('Middle name must be 40 characters or less.', 'error'); return;
            }
            if (lastName.length > 40) {
                this.showMessage('Last name must be 40 characters or less.', 'error'); return;
            }
            payload.first_name = firstName;
            payload.middle_name = middleName || null;
            payload.last_name = lastName;
        }

        if (shopNameInput && shopNameInput.value.trim()) {
            const shopName = shopNameInput.value.trim();
            if (shopName.length > 40) {
                this.showMessage('Shop name must be 40 characters or less.', 'error'); return;
            }
            payload.shop_name = shopName;
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
                await this.loadProfile();
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
                
                // Initialize KPI cards and filter visibility (show Available Now by default)
                document.getElementById('kpi-available').style.display = 'flex';
                document.getElementById('kpi-preorder').style.display = 'none';
                document.getElementById('kpi-approval').style.display = 'none';
                document.getElementById('filter-available').style.display = 'flex';
                document.getElementById('filter-preorder').style.display = 'none';
                document.getElementById('filter-approval').style.display = 'none';
                
                // Split products by is_preorder flag
                const availableProducts = this.myProductsCache.filter(p => !p.is_preorder);
                const preorderProducts = this.myProductsCache.filter(p => p.is_preorder);
                
                // Render to correct tables
                this.renderAvailableProducts(availableProducts);
                this.renderPreorderProducts(preorderProducts);
                
                // Update KPI cards
                this.updateProductKPIs(this.myProductsCache);
                
                // Show product limit warning for unverified farmers
                try {
                    const userRes = await fetch(`${this.apiBase}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    });
                    if (userRes.ok) {
                        const userData = await userRes.json();
                        if (userData.user && userData.user.is_verified === false) {
                            const productCount = this.myProductsCache.length;
                            const limitWarningEl = document.getElementById('product-limit-warning');
                            if (limitWarningEl) {
                                if (productCount >= 8) {
                                    limitWarningEl.style.display = '';
                                    limitWarningEl.className = 'alert alert-warning';
                                    limitWarningEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> You have ${productCount}/10 products. Unverified farmers can only have up to 10 products. <a href="#" onclick="window.scrollTo(0,0);return false;">Contact support</a> to verify your account for unlimited products.`;
                                } else {
                                    limitWarningEl.style.display = 'none';
                                }
                            }
                        }
                    }
                } catch (_) { /* ignore user check error */ }
                
                // Reset filters to default
                const availableStatusFilter = document.getElementById('available-status-filter');
                const availableCategoryFilter = document.getElementById('available-category-filter');
                const availableSearchInput = document.getElementById('available-search-input');
                const preorderStatusFilter = document.getElementById('preorder-status-filter');
                const preorderCategoryFilter = document.getElementById('preorder-category-filter');
                const preorderSearchInput = document.getElementById('preorder-search-input');
                
                if (availableStatusFilter) availableStatusFilter.value = '';
                if (availableCategoryFilter) availableCategoryFilter.value = '';
                if (availableSearchInput) availableSearchInput.value = '';
                if (preorderStatusFilter) preorderStatusFilter.value = '';
                if (preorderCategoryFilter) preorderCategoryFilter.value = '';
                if (preorderSearchInput) preorderSearchInput.value = '';
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

            // Check if user has premium subscription for advanced analytics access
            const hasPremium = this.subscriptionData && this.subscriptionData.status === 'active';

            // Show analytics access warning for non-premium farmers
            const analyticsWarningEl = document.getElementById('analytics-access-warning');
            if (analyticsWarningEl) {
                if (!hasPremium) {
                    analyticsWarningEl.style.display = '';
                    analyticsWarningEl.className = 'alert alert-info';
                    analyticsWarningEl.innerHTML = '<i class="fas fa-info-circle"></i> Advanced analytics (charts, trends, insights) are available for premium users only. <a href="#" onclick="window.scrollTo(0,0);return false;">Upgrade to premium</a> to unlock all features.';
                } else {
                    analyticsWarningEl.style.display = 'none';
                }
            }

            // If non-premium, show only basic metrics and skip advanced charts
            // But still fetch metrics for KPI cards
            const isNonPremium = !hasPremium;

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
                    if (res.status === 403) {
                        // Premium feature requested by free tier user - show message and fall back to default period
                        this.showToast('All-time analytics is a Premium feature. Showing last 30 days instead.', 'warning');
                        this._syncAllPeriods('30');
                        this._savePeriods();
                        // Retry with default period
                        this.loadOverviewMetrics({ force: true });
                        return null;
                    }
                    const json = await res.json().catch(() => null);
                    if (!res.ok) throw new Error(json?.message || 'Failed to load metrics');
                    return json;
                })
                .then((metrics) => {
                    if (!metrics) return;
                    this.overviewMetrics = metrics;
                    // Use basic metrics view for non-premium users
                    if (isNonPremium) {
                        this.renderBasicMetricsOnly();
                    } else {
                        this.renderOverview(metrics);
                    }
                })
                .catch((err) => {
                    const el = document.getElementById('overview-last-updated');
                    if (el) el.textContent = 'Could not load report.';
                    const msg = err?.message || '';
                    if (msg.includes('403') || msg.includes('Premium')) {
                        return;
                    }
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
        // Hide/show metrics sections based on verification status
        const isVerified = this.isVerified();
        const isPremium = this.isPremium();

        const metricsCards = ['my-products-card', 'total-orders-card', 'items-sold-card', 'total-revenue-card', 'recent-orders-card', 'top-products-card'];
        metricsCards.forEach(cardId => {
            const card = document.getElementById(cardId);
            if (card) {
                card.style.display = 'block';
            }
        });

        // Show period filter dropdowns for all users (marketing strategy - let them see what they're missing)
        const filterDropdowns = document.querySelectorAll('.filter');
        filterDropdowns.forEach(filter => {
            filter.style.display = 'block';
        });

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

        // Load recent orders and top products with their saved independent periods
        // This ensures the tables show data for the correct timeframe after refresh
        this.loadRecentOrders(this._recentOrdersPeriod);
        this.loadTopProducts(this._topProductsPeriod);
    }

    renderBasicMetricsOnly() {
        // Show only basic metrics for non-premium farmers (no charts, no advanced insights)
        const lastUpdatedEl = document.getElementById('overview-last-updated');
        if (lastUpdatedEl) {
            const ts = new Date();
            lastUpdatedEl.textContent = `Basic View • Updated: ${ts.toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        }

        // Hide advanced charts - available for premium users only
        const statusWrap = document.getElementById('statusChart');
        if (statusWrap) {
            statusWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#9ca3af;font-size:14px;">Advanced charts available for premium users only</div>';
        }

        const reportsWrap = document.getElementById('reportsChart');
        if (reportsWrap) {
            reportsWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#9ca3af;font-size:14px;">Advanced reports available for premium users only</div>';
        }

        // Load basic KPI cards only
        this.loadKpiCard('kpi-products', this._kpiPeriods['kpi-products'] || 'all', this.overviewMetrics);
        this.loadKpiCard('kpi-orders', this._kpiPeriods['kpi-orders'] || 'month', this.overviewMetrics);
        this.loadKpiCard('kpi-sold', this._kpiPeriods['kpi-sold'] || 'month', this.overviewMetrics);
        this.loadKpiCard('kpi-revenue', this._kpiPeriods['kpi-revenue'] || 'month', this.overviewMetrics);

        // Show basic recent orders and top products (still available for non-premium)
        this.loadRecentOrders(this._recentOrdersPeriod);
        this.loadTopProducts(this._topProductsPeriod);
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

    clearKpiValues() {
        // Clear KPI values to N/A immediately to prevent visual flash for unverified farmers
        const totalOrdersEl = document.getElementById('total-orders');
        const totalOrdersChangeEl = document.getElementById('total-orders-change');
        const totalOrdersChangeLabelEl = document.getElementById('total-orders-change-label');
        
        const itemsSoldEl = document.getElementById('total-sold');
        const itemsSoldChangeEl = document.getElementById('items-sold-change');
        const itemsSoldChangeLabelEl = document.getElementById('items-sold-change-label');
        
        const totalRevenueEl = document.getElementById('total-revenue');
        const totalRevenueChangeEl = document.getElementById('total-revenue-change');
        const totalRevenueChangeLabelEl = document.getElementById('total-revenue-change-label');

        if (totalOrdersEl) totalOrdersEl.textContent = 'N/A';
        if (totalOrdersChangeEl) totalOrdersChangeEl.textContent = '';
        if (totalOrdersChangeLabelEl) {
            totalOrdersChangeLabelEl.textContent = 'Verify your account to view metrics';
            totalOrdersChangeLabelEl.style.whiteSpace = 'nowrap';
        }

        if (itemsSoldEl) itemsSoldEl.textContent = 'N/A';
        if (itemsSoldChangeEl) itemsSoldChangeEl.textContent = '';
        if (itemsSoldChangeLabelEl) {
            itemsSoldChangeLabelEl.textContent = 'Verify your account to view metrics';
            itemsSoldChangeLabelEl.style.whiteSpace = 'nowrap';
        }

        if (totalRevenueEl) totalRevenueEl.textContent = 'N/A';
        if (totalRevenueChangeEl) totalRevenueChangeEl.textContent = '';
        if (totalRevenueChangeLabelEl) {
            totalRevenueChangeLabelEl.textContent = 'Verify your account to view metrics';
            totalRevenueChangeLabelEl.style.whiteSpace = 'nowrap';
        }
    }

    loadKpiCard(card, period, metrics) {
        if (!metrics) return;
        const periodLabel = this._periodLabel(period);
        const periodEl = document.getElementById(`${card}-period`);
        if (periodEl) periodEl.textContent = `| ${periodLabel}`;

        const valEl = document.getElementById('my-products');
        if (card === 'kpi-products' && valEl) {
            // Product count is static (current total listings) - available for all users
            if (this.myProductsCache) {
                const availableProducts = this.myProductsCache.filter(p => {
                    const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
                    const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
                    return isAvailable && p.status === 'approved' && !isAdminDisabled;
                });
                valEl.textContent = this.fmtNumber(availableProducts.length);
            }
            return;
        }

        // Check if farmer is verified (verified users can see metrics)
        const isVerified = this.isVerified();

        // Calculate status counts once for use across multiple KPI cards
        const statusCounts = this.getOverviewStatusCounts(metrics);

        // For orders, sold, revenue — derive from the metrics data.
        // Since /farmers/me/metrics returns data for a single period,
        // all KPIs share the same data. If period differs from _reportPeriod,
        // metrics reflect _reportPeriod; ideally we'd refetch per card.
        if (card === 'kpi-orders') {
            const el = document.getElementById('total-orders');
            const changeEl = document.getElementById('total-orders-change');
            const changeLabelEl = document.getElementById('total-orders-change-label');
            if (!isVerified) {
                if (el) el.textContent = 'N/A';
                if (changeEl) changeEl.textContent = '';
                if (changeLabelEl) {
                    changeLabelEl.textContent = 'Verify your account to view metrics';
                    changeLabelEl.style.whiteSpace = 'nowrap';
                }
                return;
            }
            const totalOrders = Object.values(statusCounts).reduce((sum, v) => sum + Number(v || 0), 0);
            if (el) el.textContent = this.fmtNumber(totalOrders);
            this.updateKpiChange('total-orders-change', 'total-orders-change-label', metrics?.ordersChange, period);
        }
        if (card === 'kpi-sold') {
            const el = document.getElementById('total-sold');
            const changeEl = document.getElementById('items-sold-change');
            const changeLabelEl = document.getElementById('items-sold-change-label');
            if (!isVerified) {
                if (el) el.textContent = 'N/A';
                if (changeEl) changeEl.textContent = '';
                if (changeLabelEl) {
                    changeLabelEl.textContent = 'Verify your account to view metrics';
                    changeLabelEl.style.whiteSpace = 'nowrap';
                }
                return;
            }
            if (el) el.textContent = this.fmtNumber(statusCounts.delivered || 0);
            this.updateKpiChange('items-sold-change', 'items-sold-change-label', metrics?.soldChange, period);
        }
        if (card === 'kpi-revenue') {
            const el = document.getElementById('total-revenue');
            const changeEl = document.getElementById('total-revenue-change');
            const changeLabelEl = document.getElementById('total-revenue-change-label');
            if (!isVerified) {
                if (el) el.textContent = 'N/A';
                if (changeEl) changeEl.textContent = '';
                if (changeLabelEl) {
                    changeLabelEl.textContent = 'Verify your account to view metrics';
                    changeLabelEl.style.whiteSpace = 'nowrap';
                }
                return;
            }
            const totalRevenue = (Array.isArray(metrics?.revenueByDay)
                ? metrics.revenueByDay.reduce((sum, row) => sum + Number(row?.revenue || 0), 0)
                : 0);
            if (el) el.textContent = this.fmtCurrency(totalRevenue);
            this.updateKpiChange('total-revenue-change', 'total-revenue-change-label', metrics?.revenueChange, period);
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
                <td class="small">
                    <div>${this.escapeHtml(p.product_name || '—')}</div>
                    <div class="text-muted" style="font-size:0.7rem">#${p.id}</div>
                </td>
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

        // Disable simple-datatables for top-products table (small overview table, no sorting needed)
        // This prevents column misalignment issues after column count changes
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
            const reportsChartEl = document.getElementById('reportsChart');
            if (!reportsChartEl) return;

            // Show premium upgrade message for non-premium users
            if (!this.isPremium()) {
                reportsChartEl.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:350px;color:#6b7280;font-size:14px;text-align:center;padding:20px;">
                        <i class="fas fa-lock" style="font-size:32px;margin-bottom:12px;color:#9ca3af;"></i>
                        <div style="font-weight:600;margin-bottom:8px;">Advanced Analytics</div>
                        <div style="font-size:13px;">Upgrade to Premium to access detailed revenue trends and performance insights.</div>
                        <button onclick="window.farmerDashboard.openSubscriptionModal('upgrade')" style="margin-top:12px;padding:8px 16px;background:#4154f1;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Upgrade to Premium</button>
                    </div>
                `;
                return;
            }

            const res = await fetch(`${this.apiBase}/farmers/me/report?period=${period}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) {
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
            }
        } catch (err) {
            console.warn('Farmer reports chart error:', err);
        }
    }

    renderOverviewCharts(metrics, statusCounts = null) {
        // Orders by status pie chart — Chart.js (NiceAdmin style)
        const statusWrap = document.getElementById('statusChart');
        if (!statusWrap) return;

        // Show premium upgrade message for non-premium users
        if (!this.isPremium()) {
            statusWrap.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:320px;color:#6b7280;font-size:14px;text-align:center;padding:20px;">
                    <i class="fas fa-lock" style="font-size:32px;margin-bottom:12px;color:#9ca3af;"></i>
                    <div style="font-weight:600;margin-bottom:8px;">Advanced Analytics</div>
                    <div style="font-size:13px;">Upgrade to Premium to access detailed order status breakdowns and insights.</div>
                    <button onclick="window.farmerDashboard.openSubscriptionModal('upgrade')" style="margin-top:12px;padding:8px 16px;background:#4154f1;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Upgrade to Premium</button>
                </div>
            `;
            return;
        }

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

    async loadRecentOrders(period) {
        try {
            const response = await fetch(`${this.apiBase}/farmers/me/metrics?range=${period}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.renderRecentOrdersTable(data.recentOrders || []);
            } else if (response.status === 403) {
                // Premium feature requested by free tier user - show message and fall back to default period
                this.showToast('All-time analytics is a Premium feature. Showing last 30 days instead.', 'warning');
                this._recentOrdersPeriod = '30';
                const lbl = document.getElementById('recent-orders-period-label');
                if (lbl) lbl.textContent = `| ${this._periodLabel('30')}`;
                this._savePeriods();
                // Retry with default period
                this.loadRecentOrders('30');
            } else {
                const tbody = document.getElementById('recent-orders-tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3 small">Failed to load recent orders</td></tr>';
            }
        } catch (error) {
            console.error('Error loading recent orders:', error);
            const tbody = document.getElementById('recent-orders-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3 small">Failed to load recent orders</td></tr>';
        }
    }

    async loadTopProducts(period) {
        try {
            const response = await fetch(`${this.apiBase}/farmers/me/metrics?range=${period}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.renderTopProductsTable(data.topProducts || []);
            } else if (response.status === 403) {
                // Premium feature requested by free tier user - show message and fall back to default period
                this.showToast('All-time analytics is a Premium feature. Showing last 30 days instead.', 'warning');
                this._topProductsPeriod = '30';
                const lbl = document.getElementById('top-products-period-label');
                if (lbl) lbl.textContent = `| ${this._periodLabel('30')}`;
                this._savePeriods();
                // Retry with default period
                this.loadTopProducts('30');
            } else {
                const tbody = document.getElementById('top-products-tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3 small">Failed to load top products</td></tr>';
            }
        } catch (error) {
            console.error('Error loading top products:', error);
            const tbody = document.getElementById('top-products-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3 small">Failed to load top products</td></tr>';
        }
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
            const customerVerified = o.customer_is_verified === true;
            const productImage = o.product_image || '/images/placeholder-product.jpg';
            const price = this.fmtCurrency(o.price || 0);
            const sold = o.quantity || 1;
            const revenue = this.fmtCurrency((o.price || 0) * sold);
            return `
            <tr>
                <td class="text-center"><img src="${this.escapeHtml(productImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td class="small">${this.escapeHtml(customerName)}${customerVerified ? ' <i class="bi bi-check-circle-fill text-success" style="font-size:0.75rem;margin-left:4px;" title="Verified Customer"></i>' : ''}</td>
                <td class="small">
                    <div>${this.escapeHtml(o.product_name || '—')}</div>
                    <div class="text-muted" style="font-size:0.7rem">#${o.id}</div>
                </td>
                <td class="small text-center">${price}</td>
                <td class="small text-center">${sold}</td>
                <td class="small text-center">${revenue}</td>
                <td class="text-center"><span class="badge bg-${this.getStatusBadgeColor(o.status)}">${statusLabel}</span></td>
            </tr>
            `;
        }).join('');

        this.renderPagination('recent-orders-pagination', pg, (page) => {
            pg.page = page;
            this.renderRecentOrdersTable(this.overviewRecentOrdersCache);
        });

        // Disable simple-datatables for recent-orders table (small overview table, no sorting needed)
        // This prevents column misalignment issues after column count changes
    }

    renderOverviewLowStock() {
        const wrap = document.getElementById('overview-low-stock');
        if (!wrap) return;

        const threshold = this.lowStockThreshold;
        const products = Array.isArray(this.myProductsCache) ? this.myProductsCache : [];
        const low = products
            .filter(p => {
                const stock = Number(p.stock_quantity ?? 0);
                const status = String(p.status || 'approved').toLowerCase();
                return status === 'approved' && stock > 0 && stock <= threshold;
            })
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

    // DEPRECATED: renderMyProducts is no longer used - replaced by renderAvailableProducts and renderPreorderProducts
    // Kept for backward compatibility in case of legacy references
    renderMyProducts(products) {
        console.warn('renderMyProducts is deprecated - use renderAvailableProducts or renderPreorderProducts instead');
        this.destroySortableTable('products-table');
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        // Update KPI cards
        this.updateProductKPIs(products);

        if (!products.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No products found</td></tr>`;
            this.refreshSortableTable('products-table', { columns: [{ select: 0, sortable: false }, { select: 8, sortable: false }] });
            // Clear pagination
            const paginationContainer = document.getElementById('products-pagination');
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('farmerTableSort_products-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                products.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 1: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 2: // name
                            valA = (a.name || '').toLowerCase();
                            valB = (b.name || '').toLowerCase();
                            break;
                        case 3: // category_name
                            valA = (a.category_name || '').toLowerCase();
                            valB = (b.category_name || '').toLowerCase();
                            break;
                        case 4: // price
                            valA = parseFloat(a.price) || 0;
                            valB = parseFloat(b.price) || 0;
                            break;
                        case 5: // stock_quantity
                            valA = a.stock_quantity || 0;
                            valB = b.stock_quantity || 0;
                            break;
                        case 6: // status
                            const statusA = a.status || 'approved';
                            const statusB = b.status || 'approved';
                            valA = statusA;
                            valB = statusB;
                            break;
                        case 7: // reviews
                            valA = a.total_reviews || 0;
                            valB = b.total_reviews || 0;
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        } else {
            // Default sort if no saved sort: Available first (lowest stock on top), then No Stock, Disabled, Pending, Rejected
            products.sort((a, b) => {
                const getPriority = (p) => {
                    const s = p.status || 'approved';
                    const avail = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
                    const adminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
                    const stock = Number(p.stock_quantity ?? 0);
                    if (s === 'pending') return 4;
                    if (s === 'rejected') return 5;
                    if (!avail || adminDisabled) return 3;
                    if (stock <= 0) return 2;
                    return 1; // Available
                };
                const priorityA = getPriority(a);
                const priorityB = getPriority(b);
                if (priorityA !== priorityB) return priorityA - priorityB;
                // Within Available group, sort by stock ascending (lowest first)
                if (priorityA === 1) {
                    return Number(a.stock_quantity ?? 0) - Number(b.stock_quantity ?? 0);
                }
                return 0;
            });
        }

        // Apply pagination
        const pg = this.pagination['products'];
        const total = products.length;
        pg.total = total;
        const offset = (pg.page - 1) * pg.limit;
        const paginatedProducts = products.slice(offset, offset + pg.limit);

        tbody.innerHTML = paginatedProducts.map(product => {
            const stock = Number(product.stock_quantity ?? 0);
            const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
            const isAdminDisabled = (product.is_admin_disabled === true || product.is_admin_disabled === 't' || product.is_admin_disabled === 'true' || product.is_admin_disabled === 1 || product.is_admin_disabled === '1');
            const approvalStatus = product.status || 'approved';
            let statusLabel, statusKey;
            
            // Show approval status first if pending or rejected
            if (approvalStatus === 'pending') {
                statusLabel = 'Pending';
                statusKey = 'pending';
            } else if (approvalStatus === 'rejected') {
                statusLabel = 'Rejected';
                statusKey = 'rejected';
            } else {
                // Show availability status for approved products
                if (isAdminDisabled) {
                    statusLabel = 'Disabled';
                    statusKey = 'disabled';
                } else if (!isAvailable) {
                    statusLabel = 'Disabled';
                    statusKey = 'disabled';
                } else if (stock <= 0) {
                    statusLabel = 'No Stock';
                    statusKey = 'no_stock';
                } else {
                    statusLabel = 'Available';
                    statusKey = 'available';
                }
            }
            
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

            // Disable edit button for pending/rejected products
            const canEdit = approvalStatus === 'approved' || approvalStatus === 'rejected';
            const editButton = canEdit 
                ? `<button class="btn btn-sm py-0 px-2 btn-ac-green product-edit-btn" data-product-id="${product.id}">${approvalStatus === 'rejected' ? 'Resubmit' : 'Edit'}</button>`
                : `<button class="btn btn-sm py-0 px-2 btn-secondary" disabled title="Cannot edit ${approvalStatus} products">Edit</button>`;

            // Add rejection reason tooltip for rejected products
            const statusWithReason = approvalStatus === 'rejected' && product.rejection_reason
                ? `${this.renderStatus(statusLabel, statusKey)} <small class="text-muted d-block" title="${this.escapeHtml(product.rejection_reason)}">${this.escapeHtml(product.rejection_reason.substring(0, 30))}${product.rejection_reason.length > 30 ? '...' : ''}</small>`
                : this.renderStatus(statusLabel, statusKey);

            // Add click handler for rejected products to show full reason
            const statusClickHandler = approvalStatus === 'rejected' && product.rejection_reason
                ? `onclick="window.farmerApp.showRejectionReason('${this.escapeHtml(product.rejection_reason).replace(/'/g, "\\'")}')" style="cursor:pointer;"`
                : '';

            return `
            <tr>
                <td>${thumb}${placeholder}</td>
                <td class="text-muted">${product.id}</td>
                <td class="fw-semibold">
                    ${this.escapeHtml(product.name)}
                    ${product.is_preorder ? '<span class="badge bg-warning text-dark ms-1">Preorder</span>' : ''}
                </td>
                <td class="text-muted">${this.escapeHtml(categoryName || '—')}</td>
                <td>${this.fmtCurrency(product.price)}</td>
                <td>
                    ${this.fmtNumber(stock)}
                    ${product.is_preorder && product.reserved_quantity ? `<br><small class="text-muted">Reserved: ${this.fmtNumber(product.reserved_quantity)}</small>` : ''}
                </td>
                <td ${statusClickHandler}>${statusWithReason}</td>
                <td class="text-muted">${reviewCount} (${avgRating}★)</td>
                <td>
                    ${editButton}
                </td>
            </tr>
        `;
        }).join('');

        this.refreshProductCategoryFilterOptions(products);
        this.refreshSortableTable('products-table', { columns: [{ select: 0, sortable: false }, { select: 8, sortable: false }] });

        // Render pagination
        this.renderPagination('products-pagination', pg, (page) => {
            this.pagination['products'].page = page;
            // Note: filterProducts is deprecated, pagination no longer functional for this deprecated function
        });
    }

    renderAvailableProducts(products) {
        const tbody = document.getElementById('available-products-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No available products found</td></tr>';
            return;
        }
        
        // Update category filter options
        this.refreshProductCategoryFilterOptions(this.myProductsCache);
        
        products.forEach(product => {
            const statusBadge = this.getAvailableStatusBadge(product);
            const stock = Number(product.stock_quantity ?? 0);
            
            // Normalize image URL
            let productImageUrl = product.image_url || '';
            if (productImageUrl && !productImageUrl.startsWith('http') && !productImageUrl.startsWith('/')) {
                productImageUrl = '/' + productImageUrl;
            }
            if (!productImageUrl || productImageUrl === 'null' || productImageUrl === 'undefined') {
                productImageUrl = '/images/logo.png';
            }

            const thumb = `<img src="${this.escapeHtml(productImageUrl)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" alt="" onerror="this.src='/images/logo.png'">`;

            const reviewCount = Number(product.total_reviews || 0);
            const avgRating = this.fmtNumber(product.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            
            const row = `
                <tr>
                    <td>${thumb}</td>
                    <td>
                        <div class="fw-semibold small">${this.escapeHtml(product.name)}</div>
                    </td>
                    <td class="small">${this.escapeHtml(product.category_name || 'N/A')}</td>
                    <td class="small">₱${this.fmtNumber(product.price)}</td>
                    <td class="small">${this.fmtNumber(stock)}</td>
                    <td>${statusBadge}</td>
                    <td class="small">${reviewCount} <i class="bi bi-star-fill text-warning"></i> ${avgRating}</td>
                    <td class="col-actions">
                        <button class="btn btn-sm btn-outline-primary btn-action-edit" data-product-id="${product.id}">Edit</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    renderPreorderProducts(products) {
        const tbody = document.getElementById('preorder-products-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No pre-order products found</td></tr>';
            return;
        }
        
        // Update category filter options
        this.refreshProductCategoryFilterOptions(this.myProductsCache);
        
        products.forEach(product => {
            const statusBadge = this.getPreorderStatusBadge(product);
            const progressPercent = product.max_preorder_quantity > 0 
                ? (product.reserved_quantity / product.max_preorder_quantity) * 100 
                : 0;
            
            // Normalize image URL
            let productImageUrl = product.image_url || '';
            if (productImageUrl && !productImageUrl.startsWith('http') && !productImageUrl.startsWith('/')) {
                productImageUrl = '/' + productImageUrl;
            }
            if (!productImageUrl || productImageUrl === 'null' || productImageUrl === 'undefined') {
                productImageUrl = '/images/logo.png';
            }

            const thumb = `<img src="${this.escapeHtml(productImageUrl)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" alt="" onerror="this.src='/images/logo.png'">`;

            const row = `
                <tr>
                    <td>${thumb}</td>
                    <td>
                        <div class="fw-semibold small">${this.escapeHtml(product.name)}</div>
                    </td>
                    <td class="small">${this.escapeHtml(product.category_name || 'N/A')}</td>
                    <td class="small">${product.preorder_availability_date ? new Date(product.preorder_availability_date).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <div class="small">Reserved: ${this.fmtNumber(product.reserved_quantity)} / ${this.fmtNumber(product.max_preorder_quantity)}</div>
                        <div class="progress" style="height:4px;margin-top:2px;">
                            <div class="progress-bar bg-purple" style="width:${progressPercent}%"></div>
                        </div>
                    </td>
                    <td>${statusBadge}</td>
                    <td class="col-actions">
                        <button class="btn btn-sm btn-outline-primary btn-action-edit" data-product-id="${product.id}">Edit</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }

    getAvailableStatusBadge(product) {
        const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
        const isAdminDisabled = (product.is_admin_disabled === true || product.is_admin_disabled === 't' || product.is_admin_disabled === 'true' || product.is_admin_disabled === 1 || product.is_admin_disabled === '1');
        const stock = Number(product.stock_quantity ?? 0);
        
        if (!isAvailable || isAdminDisabled) {
            return '<span class="badge bg-secondary">Disabled</span>';
        }
        if (stock <= 0) {
            return '<span class="badge bg-warning text-dark">Out of Stock</span>';
        }
        return '<span class="badge bg-success">Active</span>';
    }

    getPreorderStatusBadge(product) {
        const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
        const isAdminDisabled = (product.is_admin_disabled === true || product.is_admin_disabled === 't' || product.is_admin_disabled === 'true' || product.is_admin_disabled === 1 || product.is_admin_disabled === '1');
        
        if (!isAvailable || isAdminDisabled) {
            return '<span class="badge bg-secondary">Disabled</span>';
        }
        if (product.preorder_availability_date && new Date(product.preorder_availability_date) <= new Date()) {
            return '<span class="badge bg-success">Harvest Ready</span>';
        }
        return '<span class="badge bg-primary">Active</span>';
    }

    updateProductKPIs(products) {
        // Update all tab-specific KPIs
        this.updateAvailableKPIs(products);
        this.updatePreorderKPIs(products);
        this.updateApprovalKPIs(products);
    }

    updateAvailableKPIs(products) {
        const availableProducts = products.filter(p => !p.is_preorder);
        const total = availableProducts.length;
        const active = availableProducts.filter(p => {
            const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
            const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
            const stock = Number(p.stock_quantity ?? 0);
            return isAvailable && !isAdminDisabled && stock > 0;
        }).length;
        const lowStock = availableProducts.filter(p => {
            const stock = Number(p.stock_quantity ?? 0);
            const status = String(p.status || 'approved').toLowerCase().trim();
            const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
            return status === 'approved' && !isAdminDisabled && stock > 0 && stock <= this.lowStockThreshold;
        }).length;
        const outOfStock = availableProducts.filter(p => {
            const stock = Number(p.stock_quantity ?? 0);
            const status = String(p.status || 'approved').toLowerCase().trim();
            const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
            return status === 'approved' && !isAdminDisabled && stock === 0;
        }).length;

        const totalEl = document.getElementById('kpi-available-total');
        const activeEl = document.getElementById('kpi-available-active');
        const lowStockEl = document.getElementById('kpi-available-low-stock');
        const outOfStockEl = document.getElementById('kpi-available-out-of-stock');

        if (totalEl) totalEl.textContent = total;
        if (activeEl) activeEl.textContent = active;
        if (lowStockEl) lowStockEl.textContent = lowStock;
        if (outOfStockEl) outOfStockEl.textContent = outOfStock;
    }

    updatePreorderKPIs(products) {
        const preorderProducts = products.filter(p => p.is_preorder);
        const active = preorderProducts.filter(p => {
            const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
            const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
            return isAvailable && !isAdminDisabled;
        }).length;
        const harvestReady = preorderProducts.filter(p => p.status === 'harvest_ready').length;
        const reservedUnits = preorderProducts.reduce((sum, p) => sum + (Number(p.reserved_quantity) || 0), 0);
        const pendingHarvest = preorderProducts.filter(p => {
            const isAvailable = (p.is_available === true || p.is_available === 't' || p.is_available === 'true' || p.is_available === 1 || p.is_available === '1');
            const isAdminDisabled = (p.is_admin_disabled === true || p.is_admin_disabled === 't' || p.is_admin_disabled === 'true' || p.is_admin_disabled === 1 || p.is_admin_disabled === '1');
            return isAvailable && !isAdminDisabled && p.status !== 'harvest_ready';
        }).length;

        const activeEl = document.getElementById('kpi-preorder-active');
        const harvestReadyEl = document.getElementById('kpi-preorder-harvest-ready');
        const reservedEl = document.getElementById('kpi-preorder-reserved');
        const pendingEl = document.getElementById('kpi-preorder-pending');

        if (activeEl) activeEl.textContent = active;
        if (harvestReadyEl) harvestReadyEl.textContent = harvestReady;
        if (reservedEl) reservedEl.textContent = reservedUnits;
        if (pendingEl) pendingEl.textContent = pendingHarvest;
    }

    updateApprovalKPIs(products) {
        const pending = products.filter(p => p.status === 'pending').length;

        const pendingEl = document.getElementById('kpi-approval-pending');
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
                            const customerVerified = r.customer_is_verified === true;
                            const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                            return `
                                <tr>
                                    <td>${this.escapeHtml(customerName)}${customerVerified ? ' <i class="bi bi-check-circle-fill text-primary" style="font-size:0.75rem;margin-left:4px;" title="Verified Customer"></i>' : ''}</td>
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
        // Update both available and preorder category filters
        const availableCategoryFilter = document.getElementById('available-category-filter');
        const preorderCategoryFilter = document.getElementById('preorder-category-filter');
        
        if (!availableCategoryFilter && !preorderCategoryFilter) return;

        const categories = Array.from(new Set(
            (Array.isArray(products) ? products : [])
                .map((p) => String(p?.category_name || '').trim())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b));

        const optionsHtml = ['<option value="">All categories</option>']
            .concat(categories.map((category) => `<option value="${this.escapeAttr(category.toLowerCase())}">${this.escapeHtml(category)}</option>`))
            .join('');

        if (availableCategoryFilter) {
            const previousValue = String(availableCategoryFilter.value || '').trim().toLowerCase();
            availableCategoryFilter.innerHTML = optionsHtml;
            availableCategoryFilter.value = previousValue;
        }

        if (preorderCategoryFilter) {
            const previousValue = String(preorderCategoryFilter.value || '').trim().toLowerCase();
            preorderCategoryFilter.innerHTML = optionsHtml;
            preorderCategoryFilter.value = previousValue;
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
                        <div><strong>Location:</strong> ${this.escapeHtml(
                            product.province 
                                ? (product.city ? `${product.city}, ${product.province}` : product.province)
                                : product.location || 'Not specified'
                        )}</div>
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
        const categoryInput = document.getElementById('product-category');
        const category_id = categoryInput?.dataset.value || categoryInput?.value;
        const unitInput = document.getElementById('product-unit');
        const unit = unitInput?.value || 'kg';
        const locationDisplay = document.getElementById('product-location-display');
        const location = locationDisplay?.value || document.getElementById('product-location').value;

        // Handle tabbed management fields
        const activeTab = document.querySelector('#add-management-tabs .nav-link.active');
        const isPreorderTab = activeTab && activeTab.getAttribute('data-bs-target') === '#add-preorders-tab';
        
        let price, stock_quantity, harvestDate, expiryDate, preorderAvailabilityDate, maxPreorderQuantity, reservationCutoffDate;
        
        if (isPreorderTab) {
            // Pre-order tab is active
            price = '0';
            stock_quantity = '0';
            harvestDate = '';
            expiryDate = '';
            preorderAvailabilityDate = document.getElementById('add-preorder-availability-date').value;
            maxPreorderQuantity = document.getElementById('add-max-preorder-quantity').value;
            reservationCutoffDate = document.getElementById('add-reservation-cutoff-date').value || '';
        } else {
            // Available Now tab is active
            price = document.getElementById('add-price').value;
            stock_quantity = document.getElementById('add-stock-quantity').value;
            harvestDate = document.getElementById('add-harvest-date').value || '';
            expiryDate = document.getElementById('add-expiry-date').value || '';
            preorderAvailabilityDate = '';
            maxPreorderQuantity = '0';
            reservationCutoffDate = '';
        }

        if (Number(price) < 0 || Number(stock_quantity) < 0) {
            throw new Error('Price and stock must be zero or higher.');
        }

        if (isPreorderTab && !preorderAvailabilityDate) {
            throw new Error('Expected harvest date is required for pre-orders.');
        }

        if (!this.validateProductDates({
            harvestEl: document.getElementById('add-harvest-date'),
            expiryEl: document.getElementById('add-expiry-date')
        })) {
            throw new Error('Invalid product dates.');
        }

        // Upload image through backend so production domain always stores Cloudinary URLs consistently.
        let imageUrl = '';
        let imagePublicId = '';
        const imageFile = document.getElementById('product-image').files[0];
        if (imageFile) {
            const categorySelect = document.getElementById('product-category');
            const uploaded = await this.uploadProductImage(imageFile, {
                name,
                category_id,
                category_name: categorySelect?.selectedOptions?.[0]?.text || ''
            });
            imageUrl = uploaded.imageUrl || '';
            imagePublicId = uploaded.public_id || '';
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
        if (isPreorderTab) {
            formData.append('max_preorder_quantity', maxPreorderQuantity);
            formData.append('preorder_availability_date', preorderAvailabilityDate);
            if (reservationCutoffDate) formData.append('reservation_cutoff_date', reservationCutoffDate);
        }
        if (imageUrl) formData.append('image_url', imageUrl);
        if (typeof imagePublicId !== 'undefined' && imagePublicId) formData.append('cloudinary_public_id', imagePublicId);

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
            throw new Error(data.message || 'Failed to add product');
        }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showMessage(error.message || 'Error adding product', 'error');
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

        const submitBtn = document.querySelector('button[form="edit-product-form"]');
        const originalSubmitText = submitBtn ? submitBtn.textContent.trim() : '';
        this.isSubmittingEditProduct = true;
        this.setEditModalBusyState(true, originalSubmitText || 'Update Product');

        const productId = document.getElementById('edit-product-id').value;
        if (!productId) {
            this.showMessage('Missing product ID', 'error');
            this.isSubmittingEditProduct = false;
            this.setEditModalBusyState(false, originalSubmitText || 'Update Product');
            return;
        }

        try {
        const formData = new FormData();
        formData.append('name', document.getElementById('edit-product-name').value);
        formData.append('description', document.getElementById('edit-product-description').value);
        const editCategoryInput = document.getElementById('edit-product-category');
        const editUnitInput = document.getElementById('edit-product-unit');
        formData.append('category_id', editCategoryInput?.dataset.value || editCategoryInput?.value);
        formData.append('unit', editUnitInput?.value || 'kg');
        
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

        // Handle tabbed management fields
        const activeTab = document.querySelector('#edit-management-tabs .nav-link.active');
        const isPreorderTab = activeTab && activeTab.getAttribute('data-bs-target') === '#edit-preorders-tab';
        
        let price, stock_quantity, harvestDate, expiryDate, preorderAvailabilityDate, maxPreorderQuantity, reservationCutoffDate;
        
        if (isPreorderTab) {
            // Pre-order tab is active
            price = document.getElementById('edit-price').value;
            stock_quantity = document.getElementById('edit-stock-quantity').value;
            harvestDate = '';
            expiryDate = '';
            preorderAvailabilityDate = document.getElementById('edit-preorder-availability-date').value;
            maxPreorderQuantity = document.getElementById('edit-max-preorder-quantity').value;
            reservationCutoffDate = document.getElementById('edit-reservation-cutoff-date').value || '';
        } else {
            // Available Now tab is active
            price = document.getElementById('edit-price').value;
            stock_quantity = document.getElementById('edit-stock-quantity').value;
            harvestDate = document.getElementById('edit-harvest-date').value || '';
            expiryDate = document.getElementById('edit-expiry-date').value || '';
            preorderAvailabilityDate = '';
            maxPreorderQuantity = '0';
            reservationCutoffDate = '';
        }

        formData.append('price', price);
        formData.append('stock_quantity', stock_quantity);

        const editPrice = Number(price);
        const editStock = Number(stock_quantity);
        if (editPrice < 0 || editStock < 0) {
            throw new Error('Price and stock must be zero or higher.');
        }

        if (!this.validateProductDates({
            harvestEl: document.getElementById('edit-harvest-date'),
            expiryEl: document.getElementById('edit-expiry-date')
        })) {
            throw new Error('Invalid product dates.');
        }

        if (isPreorderTab && !preorderAvailabilityDate) {
            throw new Error('Expected harvest date is required for pre-orders.');
        }

        formData.append('harvest_date', harvestDate);
        formData.append('expiry_date', expiryDate);
        if (isPreorderTab) {
            formData.append('max_preorder_quantity', maxPreorderQuantity);
            formData.append('preorder_availability_date', preorderAvailabilityDate);
            if (reservationCutoffDate) formData.append('reservation_cutoff_date', reservationCutoffDate);
        }

        const imageFile = document.getElementById('edit-product-image').files[0];
        if (imageFile) {
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
        }

        const response = await fetch(`${this.apiBase}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            const isResubmit = this.currentEditProductStatus === 'rejected';
            this.showMessage(isResubmit ? 'Product resubmitted for approval!' : 'Product updated successfully!', 'success');
            this.closeEditModal(true);
            this.loadMyProducts();
            this.loadFarmerStats();
        } else {
            throw new Error(data.message || 'Failed to update product');
        }
        } catch (error) {
            console.error('Error in edit product:', error);
            this.showMessage(error.message || 'Error processing product update', 'error');
        } finally {
            this.isSubmittingEditProduct = false;
            const isResubmit = this.currentEditProductStatus === 'rejected';
            const label = isResubmit ? 'Resubmit Product' : (originalSubmitText || 'Update Product');
            this.setEditModalBusyState(false, label);
        }
    }

    async handleHarvestPreorder(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}/harvest-preorder`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Pre-order inventory harvested successfully!', 'success');
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to harvest pre-order inventory', 'error');
            }
        } catch (error) {
            console.error('Error harvesting pre-order:', error);
            this.showMessage('Error harvesting pre-order inventory', 'error');
        }
    }

    async handleConvertPreorder(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}/convert-preorder`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Remaining pre-order inventory converted successfully!', 'success');
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to convert pre-order inventory', 'error');
            }
        } catch (error) {
            console.error('Error converting pre-order:', error);
            this.showMessage('Error converting pre-order inventory', 'error');
        }
    }

    async handleDisableProduct(productId) {
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_available: false })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Product disabled successfully!', 'success');
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to disable product', 'error');
            }
        } catch (error) {
            console.error('Error disabling product:', error);
            this.showMessage('Error disabling product', 'error');
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

                // Determine if product is preorder and show correct tab
                const isPreorder = product.is_preorder === true || product.is_preorder === 't' || product.is_preorder === 'true' || product.is_preorder === 1 || product.is_preorder === '1';
                
                // Set correct tab based on product type
                const availableTab = document.querySelector('button[data-bs-target="#edit-available-now-tab"]');
                const preorderTab = document.querySelector('button[data-bs-target="#edit-preorders-tab"]');
                const availableTabContent = document.getElementById('edit-available-now-tab');
                const preorderTabContent = document.getElementById('edit-preorders-tab');
                
                if (isPreorder) {
                    if (availableTab) availableTab.classList.remove('active');
                    if (preorderTab) preorderTab.classList.add('active');
                    if (availableTabContent) availableTabContent.classList.remove('active', 'show');
                    if (preorderTabContent) preorderTabContent.classList.add('active', 'show');
                } else {
                    if (availableTab) availableTab.classList.add('active');
                    if (preorderTab) preorderTab.classList.remove('active');
                    if (availableTabContent) availableTabContent.classList.add('active', 'show');
                    if (preorderTabContent) preorderTabContent.classList.remove('active', 'show');
                }

                // Populate edit form
                document.getElementById('edit-product-id').value = product.id;
                document.getElementById('edit-product-name').value = product.name;
                document.getElementById('edit-price').value = product.price;
                const editCategoryInput = document.getElementById('edit-product-category');
                const editCategoryDropdown = document.getElementById('edit-product-category-dropdown');

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

                document.getElementById('edit-stock-quantity').value = product.stock_quantity;
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

                // Store current product status for resubmit logic
                this.currentEditProductStatus = product.status || 'approved';

                // Show modal with appropriate button text and title
                const submitLabel = this.currentEditProductStatus === 'rejected' ? 'Resubmit Product' : 'Update Product';
                const modalTitle = this.currentEditProductStatus === 'rejected' ? 'Resubmit Product' : 'Edit Product';
                const modalTitleEl = document.getElementById('edit-product-modal-title');
                if (modalTitleEl) {
                    modalTitleEl.innerHTML = this.currentEditProductStatus === 'rejected' 
                        ? '<i class="bi bi-arrow-repeat me-2 text-primary"></i>Resubmit Product'
                        : '<i class="bi bi-pencil-square me-2 text-primary"></i>Edit Product';
                }
                this.setEditModalBusyState(false, submitLabel);
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
        const isResubmit = this.currentEditProductStatus === 'rejected';
        this.setEditModalBusyState(false, isResubmit ? 'Resubmit Product' : 'Update Product');
        document.getElementById('edit-product-modal').classList.remove('open');
        document.getElementById('edit-product-form').reset();
        document.getElementById('edit-product-image-preview').innerHTML = '';
    }

    setEditModalBusyState(isBusy, submitLabel = 'Update Product') {
        const modalEl = document.getElementById('edit-product-modal');
        const submitBtn = document.querySelector('button[form="edit-product-form"]');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const closeBtn = document.querySelector('#edit-product-modal .close-btn');

        if (modalEl) {
            modalEl.classList.toggle('busy', Boolean(isBusy));
        }

        if (submitBtn) {
            submitBtn.disabled = Boolean(isBusy);
            const icon = '<i class="bi bi-check-lg me-1"></i>';
            submitBtn.innerHTML = isBusy ? 'Updating...' : icon + submitLabel;
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
        // Filter products from cache and re-render
        if (!this.myProductsCache || !Array.isArray(this.myProductsCache)) {
            return;
        }

        const searchTerm = (document.getElementById('products-search-input')?.value || '').toLowerCase().trim();
        const statusFilter = (document.getElementById('product-status-filter')?.value || '').toLowerCase().trim();
        const categoryFilter = (document.getElementById('product-category-filter')?.value || '').toLowerCase().trim();

        const filtered = this.myProductsCache.filter(product => {
            // Search filter
            const nameMatch = !searchTerm || String(product.name || '').toLowerCase().includes(searchTerm);
            
            // Status filter
            let statusMatch = true;
            if (statusFilter === 'available') {
                const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
                const stock = Number(product.stock_quantity ?? 0);
                statusMatch = isAvailable && stock > 0;
            } else if (statusFilter === 'disabled') {
                const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
                statusMatch = !isAvailable;
            } else if (statusFilter === 'pending') {
                statusMatch = product.status === 'pending';
            } else if (statusFilter === 'rejected') {
                statusMatch = product.status === 'rejected';
            }

            // Category filter
            let categoryMatch = true;
            if (categoryFilter) {
                categoryMatch = String(product.category_name || '').toLowerCase().includes(categoryFilter);
            }

            return nameMatch && statusMatch && categoryMatch;
        });

        this.renderMyProducts(filtered);
    }

    filterAvailableProducts() {
        // Filter available products from cache and re-render
        if (!this.myProductsCache || !Array.isArray(this.myProductsCache)) {
            return;
        }

        const searchTerm = (document.getElementById('available-search-input')?.value || '').toLowerCase().trim();
        const statusFilter = (document.getElementById('available-status-filter')?.value || '').toLowerCase().trim();
        const categoryFilter = (document.getElementById('available-category-filter')?.value || '').toLowerCase().trim();

        // Start with non-preorder products only
        let filtered = this.myProductsCache.filter(p => !p.is_preorder);

        filtered = filtered.filter(product => {
            // Search filter
            const nameMatch = !searchTerm || String(product.name || '').toLowerCase().includes(searchTerm);
            
            // Status filter
            let statusMatch = true;
            if (statusFilter === 'active') {
                const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
                const isAdminDisabled = (product.is_admin_disabled === true || product.is_admin_disabled === 't' || product.is_admin_disabled === 'true' || product.is_admin_disabled === 1 || product.is_admin_disabled === '1');
                const stock = Number(product.stock_quantity ?? 0);
                statusMatch = isAvailable && !isAdminDisabled && stock > 0;
            } else if (statusFilter === 'out_of_stock') {
                const stock = Number(product.stock_quantity ?? 0);
                statusMatch = stock === 0;
            } else if (statusFilter === 'disabled') {
                const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
                statusMatch = !isAvailable;
            }

            // Category filter
            let categoryMatch = true;
            if (categoryFilter) {
                categoryMatch = String(product.category_name || '').toLowerCase().includes(categoryFilter);
            }

            return nameMatch && statusMatch && categoryMatch;
        });

        this.renderAvailableProducts(filtered);
    }

    filterPreorderProducts() {
        // Filter preorder products from cache and re-render
        if (!this.myProductsCache || !Array.isArray(this.myProductsCache)) {
            return;
        }

        const searchTerm = (document.getElementById('preorder-search-input')?.value || '').toLowerCase().trim();
        const statusFilter = (document.getElementById('preorder-status-filter')?.value || '').toLowerCase().trim();
        const categoryFilter = (document.getElementById('preorder-category-filter')?.value || '').toLowerCase().trim();

        // Start with preorder products only
        let filtered = this.myProductsCache.filter(p => p.is_preorder);

        filtered = filtered.filter(product => {
            // Search filter
            const nameMatch = !searchTerm || String(product.name || '').toLowerCase().includes(searchTerm);
            
            // Status filter
            let statusMatch = true;
            if (statusFilter === 'active') {
                const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
                const isAdminDisabled = (product.is_admin_disabled === true || product.is_admin_disabled === 't' || product.is_admin_disabled === 'true' || product.is_admin_disabled === 1 || product.is_admin_disabled === '1');
                statusMatch = isAvailable && !isAdminDisabled;
            } else if (statusFilter === 'harvest_ready') {
                statusMatch = product.status === 'harvest_ready';
            } else if (statusFilter === 'disabled') {
                const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
                statusMatch = !isAvailable;
            }

            // Category filter
            let categoryMatch = true;
            if (categoryFilter) {
                categoryMatch = String(product.category_name || '').toLowerCase().includes(categoryFilter);
            }

            return nameMatch && statusMatch && categoryMatch;
        });

        this.renderPreorderProducts(filtered);
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
                        <input type="text" id="account-first-name" class="editable-field" value="${this.escapeAttr(personalName.firstName)}" placeholder="First name" maxlength="40">
                    </div>
                    <div class="form-group">
                        <label for="account-middle-name">Middle Name</label>
                        <input type="text" id="account-middle-name" class="editable-field" value="${this.escapeAttr(personalName.middleName)}" placeholder="Optional" maxlength="40">
                    </div>
                    <div class="form-group">
                        <label for="account-last-name">Last Name</label>
                        <input type="text" id="account-last-name" class="editable-field" value="${this.escapeAttr(personalName.lastName)}" placeholder="Last name" maxlength="40">
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h4 style="margin:0 0 10px 0;">Shop Profile</h4>
                <form id="account-shop-form" class="product-form">
                    <div class="form-group">
                        <label for="shop-name-input">Farm Name</label>
                        <input type="text" id="shop-name-input" class="editable-field" value="${this.escapeAttr(name)}" placeholder="My Farm Shop" maxlength="40">
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
                        this.lastOrdersByStatus[status] = cancelledOrders;
                        cancelledOrders.forEach(o => this.lastOrdersById.set(Number(o.id), o));
                        if (this.activeOrderStatus === status) {
                            this.renderOrders(cancelledOrders, status);
                        }
                        this.updateOrdersTabCounts();
                        return;
                    }
                }

                this.lastOrdersByStatus[status] = orders;
                orders.forEach(o => this.lastOrdersById.set(Number(o.id), o));
                if (this.activeOrderStatus === status) {
                    this.renderOrders(orders, status);
                }
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
        this.lastOrdersByStatus = { pending: [], preorder_reserved: [], confirmed: [], preparing: [], scheduled: [], out_for_delivery: [], delivered: [], cancelled: [] };

        // Clear all order containers in UI
        const statuses = ['pending', 'preorder_reserved', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery', 'delivered', 'cancelled'];
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
        // Load all order statuses including preorder_reserved and scheduled
        try {
            await Promise.all([
                this.loadOrdersByStatus('pending'),
                this.loadOrdersByStatus('preorder_reserved'),
                this.loadOrdersByStatus('confirmed'),
                this.loadOrdersByStatus('preparing'),
                this.loadOrdersByStatus('scheduled'),
                this.loadOrdersByStatus('out_for_delivery'),
                this.loadOrdersByStatus('delivered'),
                this.loadOrdersByStatus('cancelled')
            ]);
        } catch (error) {
            console.error('Error loading all orders:', error);
        }
    }

    // loadPreorders removed - now using status-based loading with preorder_reserved

    updateOrdersTabCounts() {
        const statuses = ['pending', 'preorder_reserved', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery', 'delivered', 'cancelled'];
        statuses.forEach((status) => {
            const tab = document.getElementById(`${status}-orders-tab`);
            const badge = document.getElementById(`${status}-orders-count`);
            const statsCard = document.getElementById(`orders-${status}-count`);
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
            // Update stats card in order management section
            if (statsCard) {
                statsCard.textContent = String(count);
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
        this.activeOrderStatus = status;

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
        } else {
            this.renderOrders(this.lastOrdersByStatus[status] || [], status);
        }
    }

    getOrderStatusBadge(status) {
        const statusMap = {
            pending: { class: 'pending', label: 'Pending' },
            preorder_reserved: { class: 'preorder_reserved', label: 'Preorder Reserved' },
            confirmed: { class: 'confirmed', label: 'Confirmed' },
            preparing: { class: 'preparing', label: 'Preparing' },
            scheduled: { class: 'scheduled', label: 'Scheduled' },
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
        } else if (status === 'preorder_reserved') {
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
                <button class="btn btn-sm btn-info order-schedule-btn" data-action="schedule-delivery" data-order-id="${orderId}">
                    <i class="bi bi-calendar me-1"></i>Schedule Delivery
                </button>
            `;
        } else if (status === 'preparing') {
            return `
                <button class="btn btn-sm btn-info order-schedule-btn" data-action="schedule-delivery" data-order-id="${orderId}">
                    <i class="bi bi-calendar me-1"></i>Schedule Delivery
                </button>
                <button class="btn btn-sm btn-danger order-cancel-btn" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="cancelled">
                    <i class="bi bi-x-lg me-1"></i>Cancel
                </button>
            `;
        } else if (status === 'scheduled') {
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
            // Delivered and cancelled - no actions needed
            return '';
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
            const price = Number(String(item.price || order.price || 0).replace(/[^\d.-]/g, '')) || 0;
            const totalAmount = Number(String(item.total_amount || order.total_amount || 0).replace(/[^\d.-]/g, '')) || 0;
            const orderId = Number(order.id);
            const orderDate = order.created_at ? new Date(order.created_at) : null;
            const deliveryAddress = String(order.delivery_address || '').trim();
            const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified';
            const specialInstructions = String(order.special_instructions || '').trim();
            const customerName = String(order.customer_name || '—').trim();
            const customerVerified = order.customer_is_verified === true;
            const customerRating = Number(order.customer_average_rating || 0);
            const customerTotalRatings = Number(order.customer_total_ratings || 0);
            const searchText = `${String(orderId)} ${productName} ${customerName}`.toLowerCase();
            const dateLabel = orderDate && !Number.isNaN(orderDate.getTime())
                ? orderDate.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
                : '—';
            
            return `
            <div class="order-card" data-order-id="${orderId}" data-search-text="${this.escapeAttr(searchText)}" style="cursor:pointer;">
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
                    <div class="order-card-product-name">${this.escapeHtml(productName)}</div>
                    <div class="order-card-product-qty">Qty: ${quantity}</div>
                </div>
                <div class="order-card-customer">
                    <div class="order-card-customer-name">${this.escapeHtml(customerName)}${customerVerified ? ' <i class="bi bi-check-circle-fill text-primary" style="font-size:0.75rem;margin-left:4px;" title="Verified Customer"></i>' : ''}</div>
                    <div class="order-card-customer-location">${this.escapeHtml(deliveryAddress || '—')}</div>
                </div>
                <div class="order-card-pricing">
                    <div class="order-card-unit-price">${this.fmtCurrency(price)} / unit</div>
                    <div class="order-card-total">${this.fmtCurrency(totalAmount)}</div>
                </div>
                <div class="order-card-actions">
                    ${this.getOrderActionButtons({ id: orderId, status: currentStatus })}
                </div>
            </div>
`;
        }).join('');

        this.applyOrdersSearch();

        this.updateOrdersTabCounts();

        // Add click listeners to order cards
        container.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking on action buttons
                if (e.target.closest('.order-card-actions')) return;
                const orderId = Number(card.dataset.orderId);
                this.openOrderModal(orderId);
            });
        });
    }

    openOrderModal(orderId) {
        const order = this.lastOrdersById.get(Number(orderId));
        if (!order) {
            this.showMessage('Order details not loaded yet. Please refresh orders.', 'error');
            return;
        }

        const modal = document.getElementById('order-details-modal');
        const body = document.getElementById('order-details-body');
        if (!modal || !body) return;

        const item = (order.items && order.items[0]) || order;
        const currentStatus = item.status || order.status || 'pending';
        const productImage = item.image_url || order.product_image || '/images/logo.png';
        const productName = item.product_name || order.product_name || 'Product';
        const quantity = item.quantity || order.quantity || 1;
        const price = Number(String(item.price || order.price || 0).replace(/[^\d.-]/g, '')) || 0;
        const totalAmount = Number(String(item.total_amount || order.total_amount || 0).replace(/[^\d.-]/g, '')) || 0;
        const customerName = String(order.customer_name || '—').trim();
        const customerEmail = String(order.customer_email || '—').trim();
        const customerPhone = String(order.customer_phone || '—').trim();
        const deliveryAddress = String(order.delivery_address || '').trim();
        const specialInstructions = String(order.special_instructions || '').trim();
        const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified';
        const orderDate = order.created_at ? new Date(order.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

        body.innerHTML = `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0">Order #${order.id}</h5>
                    ${this.getOrderStatusBadge(currentStatus)}
                </div>
            </div>

            <div class="mb-3">
                <h6 class="fw-semibold mb-2">Customer Information</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-borderless">
                        <tr>
                            <td class="text-muted pe-2" style="white-space:nowrap">Name:</td>
                            <td>${this.escapeHtml(customerName)}${customerVerified ? ' <i class="bi bi-check-circle-fill text-primary" style="font-size:0.75rem;margin-left:4px;" title="Verified Customer"></i>' : ''}</td>
                        </tr>
                        <tr>
                            <td class="text-muted pe-2" style="white-space:nowrap">Email:</td>
                            <td>${this.escapeHtml(customerEmail)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted pe-2" style="white-space:nowrap">Phone:</td>
                            <td>${this.escapeHtml(customerPhone)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <div class="mb-3">
                <h6 class="fw-semibold mb-2">Delivery Information</h6>
                <p class="mb-1"><strong>Address:</strong> ${this.escapeHtml(deliveryAddress || '—')}</p>
                <p class="mb-1"><strong>Delivery Date:</strong> ${this.escapeHtml(deliveryDate)}</p>
                ${specialInstructions ? `<p class="mb-0"><strong>Special Instructions:</strong> ${this.escapeHtml(specialInstructions)}</p>` : ''}
            </div>

            <div class="mb-3">
                <h6 class="fw-semibold mb-2">Order Information</h6>
                <p class="mb-1"><strong>Date:</strong> ${orderDate}</p>
                <p class="mb-1"><strong>Total:</strong> ${this.fmtCurrency(totalAmount)}</p>
            </div>

            <div class="mb-3">
                <h6 class="fw-semibold mb-2">Item</h6>
                <div class="d-flex align-items-center gap-2 p-2 border rounded">
                    <img src="${this.escapeHtml(productImage)}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${this.escapeHtml(productName)}</div>
                        <div class="small text-muted">${this.fmtNumber(quantity)} × ${this.fmtCurrency(price)} = ${this.fmtCurrency(totalAmount)}</div>
                    </div>
                </div>
            </div>

            <div class="mb-3">
                <h6 class="fw-semibold mb-2">Actions</h6>
                <div class="order-card-actions">
                    ${this.getOrderActionButtons({ id: order.id, status: currentStatus })}
                </div>
            </div>
        `;

        modal.classList.add('open');
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
            'cancelled': 'Cancelled',
            'preorder': 'Pre-orders'
        };
        return labels[status] || status;
    }

    applyTopSearch() {
        const q = (document.getElementById('farmer-search-input')?.value || '').trim().toLowerCase();

        if (this.activeSection === 'products') {
            // Check which tab is active and apply appropriate filter
            const availableTab = document.getElementById('available-now-tab');
            const preorderTab = document.getElementById('preorders-tab');
            
            if (availableTab && availableTab.style.display !== 'none') {
                this.filterAvailableProducts();
            } else if (preorderTab && preorderTab.style.display !== 'none') {
                this.filterPreorderProducts();
            } else {
                // Default to available if neither is visible
                this.filterAvailableProducts();
            }
            return;
        }

        if (!q) {
            // reset simple visibility for common lists
            document.querySelectorAll('#orders-grid .order-card').forEach(el => (el.style.display = ''));
            document.querySelectorAll('#conversation-list .conversation-item').forEach(el => (el.style.display = ''));
            document.querySelectorAll('#overview .overview-row').forEach(el => (el.style.display = ''));
            this.updateOrdersSearchEmptyState();
            return;
        }

        if (this.activeSection === 'orders') {
            document.querySelectorAll('#orders-grid .order-card').forEach(card => {
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
        const cards = document.querySelectorAll('#orders-grid .order-card');

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
        const allCards = document.querySelectorAll('#orders-grid .order-card');
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

    openScheduleDeliveryModal(orderId) {
        const modal = document.getElementById('schedule-delivery-modal');
        const orderText = document.getElementById('schedule-delivery-order');
        const dateInput = document.getElementById('delivery-date-input');
        
        if (modal && orderText && dateInput) {
            orderText.textContent = `Order #${orderId}`;
            // Set minimum date to today
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            dateInput.value = today;
            dateInput.required = true;
            
            this.currentScheduleOrderId = orderId;
            modal.classList.add('open');
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');
        }
    }

    closeScheduleDeliveryModal() {
        const modal = document.getElementById('schedule-delivery-modal');
        if (modal) modal.classList.remove('open');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        this.currentScheduleOrderId = null;
    }

    async submitScheduleDeliveryForm(e) {
        e.preventDefault();
        
        const dateInput = document.getElementById('delivery-date-input');
        const deliveryDate = dateInput?.value;
        
        if (!deliveryDate) {
            this.showMessage('Please select a delivery date', 'error');
            return;
        }
        
        // Validate date is not in the past
        const today = new Date().toISOString().split('T')[0];
        if (deliveryDate < today) {
            this.showMessage('Delivery date cannot be in the past', 'error');
            return;
        }
        
        if (!this.currentScheduleOrderId) {
            this.showMessage('Order ID not found', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/orders/${this.currentScheduleOrderId}/delivery-date`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ delivery_date: deliveryDate })
            });
            
            if (response.ok) {
                this.showMessage('Delivery scheduled successfully', 'success');
                this.closeScheduleDeliveryModal();
                // Reload orders to reflect status change
                this.loadMyOrders();
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to schedule delivery', 'error');
            }
        } catch (error) {
            console.error('Schedule delivery error:', error);
            this.showMessage('Error scheduling delivery', 'error');
        }
    }

    showRejectionReason(reason) {
        const modal = document.getElementById('rejection-reason-modal');
        const reasonText = document.getElementById('rejection-reason-text');
        if (modal && reasonText) {
            reasonText.textContent = reason;
            modal.classList.add('open');
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');
        }
    }

    closeRejectionReasonModal() {
        const modal = document.getElementById('rejection-reason-modal');
        if (modal) modal.classList.remove('open');
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
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
        this.showToast(message, type);
    }

    showToast(message, type = 'info') {
        let stack = document.getElementById('admin-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'admin-toast-stack';
            stack.className = 'admin-toast-stack';
            document.body.appendChild(stack);
        }

        const typeClass = type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : type === 'warning' ? 'toast-warning' : 'toast-info';

        const toast = document.createElement('div');
        toast.className = `admin-toast ${typeClass}`;
        toast.innerHTML = `
            <div class="toast-body"><p class="toast-msg">${this.escapeHtml(message)}</p></div>
            <button class="toast-close" aria-label="Dismiss">&times;</button>
        `;

        const dismiss = () => {
            toast.classList.add('dismissing');
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        };
        toast.querySelector('.toast-close').addEventListener('click', dismiss);

        stack.appendChild(toast);
        setTimeout(dismiss, 3500);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Verification request functions
    async uploadToCloudinary(file) {
        const formData = new FormData();
        formData.append('document', file);

        try {
            const response = await fetch('/api/upload/verification-document', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            return data.imageUrl;
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw error;
        }
    }

    openVerificationSection() {
        this.showSection('profile', 'verification');
    }

    openVerificationRequestModal() {
        document.getElementById('verification-request-modal').classList.add('open');
        document.getElementById('verification-request-form').reset();
        document.getElementById('document-preview').style.display = 'none';
    }

    closeVerificationRequestModal() {
        document.getElementById('verification-request-modal').classList.remove('open');
    }

    previewDocumentImage(event) {
        const file = event.target.files[0];
        if (file) {
            // Validate file size (5MB limit)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
                this.showMessage('File size exceeds 5MB limit. Please choose a smaller file.', 'error');
                event.target.value = ''; // Clear the input
                document.getElementById('document-preview').style.display = 'none';
                return;
            }

            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!validTypes.includes(file.type)) {
                this.showMessage('Only JPG and PNG files are allowed.', 'error');
                event.target.value = ''; // Clear the input
                document.getElementById('document-preview').style.display = 'none';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('document-preview');
                const img = document.getElementById('document-preview-img');
                img.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    async handleVerificationRequest(event) {
        event.preventDefault();

        const fileInput = document.getElementById('verification-document');
        const notes = document.getElementById('verification-notes').value;
        const submitBtn = event.target.querySelector('button[type="submit"]');

        // Validate that a file is selected
        if (!fileInput.files[0]) {
            this.showMessage('Please select a document image to upload', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            let document_url = null;

            if (fileInput.files[0]) {
                document_url = await this.uploadToCloudinary(fileInput.files[0]);
            }

            const response = await fetch('/api/farmers/me/verification-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ document_url, notes })
            });

            const data = await response.json();

            if (response.ok) {
                this.renderVerificationSubsection();
                this.showMessage('Verification request submitted successfully', 'success');
                await this.loadVerificationStatus();
            } else {
                this.showMessage(data.message || 'Failed to submit request', 'error');
            }
        } catch (error) {
            console.error('Verification request error:', error);
            this.showMessage('Failed to submit request. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Request';
        }
    }

    async loadVerificationStatus() {
        try {
            const response = await fetch(`${this.apiBase}/farmers/me/verification-request`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            const data = await response.json();

            if (response.ok && data.request) {
                this.currentVerificationRequest = data.request;
                this.verificationHistory = data.history || [];
            } else {
                this.currentVerificationRequest = null;
                this.verificationHistory = [];
            }
            this.updateVerificationUI();
            this.renderVerificationSubsection();
            this.updateFarmerVerifBanner();
        } catch (error) {
            console.error('Failed to load verification status:', error);
            this.currentVerificationRequest = null;
            this.verificationHistory = [];
            this.updateVerificationUI();
            this.renderVerificationSubsection();
            this.updateFarmerVerifBanner();
        }
    }

    updateFarmerVerifBanner() {
        const bannerEl = document.getElementById('farmer-verif-banner');
        if (!bannerEl) return;

        if (this.authProfile?.is_disabled) {
            bannerEl.style.display = '';
            bannerEl.style.cssText += ';background:#fee2e2;color:#7f1d1d;border:1px solid #fecaca;';
            bannerEl.innerHTML = '<i class="fas fa-ban"></i> Your account has been disabled. Please contact support. <button onclick="this.parentElement.style.display=\'none\'" style="margin-left:auto;padding:4px 8px;background:transparent;color:inherit;border:none;border-radius:4px;cursor:pointer;font-size:16px;font-weight:bold;">✕</button>';
        } else if (!this.currentVerificationRequest || this.currentVerificationRequest.status === 'unverified') {
            bannerEl.style.display = '';
            bannerEl.style.cssText += ';background:#fef9c3;color:#713f12;border:1px solid #fde047;';
            bannerEl.innerHTML = '<i class="fas fa-info-circle"></i> Your account is unverified. Submit a verification request to unlock unlimited products (up to 10 products without verification). <button onclick="farmerDashboard.openVerificationSection()" style="margin-left:10px;padding:6px 12px;background:#2d7a3a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Verify Now</button> <button onclick="this.parentElement.style.display=\'none\'" style="margin-left:auto;padding:4px 8px;background:transparent;color:inherit;border:none;border-radius:4px;cursor:pointer;font-size:16px;font-weight:bold;">✕</button>';
        } else if (this.currentVerificationRequest.status === 'pending') {
            bannerEl.style.display = '';
            bannerEl.style.cssText += ';background:#fef9c3;color:#713f12;border:1px solid #fde047;';
            bannerEl.innerHTML = '<i class="fas fa-clock"></i> Verification Request Pending - Your request is under review. <button onclick="this.parentElement.style.display=\'none\'" style="margin-left:auto;padding:4px 8px;background:transparent;color:inherit;border:none;border-radius:4px;cursor:pointer;font-size:16px;font-weight:bold;">✕</button>';
        } else if (this.currentVerificationRequest.status === 'rejected') {
            bannerEl.style.display = '';
            bannerEl.style.cssText += ';background:#fee2e2;color:#7f1d1d;border:1px solid #fecaca;';
            bannerEl.innerHTML = '<i class="fas fa-times-circle"></i> Verification Request Rejected. Submit new request after addressing feedback. <button onclick="farmerDashboard.openVerificationSection()" style="margin-left:10px;padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Resubmit Request</button> <button onclick="this.parentElement.style.display=\'none\'" style="margin-left:auto;padding:4px 8px;background:transparent;color:inherit;border:none;border-radius:4px;cursor:pointer;font-size:16px;font-weight:bold;">✕</button>';
        } else {
            bannerEl.style.display = 'none';
        }
    }

    updateVerificationUI() {
        const btn = document.getElementById('verification-request-btn');
        const menuText = document.getElementById('verification-menu-text');
        const icon = btn?.querySelector('i');

        // Update name field states based on verification status
        const isVerified = this.currentVerificationRequest?.status === 'approved' || this.authProfile?.is_verified === true;
        const nameInputs = ['pe-firstname', 'pe-middlename', 'pe-lastname'];
        const verifiedHint = document.getElementById('pe-name-verified-hint');

        nameInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = isVerified;
            }
        });

        if (verifiedHint) {
            verifiedHint.style.display = isVerified ? 'block' : 'none';
        }

        if (!this.currentVerificationRequest) {
            // No request - show button
            if (btn) {
                btn.style.display = '';
                btn.style.removeProperty('display');
            }
            if (menuText) menuText.textContent = 'Request Verification';
            if (icon) {
                icon.className = 'bi bi-shield-check';
            }
        } else {
            const status = this.currentVerificationRequest.status;
            if (status === 'pending') {
                if (btn) {
                    btn.style.display = '';
                    btn.style.removeProperty('display');
                }
                if (menuText) menuText.textContent = 'Verification: Pending';
                if (icon) {
                    icon.className = 'bi bi-clock text-warning';
                }
            } else if (status === 'rejected') {
                if (btn) {
                    btn.style.display = '';
                    btn.style.removeProperty('display');
                }
                if (menuText) menuText.textContent = 'Verification: Rejected';
                if (icon) {
                    icon.className = 'bi bi-exclamation-triangle text-danger';
                }
            } else if (status === 'approved') {
                // Verified - remove dropdown item entirely since it's accessible from My Profile
                if (btn) {
                    const parentLi = btn.closest('li');
                    if (parentLi) parentLi.remove();
                }
            }
        }

        // Update verified icon in header
        const verifiedIcon = document.getElementById('header-verified-icon');
        if (verifiedIcon) {
            const isVerified = this.currentVerificationRequest?.status === 'approved';
            verifiedIcon.style.display = isVerified ? 'inline-block' : 'none';
            if (isVerified && typeof bootstrap !== 'undefined') {
                new bootstrap.Tooltip(verifiedIcon);
            }
        }
    }

    renderVerificationSubsection() {
        const headerSection = document.getElementById('verification-header-section');
        const benefitsSection = document.getElementById('verification-benefits-section');
        const formSection = document.getElementById('verification-request-form-section');
        const statusSection = document.getElementById('verification-status-display-section');
        const historySection = document.getElementById('verification-history-section');

        const statusBadge = document.getElementById('verification-status-badge');
        const statusText = document.getElementById('verification-status-text');
        const statusDesc = document.getElementById('verification-status-description');

        if (!statusBadge || !statusText || !statusDesc) {
            console.error('Verification elements not found');
            return;
        }

        if (!this.currentVerificationRequest) {
            // Unverified, no request
            statusBadge.className = 'alert alert-warning';
            statusText.textContent = 'Unverified';
            statusDesc.textContent = 'Submit a verification request to unlock all benefits.';
            benefitsSection.style.display = 'block';
            formSection.style.display = 'block';
            statusSection.style.display = 'none';
            historySection.style.display = 'none';
        } else {
            const status = this.currentVerificationRequest.status;
            if (status === 'pending') {
                statusBadge.className = 'alert alert-warning';
                statusText.textContent = 'Verification request is pending review.';
                statusDesc.textContent = 'Your verification request is being reviewed by our team.';
                benefitsSection.style.display = 'none';
                formSection.style.display = 'none';
                statusSection.style.display = 'block';
                this.renderStatusDisplay();
            } else if (status === 'rejected') {
                statusBadge.className = 'alert alert-danger';
                statusText.textContent = 'Verification request was rejected.';
                statusDesc.textContent = this.currentVerificationRequest.admin_notes || 'Please resubmit with additional information.';
                benefitsSection.style.display = 'block';
                formSection.style.display = 'block';
                statusSection.style.display = 'none';
            } else if (status === 'approved') {
                statusBadge.className = 'alert alert-success';
                statusText.textContent = 'Your account is verified.';
                statusDesc.textContent = 'Your account is verified. Enjoy all benefits!';
                benefitsSection.style.display = 'none';
                formSection.style.display = 'none';
                statusSection.style.display = 'block';
                this.renderStatusDisplay();
            } else if (status === 'unverified') {
                statusBadge.className = 'alert alert-warning';
                statusText.textContent = 'Unverified';
                statusDesc.textContent = 'Submit a verification request to unlock all benefits.';
                benefitsSection.style.display = 'block';
                formSection.style.display = 'block';
                statusSection.style.display = 'none';
                historySection.style.display = 'none';
            }
            historySection.style.display = 'block';
            this.renderHistoryTimeline();
        }
    }

    renderStatusDisplay() {
        if (!this.currentVerificationRequest) return;

        const statusStyles = {
            pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
            approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
            rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' }
        };
        const style = statusStyles[this.currentVerificationRequest.status] || statusStyles.pending;
        document.getElementById('display-status').innerHTML = `<span style="background:${style.bg};color:${style.color};font-size:0.75rem;font-weight:600;padding:4px 10px;border-radius:9999px;text-transform:uppercase;">${style.label}</span>`;
        document.getElementById('display-submitted-date').textContent = new Date(this.currentVerificationRequest.created_at).toLocaleDateString();
        document.getElementById('display-estimated-time').textContent = '1-2 business days';

        if (this.currentVerificationRequest.admin_notes) {
            document.getElementById('display-admin-notes').style.display = 'block';
            document.getElementById('display-notes').textContent = this.currentVerificationRequest.admin_notes;
        }

        if (this.currentVerificationRequest.document_url) {
            document.getElementById('display-document-preview').style.display = 'block';
            document.getElementById('display-document-img').src = this.currentVerificationRequest.document_url;
        }
    }

    renderHistoryTimeline() {
        const tableBody = document.getElementById('verification-history-table-body');
        const emptyState = document.getElementById('verification-history-empty');
        const pagination = document.getElementById('verification-history-pagination');
        const infoEl = document.getElementById('verification-history-info');
        const currentEl = document.getElementById('verification-history-current');
        const prevBtn = document.getElementById('verification-history-prev');
        const nextBtn = document.getElementById('verification-history-next');

        if (!this.verificationHistory || this.verificationHistory.length === 0) {
            tableBody.innerHTML = '';
            emptyState.style.display = 'block';
            pagination.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        pagination.style.display = 'flex';

        // Pagination setup
        const itemsPerPage = 5;
        const totalPages = Math.ceil(this.verificationHistory.length / itemsPerPage);
        let currentPage = this._verificationHistoryPage || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = this.verificationHistory.slice(startIndex, endIndex);

        // Render table rows
        const statusBadgeClass = {
            'approved': 'bg-success',
            'rejected': 'bg-danger',
            'pending': 'bg-warning',
            'unverified': 'bg-secondary'
        };

        const rowsHtml = pageData.map(request => {
            const notes = request.admin_notes || request.rejection_reason || '-';
            const badgeClass = statusBadgeClass[request.status] || 'bg-secondary';
            const truncatedNotes = notes.length > 50 ? notes.substring(0, 50) + '...' : notes;
            const isTruncated = notes.length > 50;
            return `
                <tr>
                    <td>${new Date(request.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span class="badge ${badgeClass}">${request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span></td>
                    <td class="text-muted small" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;" onclick="farmerDashboard.showVerificationNotes('${notes.replace(/'/g, "\\'").replace(/"/g, '\\"')}')" title="${isTruncated ? 'Click to view full notes' : notes}">${truncatedNotes}</td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rowsHtml;

        // Update pagination UI
        infoEl.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, this.verificationHistory.length)} of ${this.verificationHistory.length}`;
        currentEl.textContent = currentPage;

        prevBtn.classList.toggle('disabled', currentPage === 1);
        nextBtn.classList.toggle('disabled', currentPage === totalPages);

        // Store current page
        this._verificationHistoryPage = currentPage;
    }

    handleVerificationHistoryPagination(direction) {
        const itemsPerPage = 5;
        const totalPages = Math.ceil((this.verificationHistory?.length || 0) / itemsPerPage);
        let currentPage = this._verificationHistoryPage || 1;

        if (direction === 'prev' && currentPage > 1) {
            currentPage--;
        } else if (direction === 'next' && currentPage < totalPages) {
            currentPage++;
        }

        this._verificationHistoryPage = currentPage;
        this.renderHistoryTimeline();
    }

    showVerificationNotes(notes) {
        if (!notes || notes === '-') return;

        // Create modal if it doesn't exist
        let modal = document.getElementById('verification-notes-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'verification-notes-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Admin Notes</h3>
                        <button class="close-btn" onclick="farmerDashboard.closeVerificationNotesModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p id="verification-notes-content" style="white-space:pre-wrap;line-height:1.6;"></p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('verification-notes-content').textContent = notes;
        modal.classList.add('open');
    }

    closeVerificationNotesModal() {
        const modal = document.getElementById('verification-notes-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    }

    showVerificationBanner() {
        const banner = document.getElementById('verification-banner');
        const message = document.getElementById('verification-banner-message');
        const openChatBtn = document.getElementById('open-chat-btn');

        if (!this.currentVerificationRequest) {
            banner.style.display = 'none';
            return;
        }

        const dismissed = localStorage.getItem('verificationBannerDismissed');
        const requestKey = `${this.currentVerificationRequest.id}-${this.currentVerificationRequest.status}`;

        if (dismissed === requestKey) {
            banner.style.display = 'none';
            return;
        }

        banner.style.display = 'block';
        banner.className = 'alert alert-dismissible';

        if (this.currentVerificationRequest.status === 'unverified') {
            banner.classList.add('alert-info');
            message.textContent = 'Your account is unverified. Submit a verification request to unlock unlimited products (up to 10 products without verification).';
            openChatBtn.style.display = 'none';
        } else if (this.currentVerificationRequest.status === 'pending') {
            banner.classList.add('alert-warning');
            message.textContent = 'Verification Request Pending - Chat with admin to coordinate payment';
            openChatBtn.style.display = 'inline-block';
            openChatBtn.onclick = () => this.showSection('chat');
        } else if (this.currentVerificationRequest.status === 'approved') {
            banner.classList.add('alert-success');
            message.textContent = 'Account Verified! You now have unlimited products. Upgrade to Premium for advanced analytics.';
            openChatBtn.style.display = 'none';
        } else if (this.currentVerificationRequest.status === 'rejected') {
            banner.classList.add('alert-danger');
            message.textContent = `Request rejected: ${this.currentVerificationRequest.rejection_reason || 'No reason provided'}. Submit new request after addressing feedback.`;
            openChatBtn.style.display = 'none';
        }
    }

    dismissVerificationBanner() {
        if (this.currentVerificationRequest) {
            const requestKey = `${this.currentVerificationRequest.id}-${this.currentVerificationRequest.status}`;
            localStorage.setItem('verificationBannerDismissed', requestKey);
        }
        document.getElementById('verification-banner').style.display = 'none';
    }

    showRejectionModal(reason) {
        document.getElementById('rejection-reason-text').textContent = reason || 'No reason provided';
        document.getElementById('verification-rejection-modal').classList.add('open');
    }

    closeRejectionModal() {
        document.getElementById('verification-rejection-modal').classList.remove('open');
    }

    handleResubmitRequest() {
        this.closeRejectionModal();
        this.openVerificationRequestModal();
    }

    // Support Tickets Methods
    async loadSupportTickets() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/my?page=${this.supportTicketsCurrentPage}&limit=${this.supportTicketsPerPage}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load tickets');

            const data = await response.json();
            this.supportTickets = data.tickets;
            this.supportTicketsTotal = data.total;
            this.renderSupportTicketsTable();
            this.renderSupportTicketsPagination();
            this.updateSupportTicketsBadge();
        } catch (error) {
            console.error('Load support tickets error:', error);
            this.showError('Failed to load support tickets');
        }
    }

    async loadSupportTicketsBadge() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/my?limit=100`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const tickets = data.tickets || [];
            const unreadCount = tickets.reduce((sum, ticket) => sum + Number(ticket.unread_count || 0), 0);
            
            // Update sidebar badge
            const badge = document.getElementById('support-tickets-dropdown-badge');
            if (badge) {
                badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
                badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            }
        } catch (error) {
            console.error('Load support tickets badge error:', error);
        }
    }

    updateSupportTicketsBadge() {
        const unreadCount = this.supportTickets.reduce((sum, ticket) => sum + Number(ticket.unread_count || 0), 0);
        const badge = document.getElementById('support-tickets-dropdown-badge');
        if (badge) {
            if (unreadCount > 0) {
                const displayValue = unreadCount > 99 ? '99+' : String(unreadCount);
                badge.textContent = displayValue;
                badge.style.display = 'inline-block';
                badge.style.minWidth = 'unset';
                badge.style.width = 'auto';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    renderSupportTicketsTable() {
        const tbody = document.querySelector('#support-tickets-table tbody');
        if (!tbody) return;

        if (this.supportTickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No support tickets yet. Click "Create New Ticket" to get help.</td></tr>';
            return;
        }

        tbody.innerHTML = this.supportTickets.map(ticket => {
            const statusStyles = {
                open: { bg: '#dcfce7', color: '#16a34a', label: 'Open' },
                in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
                resolved: { bg: '#fef3c7', color: '#d97706', label: 'Resolved' },
                closed: { bg: '#fee2e2', color: '#dc2626', label: 'Closed' }
            };
            const style = statusStyles[ticket.status] || statusStyles.open;

            return `
                <tr>
                    <td>${this.escapeHtml(ticket.subject)}</td>
                    <td class="text-center"><span style="background:${style.bg};color:${style.color};font-size:0.75rem;font-weight:600;padding:4px 10px;border-radius:9999px;text-transform:uppercase;">${style.label}</span></td>
                    <td>${new Date(ticket.created_at).toLocaleDateString('en-PH')}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-ticket-btn" data-id="${ticket.id}">Chat</button>
                        ${ticket.unread_count > 0 ? '<i class="bi bi-dot text-danger ms-1"></i>' : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // View button uses delegated listener in setupEventListeners
    }

    renderSupportTicketsPagination() {
        const container = document.getElementById('support-tickets-pagination');
        if (!container) return;

        const totalPages = Math.ceil(this.supportTicketsTotal / this.supportTicketsPerPage);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<nav><ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === this.supportTicketsCurrentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        }
        html += '</ul></nav>';
        container.innerHTML = html;

        container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.supportTicketsCurrentPage = parseInt(e.target.dataset.page);
                this.loadSupportTickets();
            });
        });
    }

    openCreateTicketModal() {
        document.getElementById('create-support-ticket-form').reset();
        document.getElementById('subject-char-count').textContent = '0/200 characters';
        document.getElementById('description-char-count').textContent = '0/500 characters';
        new bootstrap.Modal(document.getElementById('create-support-ticket-modal')).show();
        setTimeout(() => document.getElementById('support-ticket-subject').focus(), 100);
    }

    async submitSupportTicket() {
        const subject = document.getElementById('support-ticket-subject').value.trim();
        const description = document.getElementById('support-ticket-description').value.trim();

        if (!subject || !description) {
            this.showMessage('Subject and description are required', 'error');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-support-ticket');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting...';

        try {
            const response = await fetch(`${this.apiBase}/support-tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ subject, description })
            });

            const data = await response.json();
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('create-support-ticket-modal')).hide();
                this.showMessage('Support ticket created successfully', 'success');
                this.loadSupportTickets();
            } else {
                this.showMessage(data.message || 'Failed to create ticket', 'error');
            }
        } catch (error) {
            console.error('Submit ticket error:', error);
            this.showMessage('Failed to create ticket', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    // Support ticket view now redirects to the chat section — modal removed.
}

// Initialize farmer dashboard when DOM is loaded
let farmerDashboard;
document.addEventListener('DOMContentLoaded', () => {
    farmerDashboard = new FarmerDashboard();
    // Make it globally accessible for inline onclick handlers
    window.farmerDashboard = farmerDashboard;

    // Initialize verification request event listeners
    const documentInput = document.getElementById('verification-document');
    if (documentInput) {
        documentInput.addEventListener('change', (e) => farmerDashboard.previewDocumentImage(e));
    }

    const verificationForm = document.getElementById('verification-request-form');
    if (verificationForm) {
        verificationForm.addEventListener('submit', (e) => farmerDashboard.handleVerificationRequest(e));
    }

    const resubmitBtn = document.getElementById('resubmit-verification-btn');
    if (resubmitBtn) {
        resubmitBtn.addEventListener('click', () => farmerDashboard.handleResubmitRequest());
    }

    // Verification history pagination
    document.addEventListener('click', (e) => {
        const pageLink = e.target.closest('[data-page]');
        if (pageLink && pageLink.closest('#verification-history-pagination')) {
            e.preventDefault();
            const direction = pageLink.dataset.page;
            if (farmerDashboard.handleVerificationHistoryPagination) {
                farmerDashboard.handleVerificationHistoryPagination(direction);
            }
        }
    });
});