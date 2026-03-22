// Farmer Dashboard JavaScript

class FarmerDashboard {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        if (this.token) {
            localStorage.setItem('token', this.token);
        } else {
            localStorage.removeItem('token');
        }
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
        this.catalogProductNames = [];
        this.ordersSearchActiveIndex = -1;
        this.productNameActiveIndex = { add: -1, edit: -1 };

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();
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

    init() {
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
        this.showDeniedBanner();
        this.checkFarmerAuth();
        this.setupEventListeners();
        this.setupRequestModal();
        this.loadCategories();
        this.loadProductCatalogNames();
        this.setupProductSuggestionListeners();
        this.setupSidebarNavigation();
        this.setupDetailPanel();
        this.setupRealtime();
        this.initChat();
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
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeRequestModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeRequestModal());
        if (overlay) overlay.addEventListener('click', () => this.closeRequestModal());

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
            await this.loadRequestCategories();
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

    async loadRequestCategories() {
        try {
            const res = await fetch(`${this.apiBase}/products/categories`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const categories = Array.isArray(data.categories) ? data.categories : [];
            const categoryEl = document.getElementById('request-product-category');
            const newCategoryToggle = document.getElementById('request-new-category-toggle');
            const newCategoryInput = document.getElementById('request-new-category-name');
            if (!categoryEl) return;
            categoryEl.innerHTML = ['<option value="">Select category</option>']
                .concat(categories.map((c) => `<option value="${String(c.id)}">${this.escapeAttr(c.name)}</option>`))
                .join('');

            const setNewCategoryActive = (active) => {
                if (!newCategoryToggle) return;
                newCategoryToggle.classList.toggle('active', !!active);
                newCategoryToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
            };
            const isNewCategoryActive = () => !!newCategoryToggle?.classList.contains('active');

            setNewCategoryActive(false);
            if (newCategoryInput) {
                newCategoryInput.value = '';
                newCategoryInput.style.display = 'none';
            }

            const syncRequestCategoryState = () => {
                const nameEl = document.getElementById('request-product-name');
                if (!nameEl) return;
                const has = !!String(categoryEl.value || '').trim();
                const typedNewCategory = !!String(newCategoryInput?.value || '').trim();
                const isRequestingNewCategory = isNewCategoryActive() || typedNewCategory;
                if (typedNewCategory && newCategoryToggle && !isNewCategoryActive()) {
                    setNewCategoryActive(true);
                }
                nameEl.disabled = !(has || isRequestingNewCategory);
                if (!has && !isRequestingNewCategory) nameEl.placeholder = 'Choose category first';
                else nameEl.placeholder = 'Enter requested product name';
                categoryEl.disabled = isRequestingNewCategory;
                if (newCategoryInput) newCategoryInput.style.display = isRequestingNewCategory ? '' : 'none';
            };

            categoryEl.onchange = syncRequestCategoryState;
            if (newCategoryToggle) {
                newCategoryToggle.onclick = (e) => {
                    e.preventDefault();
                    setNewCategoryActive(!isNewCategoryActive());
                    if (!isNewCategoryActive() && newCategoryInput) newCategoryInput.value = '';
                    syncRequestCategoryState();
                };
            }
            if (newCategoryInput) newCategoryInput.oninput = syncRequestCategoryState;
            syncRequestCategoryState();
        } catch (e) {
            console.error('Load request categories error:', e);
        }
    }

    async handleSubmitRequestForm(e) {
        try {
            e.preventDefault();
            const categoryEl = document.getElementById('request-product-category');
            const nameEl = document.getElementById('request-product-name');
            const notesEl = document.getElementById('request-product-notes');
            const newCategoryToggle = document.getElementById('request-new-category-toggle');
            const newCategoryNameEl = document.getElementById('request-new-category-name');
            if (!categoryEl || !nameEl) return;
            const categoryId = String(categoryEl.value || '').trim();
            const name = String(nameEl.value || '').trim();
            const notes = String(notesEl?.value || '').trim();
            const requestedCategoryName = String(newCategoryNameEl?.value || '').trim();
            const isRequestingNewCategory = !!newCategoryToggle?.classList.contains('active') || !!requestedCategoryName;
            if (!categoryId && !isRequestingNewCategory) return this.showMessage('Please choose a category.', 'error');
            if (isRequestingNewCategory && !requestedCategoryName) return this.showMessage('Please enter the new category name.', 'error');
            if (!name) return this.showMessage('Please enter the product name.', 'error');

            const res = await fetch(`${this.apiBase}/products/category-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
                body: JSON.stringify({
                    category_id: categoryId ? Number(categoryId) : null,
                    requested_category_name: isRequestingNewCategory ? requestedCategoryName : null,
                    name,
                    notes
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return this.showMessage(data.message || 'Unable to submit request', 'error');
            this.showMessage('Request submitted for staff approval.', 'success');
            // reset
            (document.getElementById('request-product-form-modal') || {}).reset?.();
            await this.loadRequestCategories();
            await this.loadRequestHistory();
        } catch (err) {
            console.error('Submit request error:', err);
            this.showMessage('Unable to submit request right now.', 'error');
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
                    const when = new Date(r.created_at).toLocaleString();
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

        const productsSearchInput = document.getElementById('products-search-input');
        if (productsSearchInput) {
            productsSearchInput.addEventListener('input', () => this.filterProducts());
        }

        const ordersSearchInput = document.getElementById('orders-search-input');
        if (ordersSearchInput) {
            ordersSearchInput.addEventListener('input', () => {
                this.applyOrdersSearch();
                this.renderOrdersSearchDropdown();
            });
            ordersSearchInput.addEventListener('focus', () => this.renderOrdersSearchDropdown());
            ordersSearchInput.addEventListener('keydown', (e) => this.handleOrdersSearchKeydown(e));
            ordersSearchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    const drop = document.getElementById('orders-search-dropdown');
                    if (drop) drop.classList.remove('open');
                }, 120);
            });
        }

        const exportBtn = document.getElementById('overview-export-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportOverviewCsv());
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

        const overviewRangeSelect = document.getElementById('overview-range-select');
        if (overviewRangeSelect) {
            overviewRangeSelect.addEventListener('change', () => {
                this.setOverviewRange(overviewRangeSelect.value);
            });
        }

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
        document.getElementById('add-product-tab')?.addEventListener('click', () => {
            this.switchTab('add-product');
        });

        // Order status tabs - all 6 statuses
        document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
        document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
        document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
        document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));

        // Product filters
        document.querySelectorAll('input[name="product-status-filter"]').forEach((radio) => {
            radio.addEventListener('change', () => this.filterProducts());
        });
        document.getElementById('product-category-filter')?.addEventListener('change', () => this.filterProducts());
        document.getElementById('product-sort-select')?.addEventListener('change', () => this.filterProducts());
        
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

        const previewModal = document.getElementById('farmer-product-preview-modal');
        const previewCloseBtn = document.getElementById('farmer-product-preview-close');
        const previewOverlay = previewModal?.querySelector('.product-details-overlay');
        if (previewCloseBtn) previewCloseBtn.addEventListener('click', () => this.closeMyProductPreview());
        if (previewOverlay) previewOverlay.addEventListener('click', () => this.closeMyProductPreview());

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
            const fetchNames = async (targetCategoryId = null) => {
                const params = new URLSearchParams();
                if (targetCategoryId) params.set('category_id', String(targetCategoryId));
                const response = await fetch(`${this.apiBase}/products/catalog/names${params.toString() ? `?${params.toString()}` : ''}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
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

        listEl.innerHTML = matches.map((name) => (
            `<button type="button" class="product-name-option" data-name="${this.escapeAttr(name)}">${this.escapeHtml(name)}</button>`
        )).join('');
        listEl.classList.add('open');
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
            await this.loadProductCatalogNames(addSelect?.value || null);
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

        const hasCategory = !!String(categoryInput?.value || '').trim();
        nameInput.disabled = !hasCategory;
        if (!hasCategory) {
            nameInput.value = '';
            nameInput.placeholder = 'Choose category first';
            if (hint) hint.textContent = 'Suggested lowest price: —';
            this.renderProductNameSuggestions(mode);
            return;
        }

        nameInput.placeholder = 'Select product name';
        this.renderProductNameSuggestions(mode);
    }

    setupProductSuggestionListeners() {
        const addName = document.getElementById('product-name');
        const editName = document.getElementById('edit-product-name');
        const addCategory = document.getElementById('product-category');
        const editCategory = document.getElementById('edit-product-category');

        if (addName) {
            addName.addEventListener('change', () => this.updatePriceSuggestion('add'));
            addName.addEventListener('blur', () => this.updatePriceSuggestion('add'));
            addName.addEventListener('input', () => this.renderProductNameSuggestions('add'));
            addName.addEventListener('focus', () => this.renderProductNameSuggestions('add', true));
            addName.addEventListener('keydown', (e) => this.handleProductNameKeydown('add', e));
            addName.addEventListener('blur', () => setTimeout(() => {
                const list = document.getElementById('product-name-suggestions');
                if (list) list.classList.remove('open');
            }, 120));
        }
        if (editName) {
            editName.addEventListener('change', () => this.updatePriceSuggestion('edit'));
            editName.addEventListener('blur', () => this.updatePriceSuggestion('edit'));
            editName.addEventListener('input', () => this.renderProductNameSuggestions('edit'));
            editName.addEventListener('focus', () => this.renderProductNameSuggestions('edit', true));
            editName.addEventListener('keydown', (e) => this.handleProductNameKeydown('edit', e));
            editName.addEventListener('blur', () => setTimeout(() => {
                const list = document.getElementById('edit-product-name-suggestions');
                if (list) list.classList.remove('open');
            }, 120));
        }
        if (addCategory) addCategory.addEventListener('change', async () => {
            this.syncProductNameAvailability('add');
            await this.loadProductCatalogNames(addCategory.value || null);
            this.updatePriceSuggestion('add');
        });
        if (editCategory) editCategory.addEventListener('change', async () => {
            this.syncProductNameAvailability('edit');
            await this.loadProductCatalogNames(editCategory.value || null);
            this.updatePriceSuggestion('edit');
        });

        const addPrice = document.getElementById('product-price');
        if (addPrice) addPrice.addEventListener('focus', () => this.updatePriceSuggestion('add'));

        const editPrice = document.getElementById('edit-product-price');
        if (editPrice) editPrice.addEventListener('focus', () => this.updatePriceSuggestion('edit'));

        this.syncProductNameAvailability('add');
        this.syncProductNameAvailability('edit');
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
            hint.textContent = 'Suggested lowest price: —';
            return;
        }

        try {
            hint.textContent = 'Suggested lowest price: checking...';
            const params = new URLSearchParams({ name });
            if (categoryId) params.set('category_id', categoryId);

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
            this.switchTab('list-products');
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

        const select = document.getElementById('overview-range-select');
        if (select) {
            select.value = this.overviewRangeMode === 'all' ? 'all' : String(this.overviewRangeDays);
        }

        this.loadOverviewMetrics({ force: true });
    }

    setOverviewCustomRange(from, to) {
        this.overviewRangeMode = 'custom';
        this.overviewCustomFrom = from;
        this.overviewCustomTo = to;
        this.hideOverviewCustomPanel();

        const select = document.getElementById('overview-range-select');
        if (select) select.value = 'custom';

        this.loadOverviewMetrics({ force: true });
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

        const statusKeys = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        const totalOrders = statusKeys.reduce((sum, key) => sum + Number(metrics?.ordersByStatus?.[key] || 0), 0);
        const totalSold = Number(metrics?.ordersByStatus?.delivered || 0);
        const totalRevenue = (Array.isArray(metrics?.revenueByDay)
            ? metrics.revenueByDay.reduce((sum, row) => sum + Number(row?.revenue || 0), 0)
            : 0);

        const totalOrdersEl = document.getElementById('total-orders');
        const totalSoldEl = document.getElementById('total-sold');
        const totalRevenueEl = document.getElementById('total-revenue');
        if (totalOrdersEl) totalOrdersEl.textContent = this.fmtNumber(totalOrders);
        if (totalSoldEl) totalSoldEl.textContent = this.fmtNumber(totalSold);
        if (totalRevenueEl) totalRevenueEl.textContent = this.fmtCurrency(totalRevenue);
    }

    renderOverviewTopProductsList(topProducts) {
        const wrap = document.getElementById('overview-top-products-list');
        if (!wrap) return;

        const list = (Array.isArray(topProducts) ? topProducts : [])
            .slice()
            .sort((a, b) => {
                const soldDiff = Number(b.sold_qty || 0) - Number(a.sold_qty || 0);
                if (soldDiff !== 0) return soldDiff;
                return Number(b.revenue || 0) - Number(a.revenue || 0);
            });
        if (list.length === 0) {
            wrap.innerHTML = '<div class="empty-state"><p>No sales yet.</p></div>';
            return;
        }

        wrap.innerHTML = list.map((p, idx) => {
            const sold = Number(p.sold_qty || 0);
            const totalSales = Number(p.total_sales || p.order_count || 0);
            const revenue = this.fmtCurrency(p.revenue || 0);
            const averagePrice = sold > 0 ? this.fmtCurrency((Number(p.revenue || 0) / sold) || 0) : this.fmtCurrency(0);
            const searchText = `${p.product_name} ${sold} ${totalSales} ${revenue} ${averagePrice}`.toLowerCase();
            return `
                <div class="overview-row" data-search-text="${this.escapeAttr(searchText)}">
                    <div class="overview-row-main">
                        <div class="overview-row-title">${idx + 1}. ${this.escapeHtml(p.product_name || 'Product')}</div>
                        <div class="overview-row-sub">Items Sold: ${this.fmtNumber(sold)} • Total Sales: ${this.fmtNumber(totalSales)}</div>
                    </div>
                    <div class="overview-row-meta">
                        <span class="overview-amount">${revenue}</span>
                        <span class="overview-pill">Avg: ${averagePrice}</span>
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

    renderOverviewCharts(metrics) {
        if (typeof Chart === 'undefined') return;

        // Sales (delivered) trend
        const salesCanvas = document.getElementById('overview-sales-chart');
        if (salesCanvas) {
            let labels = [];
            let values = [];
            if (metrics?.range === 'all') {
                const rows = Array.isArray(metrics.revenueByDay) ? metrics.revenueByDay : [];
                const parsedRows = rows
                    .map((row) => ({ key: this.normalizeDateKey(row?.date), revenue: Number(row?.revenue) || 0 }))
                    .filter((row) => !!row.key);
                labels = parsedRows.map((row) => row.key);
                values = parsedRows.map((row) => row.revenue);
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
                        label: 'Sales',
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
            const top = (Array.isArray(metrics.topProducts) ? metrics.topProducts : [])
                .slice()
                .sort((a, b) => {
                    const soldDiff = Number(b.sold_qty || 0) - Number(a.sold_qty || 0);
                    if (soldDiff !== 0) return soldDiff;
                    return Number(b.revenue || 0) - Number(a.revenue || 0);
                });
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
            const displayStatus = !isAvailable ? 'Disabled' : (stock <= 0 ? 'No Stock' : 'Available');
            const reviewCount = Number(product.total_reviews || 0);
            const avgRating = this.fmtNumber(product.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            const categoryName = String(product.category_name || '').trim();
            return `
            <div class="product-card" data-status="${status}" data-stock-quantity="${stock}" data-category="${this.escapeAttr(categoryName)}" data-price="${Number(product.price || 0)}" data-rating="${Number(product.average_rating || 0)}" data-reviews="${reviewCount}" data-created-at="${this.escapeAttr(product.created_at || '')}" onclick="farmerDashboard.openMyProductPreview(${product.id})" style="cursor:pointer;">
                <img src="${product.image_url || '/images/logo.png'}"
                     alt="${product.name}" class="product-image" onerror="this.src='/images/logo.png'">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price">${this.fmtCurrency(product.price)} per ${product.unit}</div>
                    <div class="product-details">
                        <span class="product-status">${displayStatus}</span> |
                        Stock: ${product.stock_quantity}
                    </div>
                    <div class="product-meta product-card-summary">
                        <span>Reviews: ${this.fmtNumber(reviewCount)} • ${avgRating}★</span>
                    </div>
                    <div class="product-card-click-hint" aria-hidden="true">Click card to view details</div>
                </div>
            </div>
        `;
        }).join('');

        this.refreshProductCategoryFilterOptions(products);

        // Apply current filters after re-render
        this.filterProducts();
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
        const harvestDate = product.harvest_date ? new Date(product.harvest_date).toLocaleDateString() : 'Not specified';
        const expiryDate = product.expiry_date ? new Date(product.expiry_date).toLocaleDateString() : 'Not specified';
        const reviewCount = this.fmtNumber(product.total_reviews || 0);
        const avgRating = this.fmtNumber(product.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        const body = document.getElementById('farmer-product-preview-body');
        const modal = document.getElementById('farmer-product-preview-modal');
        if (!(body && modal)) return;

        body.innerHTML = `
            <div class="farmer-product-preview-grid" style="display:grid;grid-template-columns:minmax(220px,320px) 1fr;gap:1.15rem;align-items:start;">
                <img src="${this.escapeAttr(product.image_url || '/images/logo.png')}" alt="${this.escapeAttr(product.name)}" style="width:100%;max-width:260px;border-radius:12px;border:1px solid #e2e8f0;object-fit:cover;" onerror="this.src='/images/logo.png'">
                <div>
                    <h3 style="margin:0 0 0.5rem 0;">${this.escapeHtml(product.name)}</h3>
                    <div style="font-weight:700;color:var(--primary-color);margin-bottom:0.5rem;">${this.fmtCurrency(product.price)} per ${this.escapeHtml(product.unit || 'item')}</div>
                    <div style="display:grid;gap:0.45rem;color:var(--text-secondary);line-height:1.5;">
                        <div><strong>Status:</strong> ${this.escapeHtml(status)}</div>
                        <div><strong>Stock:</strong> ${this.fmtNumber(product.stock_quantity || 0)}</div>
                        <div><strong>Harvest Date:</strong> ${this.escapeHtml(harvestDate)}</div>
                        <div><strong>Expiry Date:</strong> ${this.escapeHtml(expiryDate)}</div>
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
                    // include public_id so backend can store it for safe deletions
                    var imagePublicId = cloudJson.public_id;
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
        const searchTerm = (document.getElementById('products-search-input')?.value || '').toLowerCase().trim();
        const statusFilter = document.querySelector('input[name="product-status-filter"]:checked')?.value || 'all';
        const categoryFilter = (document.getElementById('product-category-filter')?.value || '').toLowerCase().trim();

        const productCards = document.querySelectorAll('#my-products-grid .product-card');

        productCards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            const cardStatus = String(card.getAttribute('data-status') || '').toLowerCase();
            const cardCategory = String(card.getAttribute('data-category') || '').toLowerCase().trim();

            const matchesSearch = !searchTerm || name.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || cardStatus === statusFilter;
            const matchesCategory = !categoryFilter || cardCategory === categoryFilter;

            if (matchesSearch && matchesStatus && matchesCategory) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });

        this.applyProductSort();

        // Show empty message when no product cards are visible after filtering
        try {
            const container = document.getElementById('my-products-grid');
            if (container) {
                const cards = Array.from(container.querySelectorAll('.product-card'));
                const visible = cards.filter(c => (c.style.display || '') !== 'none');
                let emptyEl = container.querySelector('.filter-empty-state');
                if (visible.length === 0) {
                    if (!emptyEl) {
                        emptyEl = document.createElement('div');
                        emptyEl.className = 'filter-empty-state empty-state';
                        emptyEl.innerHTML = '<p>No products match the selected filters.</p>';
                        container.appendChild(emptyEl);
                    } else {
                        emptyEl.style.display = '';
                    }
                } else if (emptyEl) {
                    emptyEl.style.display = 'none';
                }
            }
        } catch (e) {
            console.warn('Could not update empty-state message for products', e);
        }
    }

    applyProductSort() {
        const container = document.getElementById('my-products-grid');
        if (!container) return;

        const sortBy = String(document.getElementById('product-sort-select')?.value || 'latest').trim();
        const cards = Array.from(container.querySelectorAll('.product-card'));

        const getTimestamp = (card) => {
            const raw = String(card.getAttribute('data-created-at') || '').trim();
            const ts = raw ? Date.parse(raw) : NaN;
            return Number.isFinite(ts) ? ts : 0;
        };

        cards.sort((a, b) => {
            const nameA = String(a.querySelector('.product-name')?.textContent || '').toLowerCase();
            const nameB = String(b.querySelector('.product-name')?.textContent || '').toLowerCase();
            const catA = String(a.getAttribute('data-category') || '').toLowerCase();
            const catB = String(b.getAttribute('data-category') || '').toLowerCase();
            const priceA = Number(a.getAttribute('data-price') || 0);
            const priceB = Number(b.getAttribute('data-price') || 0);
            const stockA = Number(a.getAttribute('data-stock-quantity') || 0);
            const stockB = Number(b.getAttribute('data-stock-quantity') || 0);
            const ratingA = Number(a.getAttribute('data-rating') || 0);
            const ratingB = Number(b.getAttribute('data-rating') || 0);
            const reviewsA = Number(a.getAttribute('data-reviews') || 0);
            const reviewsB = Number(b.getAttribute('data-reviews') || 0);
            const createdA = getTimestamp(a);
            const createdB = getTimestamp(b);

            switch (sortBy) {
                case 'name_asc': return nameA.localeCompare(nameB);
                case 'name_desc': return nameB.localeCompare(nameA);
                case 'category_asc': return catA.localeCompare(catB) || nameA.localeCompare(nameB);
                case 'price_low_high': return priceA - priceB;
                case 'price_high_low': return priceB - priceA;
                case 'stock_low_high': return stockA - stockB;
                case 'stock_high_low': return stockB - stockA;
                case 'rating_high_low': return ratingB - ratingA || reviewsB - reviewsA;
                case 'reviews_high_low': return reviewsB - reviewsA || ratingB - ratingA;
                case 'latest':
                default:
                    return createdB - createdA;
            }
        });

        cards.forEach((card) => container.appendChild(card));
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
                        <button type="submit" class="btn btn-primary btn-small" id="account-password-submit">Update Password</button>
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

        this.applyOrdersSearch();
        this.renderOrdersSearchDropdown();

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
            const orderDate = order.created_at ? new Date(order.created_at) : null;
            const deliveryAddress = String(order.delivery_address || '').trim();
            const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'Not specified';
            const specialInstructions = String(order.special_instructions || '').trim();
            const customerName = String(order.customer_name || '—').trim();
            const searchText = `${String(orderId)} ${productName} ${customerName}`.toLowerCase();
            const dateLabel = orderDate && !Number.isNaN(orderDate.getTime())
                ? orderDate.toLocaleDateString()
                : '—';
            const timeLabel = orderDate && !Number.isNaN(orderDate.getTime())
                ? orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—';
            
            return `
            <div class="order-card" data-order-id="${orderId}" data-order-status="${this.escapeAttr(status)}" data-search-text="${this.escapeAttr(searchText)}" style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; background: #fff;">
                <div class="order-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div class="order-head-left" style="display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
                        <span class="order-date" style="color: #64748b; font-size: 14px;">${dateLabel}</span>
                        <span class="order-time" style="color: #64748b; font-size: 14px;">${timeLabel}</span>
                        <span class="order-id" style="font-weight: 700; font-size: 16px;">Order #${orderId}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                    <img src="${this.escapeAttr(productImage)}" alt="${this.escapeHtml(productName)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" onerror="this.src='/images/logo.png'">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px;">${this.escapeHtml(productName)}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Customer:</strong> ${this.escapeHtml(customerName)}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Quantity:</strong> ${this.fmtNumber(quantity)} x ${this.fmtCurrency(price)} ${item.unit || order.unit || ''}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Total:</strong> ${this.fmtCurrency(totalAmount)}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Delivery Date:</strong> ${this.escapeHtml(deliveryDate)}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Delivery Address:</strong> ${this.escapeHtml(deliveryAddress || 'Not provided')}</div>
                        ${specialInstructions ? `<div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Notes:</strong> ${this.escapeHtml(specialInstructions)}</div>` : ''}
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

        this.applyOrdersSearch();
        this.renderOrdersSearchDropdown();
    }

    renderOrdersSearchDropdown() {
        const input = document.getElementById('orders-search-input');
        const dropdown = document.getElementById('orders-search-dropdown');
        if (!input || !dropdown) return;

        const q = String(input.value || '').trim().toLowerCase();
        if (!q) {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            return;
        }

        const cards = Array.from(document.querySelectorAll('.orders-list .order-card'));
        const matches = cards
            .map((card) => {
            const text = String(card.getAttribute('data-search-text') || '').toLowerCase();
                if (!text.includes(q)) return null;
                const orderId = String(card.getAttribute('data-order-id') || '').trim();
                const status = String(card.getAttribute('data-order-status') || '').trim();
                const product = String(card.querySelector('img')?.getAttribute('alt') || 'Product').trim();
                const customerText = String(card.textContent || '');
                const m = customerText.match(/Customer:\s*([^\n\r]+)/i);
                const customer = m ? String(m[1] || '').trim() : '—';
                return { orderId, status, product, customer };
            })
            .filter(Boolean)
            .slice(0, 10);

        if (!matches.length) {
            dropdown.classList.remove('open');
            dropdown.innerHTML = '';
            return;
        }

        dropdown.innerHTML = matches.map((m) => (
            `<button type="button" class="orders-search-option" data-order-id="${this.escapeAttr(m.orderId)}" data-status="${this.escapeAttr(m.status)}">
                <div class="title">Order #${this.escapeHtml(m.orderId)} • ${this.escapeHtml(m.product)}</div>
                <div class="meta">Customer: ${this.escapeHtml(m.customer)} • ${this.escapeHtml(this.formatStatusLabel(m.status || 'pending'))}</div>
            </button>`
        )).join('');
        dropdown.classList.add('open');
        this.ordersSearchActiveIndex = -1;

        dropdown.querySelectorAll('.orders-search-option').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.applyOrderSearchSelection(btn);
            });
        });
    }

    handleOrdersSearchKeydown(e) {
        const dropdown = document.getElementById('orders-search-dropdown');
        if (!dropdown || !dropdown.classList.contains('open')) return;

        const options = Array.from(dropdown.querySelectorAll('.orders-search-option'));
        if (!options.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.ordersSearchActiveIndex = (this.ordersSearchActiveIndex + 1) % options.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.ordersSearchActiveIndex = (this.ordersSearchActiveIndex - 1 + options.length) % options.length;
        } else if (e.key === 'Enter') {
            if (this.ordersSearchActiveIndex >= 0 && this.ordersSearchActiveIndex < options.length) {
                e.preventDefault();
                this.applyOrderSearchSelection(options[this.ordersSearchActiveIndex]);
            }
            return;
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('open');
            return;
        } else {
            return;
        }

        options.forEach((opt, index) => {
            opt.classList.toggle('active', index === this.ordersSearchActiveIndex);
        });
        const current = options[this.ordersSearchActiveIndex];
        if (current) current.scrollIntoView({ block: 'nearest' });
    }

    applyOrderSearchSelection(btn) {
        if (!btn) return;
        const dropdown = document.getElementById('orders-search-dropdown');
        const orderId = String(btn.getAttribute('data-order-id') || '').trim();
        const status = String(btn.getAttribute('data-status') || '').trim();
        if (status) {
            this.switchOrderTab(status, true);
        }
        const target = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.outline = '2px solid var(--primary-color)';
            target.style.outlineOffset = '2px';
            setTimeout(() => {
                target.style.outline = '';
                target.style.outlineOffset = '';
            }, 1200);
        }
        if (dropdown) dropdown.classList.remove('open');
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