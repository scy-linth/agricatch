// Farmer Dashboard JavaScript

class FarmerDashboard {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.userId = this.getUserId();
        this.lastOrdersById = new Map();
        this.lastOrdersByStatus = { pending: [], confirmed: [], preparing: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.activeSection = 'overview';
        this.currentShopProfile = null;
        this.isShopProfileEditing = false;

        this.overviewRangeDays = 30;
        this.overviewRangeMode = 'days'; // 'days' | 'all' | 'custom'
        this.overviewCustomFrom = null; // YYYY-MM-DD
        this.overviewCustomTo = null;   // YYYY-MM-DD
        this.overviewCharts = { sales: null, status: null, topProducts: null };
        this.overviewMetrics = null;
        this.overviewRecentOrdersCache = [];
        this.recentOrdersPage = 1;
        this.recentOrdersPerPage = 8;
        this.overviewLastFetchAt = 0;
        this.overviewFetchInFlight = null;
        this.overviewRefreshTimer = null;
        this.myProductsCache = [];

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();
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

    init() {
        this.showDeniedBanner();
        this.checkFarmerAuth();
        this.setupEventListeners();
        this.loadCategories();
        this.loadProductCatalogNames();
        this.setupProductSuggestionListeners();
        this.setupSidebarNavigation();
        this.setupDetailPanel();
        this.setupRealtime();
        this.initChat();
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
            const url = `/api/events?token=${encodeURIComponent(this.token)}`;
            const es = new EventSource(url);
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
                this.farmerId = data.user.id;
                this.loadFarmerStats();
                this.loadMyProducts();
                this.loadMyOrders();
                this.loadShopProfile();
                this.loadOverviewMetrics({ force: true });
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/';
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
        // Mobile sidebar toggle
        const mobileMenuToggle = document.getElementById('farmer-mobile-menu-toggle');
        const farmerSidebar = document.getElementById('farmer-sidebar');
        const sidebarOverlay = document.getElementById('farmer-sidebar-overlay');
        const closeSidebar = () => {
            if (farmerSidebar) farmerSidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            const icon = mobileMenuToggle?.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        };
        if (mobileMenuToggle && farmerSidebar) {
            mobileMenuToggle.addEventListener('click', () => {
                farmerSidebar.classList.toggle('open');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
                const icon = mobileMenuToggle.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-bars');
                    icon.classList.toggle('fa-times');
                }
            });
            if (sidebarOverlay) {
                sidebarOverlay.addEventListener('click', closeSidebar);
            }
            // Close sidebar when clicking on a link
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        closeSidebar();
                    }
                });
            });
        }

        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('add-product-form')?.addEventListener('submit', (e) => this.handleAddProduct(e));
        document.getElementById('edit-product-form')?.addEventListener('submit', (e) => this.handleEditProduct(e));
        document.getElementById('save-shop-profile-btn')?.addEventListener('click', (e) => this.handleShopProfileUpdate(e));
        document.getElementById('submit-custom-product-request')?.addEventListener('click', () => this.submitCustomProductRequest());

        const editShopBtn = document.getElementById('edit-shop-profile-btn');
        if (editShopBtn) {
            editShopBtn.addEventListener('click', () => this.setShopProfileEditMode(true));
        }
        const cancelShopBtn = document.getElementById('cancel-shop-profile-btn');
        if (cancelShopBtn) {
            cancelShopBtn.addEventListener('click', () => this.cancelShopProfileEdit());
        }

        const searchInput = document.getElementById('farmer-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyTopSearch());
        }

        const exportBtn = document.getElementById('overview-export-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportOverviewCsv());
        }

        const accountBtn = document.getElementById('farmer-account-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => this.openAccountPanel());
        }

        const recentPrev = document.getElementById('overview-recent-prev');
        if (recentPrev) {
            recentPrev.addEventListener('click', () => {
                this.recentOrdersPage = Math.max(1, Number(this.recentOrdersPage || 1) - 1);
                this.renderOverviewRecentOrders(this.overviewRecentOrdersCache);
            });
        }
        const recentNext = document.getElementById('overview-recent-next');
        if (recentNext) {
            recentNext.addEventListener('click', () => {
                const totalPages = Math.max(1, Math.ceil((this.overviewRecentOrdersCache?.length || 0) / this.recentOrdersPerPage));
                this.recentOrdersPage = Math.min(totalPages, Number(this.recentOrdersPage || 1) + 1);
                this.renderOverviewRecentOrders(this.overviewRecentOrdersCache);
            });
        }

        document.querySelectorAll('.overview-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-range');
                this.setOverviewRange(range);
            });
        });

        const customApplyBtn = document.getElementById('overview-custom-apply');
        if (customApplyBtn) {
            customApplyBtn.addEventListener('click', () => {
                const fromInput = document.getElementById('overview-from');
                const toInput = document.getElementById('overview-to');
                const from = String(fromInput?.value || '').trim();
                const to = String(toInput?.value || '').trim();
                if (!from || !to) {
                    this.showMessage('Please choose both From and To dates.', 'error');
                    return;
                }
                if (from > to) {
                    this.showMessage('From date must be before To date.', 'error');
                    return;
                }
                this.setOverviewCustomRange(from, to);
            });
        }

        const customCancelBtn = document.getElementById('overview-custom-cancel');
        if (customCancelBtn) {
            customCancelBtn.addEventListener('click', () => {
                this.hideOverviewCustomPanel();
            });
        }

        // Tab switching
        document.getElementById('list-products-tab')?.addEventListener('click', () => this.switchTab('list-products'));
        document.getElementById('add-product-tab')?.addEventListener('click', () => this.switchTab('add-product'));

        // Order status tabs - all 6 statuses
        document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
        document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
        document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
        document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));

        // Product filters
        const productStatusFilter = document.getElementById('product-status-filter');
        if (productStatusFilter) {
            productStatusFilter.addEventListener('change', () => this.filterProducts());
        }
        
        // Optional refresh buttons (check if they exist)
        const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
        if (refreshOrdersBtn) {
            refreshOrdersBtn.addEventListener('click', () => this.loadMyOrders());
        }
        
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => this.closeEditModal());
        }
        const closeEditModalBtn = document.querySelector('#edit-product-modal .close-btn');
        if (closeEditModalBtn) {
            closeEditModalBtn.addEventListener('click', () => this.closeEditModal());
        }

        const addImageInput = document.getElementById('product-image');
        if (addImageInput) {
            addImageInput.addEventListener('change', () => this.previewImage(addImageInput, 'product-image-preview'));
        }
        const editImageInput = document.getElementById('edit-product-image');
        if (editImageInput) {
            editImageInput.addEventListener('change', () => this.previewImage(editImageInput, 'edit-product-image-preview'));
        }

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
        });

        // Initialize date rules for product forms
        this.setupProductDateConstraints();
    }

    async loadProductCatalogNames(categoryId = null) {
        try {
            const params = new URLSearchParams();
            if (categoryId) params.set('category_id', String(categoryId));
            const response = await fetch(`${this.apiBase}/products/catalog/names${params.toString() ? `?${params.toString()}` : ''}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;

            const data = await response.json();
            const names = Array.isArray(data.names) ? data.names : [];
            const addList = document.getElementById('product-name-suggestions');
            const editList = document.getElementById('edit-product-name-suggestions');

            const optionsHtml = names.map((name) => `<option value="${this.escapeAttr(name)}"></option>`).join('');
            if (addList) addList.innerHTML = optionsHtml;
            if (editList) editList.innerHTML = optionsHtml;
        } catch (error) {
            console.error('Error loading product catalog names:', error);
        }
    }

    async loadCategories() {
        try {
            const response = await fetch(`${this.apiBase}/products/categories`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;

            const data = await response.json();
            const categories = Array.isArray(data.categories) ? data.categories : [];

            const renderOptions = (selected = '') => {
                return ['<option value="">Select category</option>']
                    .concat(categories.map((category) => {
                        const value = String(category.id);
                        const isSelected = String(selected) === value ? 'selected' : '';
                        return `<option value="${this.escapeAttr(value)}" ${isSelected}>${this.escapeHtml(category.name || 'Category')}</option>`;
                    }))
                    .join('');
            };

            const addSelect = document.getElementById('product-category');
            const editSelect = document.getElementById('edit-product-category');

            if (addSelect) addSelect.innerHTML = renderOptions(addSelect.value || '');
            if (editSelect) editSelect.innerHTML = renderOptions(editSelect.value || '');

            const defaultCategoryId = categories[0]?.id || '';
            if (addSelect && !addSelect.value) addSelect.value = String(defaultCategoryId || '');

            await this.loadProductCatalogNames(addSelect?.value || null);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    setupProductSuggestionListeners() {
        const addName = document.getElementById('product-name');
        const editName = document.getElementById('edit-product-name');
        const addCategory = document.getElementById('product-category');
        const editCategory = document.getElementById('edit-product-category');

        if (addName) {
            addName.addEventListener('change', () => this.updatePriceSuggestion('add'));
            addName.addEventListener('blur', () => this.updatePriceSuggestion('add'));
        }
        if (editName) {
            editName.addEventListener('change', () => this.updatePriceSuggestion('edit'));
            editName.addEventListener('blur', () => this.updatePriceSuggestion('edit'));
        }
        if (addCategory) addCategory.addEventListener('change', async () => {
            await this.loadProductCatalogNames(addCategory.value || null);
            this.updatePriceSuggestion('add');
        });
        if (editCategory) editCategory.addEventListener('change', async () => {
            await this.loadProductCatalogNames(editCategory.value || null);
            this.updatePriceSuggestion('edit');
        });
    }

    async submitCustomProductRequest() {
        const categoryId = String(document.getElementById('product-category')?.value || '').trim();
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
        const priceInput = document.getElementById(isEdit ? 'edit-product-price' : 'product-price');
        const hint = document.getElementById(isEdit ? 'edit-product-price-suggestion' : 'product-price-suggestion');

        if (!nameInput || !hint) return;

        const name = String(nameInput.value || '').trim();
        const categoryId = String(categoryInput?.value || '').trim();
        if (!name) {
            hint.textContent = 'Choose a catalog item to see suggested lowest and average selling price.';
            return;
        }

        try {
            hint.textContent = 'Checking suggested price...';
            const params = new URLSearchParams({ name });
            if (categoryId) params.set('category_id', categoryId);

            const response = await fetch(`${this.apiBase}/products/pricing/suggestion?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                hint.textContent = 'No pricing suggestion available yet for this product name.';
                return;
            }

            const data = await response.json();
            if (!data || !data.sample_count) {
                hint.textContent = 'No delivered sales history yet for this item. You can set your own introductory price.';
                return;
            }

            const lowest = Number(data.suggested_lowest_price || 0);
            const average = Number(data.average_price || 0);
            hint.textContent = `Suggested lowest: ${this.fmtCurrency(lowest)} • Market average: ${this.fmtCurrency(average)} • Based on ${this.fmtNumber(data.sample_count)} delivered sales.`;

            if (priceInput && (!priceInput.value || Number(priceInput.value) <= 0) && lowest > 0) {
                priceInput.value = lowest.toFixed(2);
            }
        } catch (error) {
            console.error('Error updating price suggestion:', error);
            hint.textContent = 'Unable to fetch pricing suggestion right now.';
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
            });
        });

        // Initial section based on saved state, hash, or default
        const validSections = new Set(['overview', 'products', 'orders', 'chat']);
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
                this.showMessage('Harvest Date cannot be in the past.', 'error');
                return false;
            }
        }

        // If expiry provided and harvest provided, expiry must be after harvest
        if (expiryVal && harvestVal) {
            if (expiryVal <= harvestVal) {
                this.setInputError(harvestEl, true);
                this.setInputError(expiryEl, true);
                this.showMessage('Expiry Date must be after the Harvest Date.', 'error');
                return false;
            }
        }

        // If expiry provided alone, require it be in the future
        if (expiryVal && !harvestVal) {
            if (expiryVal <= today) {
                this.setInputError(expiryEl, true);
                this.showMessage('Expiry Date must be in the future.', 'error');
                return false;
            }
        }

        return true;
    }

    showSection(section) {
        const validSections = new Set(['overview', 'products', 'orders', 'chat']);
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
            products: 'Products',
            orders: 'Orders',
            chat: 'Chat'
        };
        const titleEl = document.getElementById('farmer-page-title');
        if (titleEl) titleEl.textContent = titles[safeSection] || 'Overview';

        // Load data when switching to specific sections
        if (safeSection === 'orders') {
            this.loadMyOrders();
        } else if (safeSection === 'products') {
            this.loadMyProducts();
        } else if (safeSection === 'overview') {
            this.loadOverviewMetrics();
        } else if (safeSection === 'chat') {
            this.loadFarmerStats({ skipProducts: true });
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
                // Load my products count
                const productsResponse = await fetch(`${this.apiBase}/products/farmer/${this.farmerId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (productsResponse.ok) {
                    const productsData = await productsResponse.json();
                    const myProductsEl = document.getElementById('my-products');
                    if (myProductsEl) myProductsEl.textContent = this.fmtNumber(productsData.products.length);
                    const shopTotalProducts = document.getElementById('shop-total-products');
                    if (shopTotalProducts) {
                        shopTotalProducts.textContent = this.fmtNumber(productsData.products.length);
                    }
                }
            }

            // Load farmer stats
            const params = this.buildOverviewRangeSearchParams();
            const statsUrl = `${this.apiBase}/farmers/me/stats?${params.toString()}`;
            const statsResponse = await fetch(statsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                const totalOrdersEl = document.getElementById('total-orders');
                const totalSoldEl = document.getElementById('total-sold');
                const totalRevenueEl = document.getElementById('total-revenue');
                const unreadMessagesEl = document.getElementById('unread-messages');

                if (totalOrdersEl) totalOrdersEl.textContent = this.fmtNumber(stats.total_orders ?? 0);
                if (totalSoldEl) totalSoldEl.textContent = this.fmtNumber(stats.total_sold ?? 0);
                if (totalRevenueEl) totalRevenueEl.textContent = this.fmtCurrency(stats.total_revenue || 0);
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
        const editBtn = document.getElementById('edit-shop-profile-btn');
        const nameDisplay = document.getElementById('shop-name-display');
        const locDisplay = document.getElementById('shop-location-display');
        const descDisplay = document.getElementById('shop-description-display');

        if (editWrap) editWrap.style.display = this.isShopProfileEditing ? 'block' : 'none';
        if (editBtn) editBtn.style.display = this.isShopProfileEditing ? 'none' : 'inline-block';
        if (nameDisplay) nameDisplay.style.display = this.isShopProfileEditing ? 'none' : '';
        if (locDisplay) locDisplay.style.display = this.isShopProfileEditing ? 'none' : '';
        if (descDisplay) descDisplay.style.display = this.isShopProfileEditing ? 'none' : '';

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
        const shopLocationInput = document.getElementById('shop-location-input');
        const shopDescriptionInput = document.getElementById('shop-description-input');
        
        const payload = {};
        
        if (shopNameInput && shopNameInput.value.trim()) {
            payload.full_name = shopNameInput.value.trim();
        }
        
        if (shopLocationInput && shopLocationInput.value.trim()) {
            payload.address = shopLocationInput.value.trim();
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
            const response = await fetch(`${this.apiBase}/products/farmer/${this.farmerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.myProductsCache = Array.isArray(data.products) ? data.products : [];
                this.renderMyProducts(data.products);
                this.renderOverviewLowStock();
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

    showOverviewCustomPanel() {
        const panel = document.getElementById('overview-custom-panel');
        if (!panel) return;

        const fromInput = document.getElementById('overview-from');
        const toInput = document.getElementById('overview-to');

        // Prefill: keep previous custom selection if available, otherwise default to last 30 days.
        if (fromInput && !String(fromInput.value || '').trim()) {
            if (this.overviewCustomFrom) {
                fromInput.value = this.overviewCustomFrom;
            } else {
                const today = new Date();
                const start = new Date(today);
                start.setDate(start.getDate() - 29);
                fromInput.value = this.formatLocalDateInputValue(start);
            }
        }
        if (toInput && !String(toInput.value || '').trim()) {
            if (this.overviewCustomTo) {
                toInput.value = this.overviewCustomTo;
            } else {
                toInput.value = this.formatLocalDateInputValue(new Date());
            }
        }

        panel.style.display = 'block';
    }

    hideOverviewCustomPanel() {
        const panel = document.getElementById('overview-custom-panel');
        if (panel) panel.style.display = 'none';
    }

    buildOverviewRangeSearchParams() {
        const params = new URLSearchParams();
        if (this.overviewRangeMode === 'custom' && this.overviewCustomFrom && this.overviewCustomTo) {
            params.set('from', this.overviewCustomFrom);
            params.set('to', this.overviewCustomTo);
        } else {
            const rangeParam = this.overviewRangeMode === 'all' ? 'all' : String(this.overviewRangeDays);
            params.set('rangeDays', rangeParam);
        }
        return params;
    }

    setOverviewRange(range) {
        const value = String(range || '').trim().toLowerCase();

        if (value === 'custom') {
            this.showOverviewCustomPanel();
            return;
        }

        this.hideOverviewCustomPanel();
        this.overviewCustomFrom = null;
        this.overviewCustomTo = null;

        if (value === 'all') {
            this.overviewRangeMode = 'all';
        } else {
            const days = Number(value);
            if (!Number.isFinite(days) || days <= 0) return;
            this.overviewRangeMode = 'days';
            this.overviewRangeDays = days;
        }

        document.querySelectorAll('.overview-range-btn').forEach(b => {
            const r = String(b.getAttribute('data-range') || '').trim().toLowerCase();
            const isActive = (this.overviewRangeMode === 'all' && r === 'all')
                || (this.overviewRangeMode === 'days' && r === String(this.overviewRangeDays));
            b.classList.toggle('active', isActive);
        });

        this.loadOverviewMetrics({ force: true });
        this.loadFarmerStats({ skipProducts: true });
    }

    setOverviewCustomRange(from, to) {
        this.overviewRangeMode = 'custom';
        this.overviewCustomFrom = from;
        this.overviewCustomTo = to;
        this.hideOverviewCustomPanel();

        document.querySelectorAll('.overview-range-btn').forEach(b => {
            const r = String(b.getAttribute('data-range') || '').trim().toLowerCase();
            b.classList.toggle('active', r === 'custom');
        });

        this.loadOverviewMetrics({ force: true });
        this.loadFarmerStats({ skipProducts: true });
    }

    async loadOverviewMetrics({ force = false } = {}) {
        try {
            if (!this.token) return;
            if (!document.getElementById('overview-sales-chart')) return;

            const now = Date.now();
            if (!force && now - this.overviewLastFetchAt < 5000) return;
            if (this.overviewFetchInFlight) return this.overviewFetchInFlight;

            this.overviewLastFetchAt = now;
            const lastUpdatedEl = document.getElementById('overview-last-updated');
            if (lastUpdatedEl) lastUpdatedEl.textContent = 'Refreshing report…';

            const params = this.buildOverviewRangeSearchParams();
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
                    this.recentOrdersPage = 1;
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
            const rangeLabel = (metrics?.range === 'all')
                ? 'All time'
                : (metrics?.range === 'custom' && metrics?.from && metrics?.to)
                    ? `Custom: ${metrics.from} to ${metrics.to}`
                    : `Last ${metrics?.rangeDays || this.overviewRangeDays} days`;
            lastUpdatedEl.textContent = `${rangeLabel} • Updated: ${ts.toLocaleString()}`;
        }

        this.renderOverviewCharts(metrics);
        this.renderOverviewRecentOrders(metrics.recentOrders || []);
        this.renderOverviewTopProductsList(metrics.topProducts || []);
        this.renderOverviewDownloads();
        this.renderOverviewLowStock();
    }

    renderOverviewTopProductsList(topProducts) {
        const wrap = document.getElementById('overview-top-products-list');
        if (!wrap) return;

        const list = Array.isArray(topProducts) ? topProducts : [];
        if (list.length === 0) {
            wrap.innerHTML = '<div class="empty-state"><p>No sales yet.</p></div>';
            return;
        }

        wrap.innerHTML = list.map((p, idx) => {
            const sold = Number(p.sold_qty || 0);
            const revenue = this.fmtCurrency(p.revenue || 0);
            const searchText = `${p.product_name} ${sold} ${revenue}`.toLowerCase();
            return `
                <div class="overview-row" data-search-text="${this.escapeAttr(searchText)}">
                    <div class="overview-row-main">
                        <div class="overview-row-title">${idx + 1}. ${this.escapeHtml(p.product_name || 'Product')}</div>
                        <div class="overview-row-sub">Sold: ${this.fmtNumber(sold)}</div>
                    </div>
                    <div class="overview-row-meta">
                        <span class="overview-amount">${revenue}</span>
                    </div>
                </div>
            `;
        }).join('');
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
            const key = String(row.date).slice(0, 10);
            map.set(key, Number(row.revenue) || 0);
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
            const key = String(row.date).slice(0, 10);
            map.set(key, Number(row.revenue) || 0);
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

    renderOverviewCharts(metrics) {
        if (typeof Chart === 'undefined') return;

        // Sales (delivered) trend
        const salesCanvas = document.getElementById('overview-sales-chart');
        if (salesCanvas) {
            let labels = [];
            let values = [];
            if (metrics?.range === 'all') {
                const rows = Array.isArray(metrics.revenueByDay) ? metrics.revenueByDay : [];
                labels = rows.map(r => String(r.date).slice(0, 10));
                values = rows.map(r => Number(r.revenue) || 0);
            } else if (metrics?.range === 'custom' && metrics?.from && metrics?.to) {
                const filled = this.buildDateSpanLabels(metrics.revenueByDay, metrics.from, metrics.to);
                labels = filled.labels;
                values = filled.values;
            } else {
                const days = Number(metrics.rangeDays) || this.overviewRangeDays;
                const filled = this.buildLastNDaysLabels(metrics.revenueByDay, days);
                labels = filled.labels;
                values = filled.values;
            }
            const cfg = {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Revenue',
                        data: values,
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => this.fmtCurrency(ctx.parsed.y || 0)
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { maxTicksLimit: 6 } },
                        y: {
                            ticks: {
                                callback: (v) => this.fmtCurrency(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            }
                        }
                    }
                }
            };

            if (this.overviewCharts.sales) {
                this.overviewCharts.sales.data.labels = cfg.data.labels;
                this.overviewCharts.sales.data.datasets[0].data = cfg.data.datasets[0].data;
                this.overviewCharts.sales.update();
            } else {
                this.overviewCharts.sales = new Chart(salesCanvas, cfg);
            }
        }

        // Orders by status
        const statusCanvas = document.getElementById('overview-status-chart');
        if (statusCanvas) {
            const statusKeys = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
            const data = statusKeys.map(k => Number(metrics.ordersByStatus?.[k] || 0));
            const cfg = {
                type: 'doughnut',
                data: {
                    labels: statusKeys.map(k => this.formatStatusLabel(k)),
                    datasets: [{
                        data,
                        backgroundColor: statusKeys.map(k => this.getStatusColor(k))
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            };

            if (this.overviewCharts.status) {
                this.overviewCharts.status.data.labels = cfg.data.labels;
                this.overviewCharts.status.data.datasets[0].data = cfg.data.datasets[0].data;
                this.overviewCharts.status.update();
            } else {
                this.overviewCharts.status = new Chart(statusCanvas, cfg);
            }
        }

        // Top products (bar)
        const topCanvas = document.getElementById('overview-top-products-chart');
        if (topCanvas) {
            const top = Array.isArray(metrics.topProducts) ? metrics.topProducts : [];
            const labels = top.map(p => p.product_name);
            const values = top.map(p => Number(p.sold_qty || 0));
            const cfg = {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Sold Qty',
                        data: values
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { ticks: { maxRotation: 0, autoSkip: true } },
                        y: { beginAtZero: true }
                    }
                }
            };

            if (this.overviewCharts.topProducts) {
                this.overviewCharts.topProducts.data.labels = cfg.data.labels;
                this.overviewCharts.topProducts.data.datasets[0].data = cfg.data.datasets[0].data;
                this.overviewCharts.topProducts.update();
            } else {
                this.overviewCharts.topProducts = new Chart(topCanvas, cfg);
            }
        }
    }

    renderOverviewRecentOrders(orders) {
        const wrap = document.getElementById('overview-recent-orders');
        if (!wrap) return;

        const list = Array.isArray(orders) ? orders : [];
        this.overviewRecentOrdersCache = list;

        const totalPages = Math.max(1, Math.ceil(list.length / this.recentOrdersPerPage));
        this.recentOrdersPage = Math.min(Math.max(1, Number(this.recentOrdersPage || 1)), totalPages);

        const pageLabel = document.getElementById('overview-recent-page');
        if (pageLabel) pageLabel.textContent = `${this.recentOrdersPage}/${totalPages}`;

        const prevBtn = document.getElementById('overview-recent-prev');
        if (prevBtn) prevBtn.disabled = this.recentOrdersPage <= 1;
        const nextBtn = document.getElementById('overview-recent-next');
        if (nextBtn) nextBtn.disabled = this.recentOrdersPage >= totalPages;

        if (list.length === 0) {
            wrap.innerHTML = '<div class="empty-state"><p>No recent orders.</p></div>';
            return;
        }

        const start = (this.recentOrdersPage - 1) * this.recentOrdersPerPage;
        const pageItems = list.slice(start, start + this.recentOrdersPerPage);

        wrap.innerHTML = pageItems.map(o => {
            const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : '';
            const amount = this.fmtCurrency(o.total_amount || 0);
            const status = this.formatStatusLabel(o.status);
            const searchText = `${o.id} ${o.customer_name || ''} ${o.product_name || ''} ${status}`.toLowerCase();
            return `
                <div class="overview-row" data-search-text="${this.escapeAttr(searchText)}">
                    <div class="overview-row-main">
                        <div class="overview-row-title">#${o.id} • ${this.escapeHtml(o.product_name || 'Product')}</div>
                        <div class="overview-row-sub">${this.escapeHtml(o.customer_name || 'Customer')} • ${date}</div>
                    </div>
                    <div class="overview-row-meta">
                        <span class="overview-pill" data-status="${this.escapeAttr(o.status)}">${status}</span>
                        <span class="overview-amount">${amount}</span>
                    </div>
                </div>
            `;
        }).join('');
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

    getDownloadsKey() {
        return `farmerOverviewDownloads:${this.userId || 'me'}`;
    }

    readDownloads() {
        try {
            const raw = localStorage.getItem(this.getDownloadsKey());
            const arr = JSON.parse(raw || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            return [];
        }
    }

    writeDownloads(items) {
        try {
            localStorage.setItem(this.getDownloadsKey(), JSON.stringify(items.slice(0, 10)));
        } catch (_) {
            // ignore
        }
    }

    renderOverviewDownloads() {
        const wrap = document.getElementById('overview-downloads');
        if (!wrap) return;
        const items = this.readDownloads();
        if (items.length === 0) {
            wrap.innerHTML = '<div class="empty-state"><p>No downloads yet.</p></div>';
            return;
        }

        wrap.innerHTML = items.map(it => {
            const when = it.ts ? new Date(it.ts).toLocaleString() : '';
            const searchText = `${it.name || ''} ${when}`.toLowerCase();
            return `
                <div class="overview-row" data-search-text="${this.escapeAttr(searchText)}">
                    <div class="overview-row-main">
                        <div class="overview-row-title">${this.escapeHtml(it.name || 'report.csv')}</div>
                        <div class="overview-row-sub">${this.escapeHtml(when)}</div>
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

    async exportOverviewCsv() {
        try {
            const btn = document.getElementById('overview-export-csv-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting…';
            }

            const params = this.buildOverviewRangeSearchParams();
            const url = `${this.apiBase}/farmers/me/metrics/export.csv?${params.toString()}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || 'Export failed');
            }

            const blob = await res.blob();
            const fallbackSuffix = this.overviewRangeMode === 'custom'
                ? `${this.overviewCustomFrom || 'from'}_to_${this.overviewCustomTo || 'to'}`
                : (this.overviewRangeMode === 'all' ? 'all' : `${this.overviewRangeDays}d`);
            const filename = this.parseFilenameFromDisposition(res.headers.get('Content-Disposition'))
                || `farmer_overview_${new Date().toISOString().slice(0, 10)}_${fallbackSuffix}.csv`;

            const urlObj = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlObj;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(urlObj);

            const items = [{ name: filename, ts: Date.now() }, ...this.readDownloads()]
                .filter((v, idx, arr) => arr.findIndex(x => x.name === v.name && x.ts === v.ts) === idx);
            this.writeDownloads(items);
            this.renderOverviewDownloads();

            this.showMessage('Export downloaded!', 'success');
        } catch (error) {
            console.error('Export CSV error:', error);
            this.showMessage(error.message || 'Export failed', 'error');
        } finally {
            const btn = document.getElementById('overview-export-csv-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-file-arrow-down"></i> Export CSV';
            }
        }
    }

    renderMyProducts(products) {
        const container = document.getElementById('my-products-grid');

        if (products.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>You haven\'t added any products yet.</p><p>Add your first product in the "Add Product" tab!</p></div>';
            return;
        }

        container.innerHTML = products.map(product => {
            const stock = Number(product.stock_quantity ?? 0);
            const isAvailable = (product.is_available === true || product.is_available === 't' || product.is_available === 'true' || product.is_available === 1 || product.is_available === '1');
            const status = !isAvailable ? 'disabled' : (stock <= 0 ? 'no_stock' : 'available');
            const displayStatus = isAvailable ? 'Available' : 'Disabled';
            const toggleLabel = isAvailable ? 'Disable' : 'Enable';
            const toggleArg = !isAvailable;
            return `
            <div class="product-card" data-status="${status}" data-stock-quantity="${stock}">
                <img src="${product.image_url || '/images/logo.png'}"
                     alt="${product.name}" class="product-image" onerror="this.src='/images/logo.png'">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price">${this.fmtCurrency(product.price)} per ${product.unit}</div>
                    <div class="product-details">
                        <span class="product-status">${displayStatus}</span> |
                        Stock: ${product.stock_quantity}
                    </div>
                    <div class="product-actions">
                        <button onclick="farmerDashboard.editProduct(${product.id})" class="btn btn-small">Edit</button>
                        <button onclick="farmerDashboard.toggleProductStatus(${product.id}, ${toggleArg})" class="btn btn-small">
                            ${toggleLabel}
                        </button>
                        <button onclick="farmerDashboard.deleteProduct(${product.id})" class="btn btn-small btn-danger">Delete</button>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Apply current filters after re-render
        this.filterProducts();
    }

    async handleAddProduct(e) {
        e.preventDefault();

        const name = document.getElementById('product-name').value;
        const description = document.getElementById('product-description').value;
        const price = document.getElementById('product-price').value;
        const category_id = document.getElementById('product-category').value;
        const stock_quantity = document.getElementById('product-stock').value;
        const unit = document.getElementById('product-unit').value;
        const location = document.getElementById('product-location').value;
        const harvestDate = document.getElementById('harvest-date').value;
        const expiryDate = document.getElementById('expiry-date').value;

        if (!this.validateProductDates({
            harvestEl: document.getElementById('harvest-date'),
            expiryEl: document.getElementById('expiry-date')
        })) {
            return;
        }

        // Handle image upload to Cloudinary
        let imageUrl = '';
        const imageFile = document.getElementById('product-image').files[0];
        if (imageFile) {
            const cloudData = new FormData();
            cloudData.append('file', imageFile);
            cloudData.append('upload_preset', 'agricatch');
            cloudData.append('folder', 'products');
            try {
                const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dwv7lhgvm/image/upload', {
                    method: 'POST',
                    body: cloudData
                });
                const cloudJson = await cloudRes.json();
                if (cloudJson.secure_url) {
                    imageUrl = cloudJson.secure_url;
                } else {
                    this.showMessage('Image upload failed: ' + (cloudJson.error?.message || 'Unknown error'), 'error');
                    return;
                }
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
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to add product', 'error');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showMessage('Error adding product', 'error');
        }
    }

    async handleEditProduct(e) {
        e.preventDefault();

        const productId = document.getElementById('edit-product-id').value;
        if (!productId) {
            this.showMessage('Missing product ID', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('name', document.getElementById('edit-product-name').value);
        formData.append('description', document.getElementById('edit-product-description').value);
        formData.append('price', document.getElementById('edit-product-price').value);
        formData.append('category_id', document.getElementById('edit-product-category').value);
        formData.append('stock_quantity', document.getElementById('edit-product-stock').value);
        formData.append('unit', document.getElementById('edit-product-unit').value);
        formData.append('location', document.getElementById('edit-product-location').value);

        const harvestDate = document.getElementById('edit-harvest-date').value;
        const expiryDate = document.getElementById('edit-expiry-date').value;

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
            formData.append('image', imageFile);
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
                this.closeEditModal();
                this.loadMyProducts();
                this.loadFarmerStats();
            } else {
                this.showMessage(data.message || 'Failed to update product', 'error');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showMessage('Error updating product', 'error');
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
        if (!confirm('Are you sure you want to delete this product?')) {
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
                this.showMessage('Product deleted successfully!', 'success');
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
                document.getElementById('edit-product-category').value = product.category_id;
                document.getElementById('edit-product-unit').value = product.unit;
                document.getElementById('edit-product-stock').value = product.stock_quantity;
                document.getElementById('edit-product-description').value = product.description || '';
                document.getElementById('edit-product-location').value = product.location || '';
                
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
                if (product.image_url) {
                    preview.innerHTML = `<img src="${product.image_url}" alt="Current product image" style="max-width: 200px; margin-top: 10px;">`;
                }

                // Show modal
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

    closeEditModal() {
        document.getElementById('edit-product-modal').classList.remove('open');
        document.getElementById('edit-product-form').reset();
        document.getElementById('edit-product-image-preview').innerHTML = '';
    }

    switchTab(tabName) {
        // Product tabs only (avoid touching order tabs)
        document.querySelectorAll('[data-tab-scope="products"].tab-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.product-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));

        // Show selected tab
        document.getElementById(`${tabName}-section`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    filterProducts() {
        const searchTerm = (document.getElementById('farmer-search-input')?.value || '').toLowerCase().trim();
        const statusFilter = document.getElementById('product-status-filter')?.value || 'available';

        const productCards = document.querySelectorAll('#my-products-grid .product-card');

        productCards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            const cardStatus = String(card.getAttribute('data-status') || '').toLowerCase();
            const stockQty = Number(card.getAttribute('data-stock-quantity') || 0);

            const matchesSearch = !searchTerm || name.includes(searchTerm);
            const matchesStatus = (
                                (statusFilter === 'available' && cardStatus === 'available') ||
                                (statusFilter === 'no_stock' && cardStatus === 'no_stock') ||
                                (statusFilter === 'disabled' && cardStatus === 'disabled')
                                );

            if (matchesSearch && matchesStatus) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    openAccountPanel() {
        const profile = this.currentShopProfile || {};
        const fallbackUser = this.authProfile || {};

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
                <h4 style="margin:0 0 10px 0;">Shop Profile</h4>
                <form id="account-shop-form" class="product-form">
                    <div class="form-group">
                        <label for="shop-name-input">Farm Name</label>
                        <input type="text" id="shop-name-input" class="editable-field" value="${this.escapeAttr(name)}" placeholder="My Farm Shop">
                    </div>
                    <div class="form-group">
                        <label for="shop-location-input"><i class="fas fa-location-dot"></i> Farm Location</label>
                        <input type="text" id="shop-location-input" class="editable-field" value="${this.escapeAttr(location)}" placeholder="Farm location not set">
                    </div>
                    <div class="form-group">
                        <label for="shop-description-input">Farm Description</label>
                        <textarea id="shop-description-input" class="editable-field" rows="3" placeholder="Add a short description about your farm and products.">${this.escapeHtml(desc)}</textarea>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button type="submit" class="btn btn-primary btn-small">Save Shop Profile</button>
                    </div>
                </form>
            </div>

            <div class="panel-section">
                <h4 style="margin:0 0 10px 0;">Change Password</h4>
                <form id="account-password-form" class="product-form">
                    <div class="form-group">
                        <label for="account-current-password">Current Password</label>
                        <input type="password" id="account-current-password" class="editable-field" autocomplete="current-password" required>
                    </div>
                    <div class="form-group">
                        <label for="account-new-password">New Password</label>
                        <input type="password" id="account-new-password" class="editable-field" autocomplete="new-password" required>
                    </div>
                    <div class="form-group">
                        <label for="account-confirm-password">Confirm New Password</label>
                        <input type="password" id="account-confirm-password" class="editable-field" autocomplete="new-password" required>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button type="submit" class="btn btn-primary btn-small">Update Password</button>
                    </div>
                </form>
            </div>
        `;

        this.openDetailPanel(html);

        document.getElementById('account-shop-form')?.addEventListener('submit', (e) => this.handleShopProfileUpdate(e));
        document.getElementById('account-password-form')?.addEventListener('submit', (e) => this.handleChangePassword(e));
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
                const err = await response.json().catch(() => ({}));
                this.showMessage(err.message || 'Failed to update password', 'error');
            }
        } catch (error) {
            console.error('Change password error:', error);
            this.showMessage('Error updating password', 'error');
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
                this.renderOrders(data.orders || [], status);
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

        // Load orders for this status unless we're skipping (e.g., already loaded)
        if (!skipLoad) {
            this.loadOrdersByStatus(status);
        }
    }

    renderOrders(orders, status) {
        // Index orders for detail panel usage
        this.lastOrdersByStatus[status] = Array.isArray(orders) ? orders : [];
        this.lastOrdersByStatus[status].forEach(o => this.lastOrdersById.set(Number(o.id), o));

        const containerId = `${status}-orders-list`;
        const container = document.getElementById(containerId);

        if (orders.length === 0) {
            const statusLabel = this.formatStatusLabel(status);
            container.innerHTML = `<div class="empty-state"><p>No ${statusLabel} orders found.</p></div>`;
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
            const productImage = item.image_url || order.product_image || '/images/logo.png';
            const productName = item.product_name || order.product_name || 'Product';
            const quantity = item.quantity || order.quantity || 1;
            const price = item.price || order.price || 0;
            const totalAmount = item.total_amount || order.total_amount || 0;
            const orderId = Number(order.id);
            
            return `
            <div class="order-card" data-order-id="${orderId}" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; background: #fff;">
                <div class="order-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span class="order-id" style="font-weight: 700; font-size: 16px;">Order #${orderId}</span>
                    <span class="order-date" style="color: #64748b; font-size: 14px;">${new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                
                <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                    <img src="${this.escapeAttr(productImage)}" alt="${this.escapeHtml(productName)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" onerror="this.src='/images/logo.png'">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px;">${this.escapeHtml(productName)}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Customer:</strong> ${this.escapeHtml(order.customer_name || '—')}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Quantity:</strong> ${this.fmtNumber(quantity)} x ${this.fmtCurrency(price)} ${item.unit || order.unit || ''}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Total:</strong> ${this.fmtCurrency(totalAmount)}</div>
                        <div style="color: #64748b; font-size: 14px;"><strong>Status:</strong> <span style="font-weight: 600; color: ${this.getStatusColor(currentStatus)};">${this.escapeHtml(this.formatStatusLabel(currentStatus))}</span></div>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                    <div style="font-weight: 700; margin-bottom: 12px; font-size: 14px;">Update Order Status</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${currentStatus === 'pending' ? `
                            <button class="btn btn-primary btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="confirmed">Confirm Order</button>
                            <button class="btn btn-danger btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="cancelled">Cancel</button>
                        ` : currentStatus === 'confirmed' ? `
                            <button class="btn btn-primary btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="preparing">Start Preparing</button>
                            <button class="btn btn-danger btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="cancelled">Cancel</button>
                        ` : currentStatus === 'preparing' ? `
                            <button class="btn btn-primary btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="out_for_delivery">Out for Delivery</button>
                            <button class="btn btn-danger btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="cancelled">Cancel</button>
                        ` : currentStatus === 'out_for_delivery' ? `
                            <button class="btn btn-primary btn-small" type="button" data-action="item-status" data-order-id="${orderId}" data-order-item-id="${orderId}" data-status="delivered">Mark as Delivered</button>
                        ` : currentStatus === 'delivered' ? `
                            <span style="color: #4caf50; font-weight: 600;">✓ Order Delivered</span>
                        ` : currentStatus === 'cancelled' ? `
                            <span style="color: #f44336; font-weight: 600;">✗ Order Cancelled</span>
                        ` : ''}
                    </div>
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-small" type="button" data-action="chat-customer" data-customer-id="${order.customer_id || ''}" data-order-id="${orderId}">Chat Customer</button>
                </div>
            </div>
        `;
        }).join('');
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
            return;
        }

        if (this.activeSection === 'orders') {
            document.querySelectorAll('.orders-list .order-card').forEach(card => {
                const text = (card.textContent || '').toLowerCase();
                card.style.display = text.includes(q) ? '' : 'none';
            });
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
                this.showMessage(`Order status updated to ${newStatus}!`, 'success');
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