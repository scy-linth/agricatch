// Admin Dashboard JavaScript

// Ensure placeholder image is defined on pages that don't load app.js
window.__PLACEHOLDER_IMAGE__ = window.__PLACEHOLDER_IMAGE__ || '/images/resendlogo.png';

class AdminDashboard {
    constructor() {
        const host = window.location.hostname;
        const isLocalHost = host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';
        const isCustomFrontendHost = host === 'agricatch.store' ||
            host === 'www.agricatch.store' ||
            host.includes('agricatch.store') ||
            host === 'agricatch.page.dev';

        this.apiBase = window.API_BASE || (isLocalHost ? 'http://localhost:3000/api' : (isCustomFrontendHost ? 'https://agricatch.onrender.com/api' : '/api'));
        try { if (!window.API_BASE) window.API_BASE = this.apiBase; } catch (e) {}

        this.token = localStorage.getItem('token');
        this.currentUserId = null;
        this.lastUsers = [];
        this.lastFarmers = [];
        this.pendingOrderStatus = new Map();
        this.sortableTables = {};
        this.searchQuery = '';
        this.activeSection = 'overview';
        this.prevSection = 'overview';
        this.previousModalId = null;
        this.modalZIndex = 1080;
        this.selectedNotifId = null;
        this.verificationRequests = [];
        this.verificationCurrentPage = 1;
        this.verificationCurrentStatus = 'all';
        this.currentReviewRequestId = null;

        // Support tickets
        this.supportTickets = [];
        this.supportTicketsCurrentPage = 1;
        this.supportTicketsPerPage = 10;
        this.supportTicketsTotal = 0;
        this.supportTicketsCurrentStatus = 'open';
        this.currentTicketId = null;
        this.ticketPollInterval = null;
        this.ticketPollFailures = 0;

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();

        // Setup chat scroll observer after initialization
        setTimeout(() => this.setupChatScrollObserver(), 500);

        // Centralized event delegation for all table action buttons
        // (capture phase so it fires before simple-datatables stopPropagation)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.matches('.customer-view-btn')) {
                this.openCustomerDetailModal(Number(btn.dataset.userId));
            } else if (btn.matches('.product-edit-btn')) {
                this.openProductEdit(Number(btn.dataset.productId));
            } else if (btn.matches('.product-delete-btn')) {
                this.deleteProduct(Number(btn.dataset.productId));
            } else if (btn.matches('.order-view-btn')) {
                this.viewOrderDetails(Number(btn.dataset.orderId));
            } else if (btn.matches('.audit-log-view-btn')) {
                this.openAuditLogDetailModalById(Number(btn.dataset.logId));
            } else if (btn.matches('.category-edit-btn')) {
                this.editCategory(Number(btn.dataset.categoryId));
            } else if (btn.matches('.catalog-edit-btn')) {
                this.editCatalogName(Number(btn.dataset.catalogId));
            } else if (btn.matches('.category-request-review-btn')) {
                this.openCategoryRequestPanel(Number(btn.dataset.requestId));
            } else if (btn.matches('.farmer-view-btn')) {
                this.openFarmerDetailModal(Number(btn.dataset.farmerId));
            } else if (btn.matches('.admin-view-btn')) {
                this.openAdminDetailModal(Number(btn.dataset.userId));
            } else if (btn.matches('.all-users-view-btn')) {
                this.openAllUsersDetailModal(Number(btn.dataset.userId));
            } else if (btn.matches('.toggle-modal-password-btn')) {
                this.toggleModalPasswordVisibility();
            } else if (btn.matches('.category-requests-view-btn')) {
                this.showSection('category-requests');
            } else if (btn.matches('.product-view-btn')) {
                this.openProductApprovalDetail(Number(btn.dataset.productId));
            } else if (btn.matches('.product-approve-btn')) {
                this.approveProduct(Number(btn.dataset.productId));
            } else if (btn.matches('.product-reject-btn')) {
                this.rejectProduct(Number(btn.dataset.productId));
            } else if (btn.matches('.flagged-unflag-btn')) {
                this.unflagUser(Number(btn.dataset.userId));
            }
        }, true);
    }

    fmtNumber(value, options) {
        try {
            if (window.FormatUtil && typeof window.FormatUtil.number === 'function') {
                return window.FormatUtil.number(value, options);
            }
        } catch (_) {}
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        return String(n);
    }

    fmtCurrency(value, options) {
        try {
            if (window.FormatUtil && typeof window.FormatUtil.currency === 'function') {
                return window.FormatUtil.currency(value, options);
            }
        } catch (_) {}
        const n = Number(value);
        return `₱${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
    }

    getValidStatusOptions(currentStatus) {
        const validTransitions = {
            pending: ['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
            confirmed: ['preparing', 'out_for_delivery', 'delivered', 'cancelled'],
            preparing: ['out_for_delivery', 'delivered', 'cancelled'],
            out_for_delivery: ['delivered', 'cancelled'],
            delivered: [],
            cancelled: []
        };

        const statusLabels = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            out_for_delivery: 'Out for Delivery',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };

        const allowed = validTransitions[currentStatus] || [];
        const options = [];

        allowed.forEach(status => {
            options.push({ value: status, label: statusLabels[status] || status });
        });

        return options;
    }

    getAllStatusOptions(currentStatus) {
        const statusLabels = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            out_for_delivery: 'Out for Delivery',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };

        const statusColors = {
            pending: '#ffc107',
            confirmed: '#17a2b8',
            preparing: '#fd7e14',
            out_for_delivery: '#6f42c1',
            delivered: '#28a745',
            cancelled: '#dc3545'
        };

        const validTransitions = {
            pending: ['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
            confirmed: ['preparing', 'out_for_delivery', 'delivered', 'cancelled'],
            preparing: ['out_for_delivery', 'delivered', 'cancelled'],
            out_for_delivery: ['delivered', 'cancelled'],
            delivered: [],
            cancelled: []
        };

        const allowed = validTransitions[currentStatus] || [];
        const options = [];
        Object.keys(statusLabels).forEach(status => {
            options.push({
                value: status,
                label: statusLabels[status],
                color: statusColors[status] || '#6c757d',
                disabled: !allowed.includes(status)
            });
        });

        return options;
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

        // Save sort state when user clicks a header
        const wrapper = this.sortableTables[tableId].wrapperDOM;
        if (wrapper) {
            const headers = wrapper.querySelectorAll('th');
            headers.forEach((th, index) => {
                th.addEventListener('click', () => {
                    // Toggle direction: if clicking same column, flip direction; otherwise use asc
                    const currentSort = localStorage.getItem(`adminTableSort_${tableId}`);
                    let newDirection = 'asc';
                    if (currentSort) {
                        try {
                            const [savedCol, savedDir] = JSON.parse(currentSort);
                            if (savedCol === index) {
                                newDirection = savedDir === 'asc' ? 'desc' : 'asc';
                            }
                        } catch (_) {}
                    }
                    localStorage.setItem(`adminTableSort_${tableId}`, JSON.stringify([index, newDirection]));
                });
            });
        }
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

    showAccessOverlay({ title, message, userEmail }) {
        const existing = document.getElementById('admin-access-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'admin-access-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(6px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            width: 100%;
            max-width: 520px;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.35);
            padding: 20px;
            font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif;
        `;

        card.innerHTML = `
            <h2 style="margin:0 0 8px 0; font-size: 18px; color:#0f172a;">${title}</h2>
            <p style="margin:0 0 14px 0; color:#334155; line-height:1.4;">${message}</p>
            ${userEmail ? `<div style="margin:0 0 14px 0; color:#64748b; font-size: 13px;">Account: <strong>${userEmail}</strong></div>` : ''}
            <div style="display:flex; gap:10px; flex-wrap: wrap; margin-bottom: 12px;">
                <button id="admin-overlay-logout" style="padding:10px 12px; border-radius:10px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer;">Logout</button>
                <button id="admin-overlay-close" style="padding:10px 12px; border-radius:10px; border:1px solid #cbd5e1; background:#ffffff; cursor:pointer;">Stay on this page</button>
            </div>
            <div style="border-top:1px solid #e2e8f0; padding-top: 12px;">
                <div style="font-weight:600; margin-bottom:8px; color:#0f172a;">Recover admin role</div>
                <div style="display:flex; gap:8px; flex-wrap: wrap;">
                    <input id="admin-recover-secret" type="password" placeholder="Admin secret" style="flex:1; min-width: 220px; padding:10px 12px; border-radius:10px; border:1px solid #cbd5e1;" />
                    <button id="admin-recover-btn" style="padding:10px 12px; border-radius:10px; border:1px solid #1d4ed8; background:#2563eb; color:#fff; cursor:pointer;">Recover</button>
                </div>
                <div id="admin-recover-result" style="margin-top:10px; color:#334155; font-size: 13px;"></div>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const logoutBtn = document.getElementById('admin-overlay-logout');
        const closeBtn = document.getElementById('admin-overlay-close');
        const recoverBtn = document.getElementById('admin-recover-btn');
        const secretInput = document.getElementById('admin-recover-secret');
        const resultEl = document.getElementById('admin-recover-result');

        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
        if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());

        if (recoverBtn) {
            recoverBtn.addEventListener('click', async () => {
                const admin_secret = (secretInput?.value || '').trim();
                if (!userEmail) {
                    resultEl.textContent = 'Missing user email, please login again.';
                    return;
                }
                if (!admin_secret) {
                    resultEl.textContent = 'Please enter the admin secret.';
                    return;
                }
                resultEl.textContent = 'Recovering...';
                try {
                    const resp = await fetch(`${this.apiBase}/auth/recover-admin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, admin_secret })
                    });
                    const data = await resp.json().catch(() => ({}));
                    if (!resp.ok) {
                        resultEl.textContent = data.message || 'Recovery failed.';
                        return;
                    }
                    resultEl.textContent = 'Recovered! Reloading...';
                    setTimeout(() => window.location.reload(), 700);
                } catch (e) {
                    resultEl.textContent = 'Recovery failed (network/server error).';
                }
            });
        }
    }

    init() {
        this._loadedSections = {};
        this.pagination = {
            orders: { page: 1, total: 0, limit: 50 },
            users:  { page: 1, total: 0, limit: 50 },
            products: { page: 1, total: 0, limit: 50 },
            farmers: { page: 1, total: 0, limit: 50 },
            logs: { page: 1, total: 0, limit: 25 },
            categories: { page: 1, total: 0, limit: 50 },
            'catalog-products': { page: 1, total: 0, limit: 50 },
            'category-requests': { page: 1, total: 0, limit: 50 },
            'verification-requests': { page: 1, total: 0, limit: 50 },
            activity: { page: 1, total: 0, limit: 5 },
            'top-products': { page: 1, total: 0, limit: 5 },
            'top-farmers': { page: 1, total: 0, limit: 5 },
            'recent-sales': { page: 1, total: 0, limit: 5 },
            'admin': { page: 1, total: 0, limit: 25 },
            'all-users': { page: 1, total: 0, limit: 25 },
            'suspicious-patterns': { page: 1, total: 0, limit: 50 },
            'flagged-users': { page: 1, total: 0, limit: 50 },
            'security-log': { page: 1, total: 0, limit: 50 },
        };
        this._kpiPeriods = { 'kpi-sales': 'today', 'kpi-revenue': 'today', 'kpi-customers': 'today', 'kpi-farmers': 'today' };
        this._reportPeriod = 'today';
        this._activityPeriod = 'today';
        this._topProductsPeriod = 'today';
        this._topFarmersPeriod = 'today';
        this._recentSalesPeriod = 'today';
        this._reportsChart = null;

        this._restorePeriods();

        this.checkAdminAuth();
        this.loadDashboardStats();
        this.setupEventListeners();
        this.setupRealtime();
        this.startUnreadPolling();
        this.loadProductApprovalsBadge();
        this.loadSubscriptionBadgeCount();
        this.loadSupportTicketsBadge();
        this.initChat();

        // Poll support tickets badge every 60s
        const loadSupportBadge = () => this.loadSupportTicketsBadge();
        loadSupportBadge();
        this._supportBadgeInterval = setInterval(loadSupportBadge, 60000);
        // Description char counter for product edit
        const desc = document.getElementById('edit-product-description');
        const count = document.getElementById('edit-product-description-count');
        if (desc && count) {
            desc.addEventListener('input', () => {
                count.textContent = desc.value.length;
            });
        }
        // Live image preview
        const imgInput = document.getElementById('edit-product-image');
        const imgPreview = document.getElementById('edit-product-image-preview');
        if (imgInput && imgPreview) {
            imgInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        imgPreview.src = ev.target.result;
                        imgPreview.style.display = '';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Dashboard period filters (KPI cards)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.kpi-period-filter');
            if (!link) return;
            e.preventDefault();
            const card = link.dataset.card;
            const period = link.dataset.period;
            if (card && period) {
                // Update active state for dropdown items
                const dropdown = link.closest('.dropdown-menu');
                if (dropdown) {
                    dropdown.querySelectorAll('.kpi-period-filter').forEach(item => {
                        item.classList.remove('active');
                    });
                    link.classList.add('active');
                }
                this._kpiPeriods[card] = period;
                // Sync all KPI periods to match
                for (const key of Object.keys(this._kpiPeriods)) {
                    this._kpiPeriods[key] = period;
                }
                // Sync reports period as well
                this._reportPeriod = period;
                const reportLbl = document.getElementById('reports-period-label');
                if (reportLbl) reportLbl.textContent = `| ${this._periodLabel(period)}`;
                // Reload reports chart with new period
                this.loadReportsChart(period);
                // Reload all KPI cards with new period
                for (const key of Object.keys(this._kpiPeriods)) {
                    this.loadKpiCard(key, period);
                }
                // Update all comparison labels
                const comparisonText = this._comparisonLabel(period);
                const labels = [
                    'kpi-sales-change-label',
                    'kpi-revenue-change-label',
                    'kpi-customers-change-label',
                    'kpi-farmers-change-label'
                ];
                labels.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = comparisonText;
                });
                this._savePeriods();
            }
        });

        // Reports chart period
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.report-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._reportPeriod = period;
            const lbl = document.getElementById('reports-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            // Sync all KPI periods to match
            for (const key of Object.keys(this._kpiPeriods)) {
                this._kpiPeriods[key] = period;
            }
            // Reload all KPI cards with new period
            for (const key of Object.keys(this._kpiPeriods)) {
                this.loadKpiCard(key, period);
            }
            // Update all comparison labels
            const comparisonText = this._comparisonLabel(period);
            const labels = [
                'kpi-sales-change-label',
                'kpi-revenue-change-label',
                'kpi-customers-change-label',
                'kpi-farmers-change-label'
            ];
            labels.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = comparisonText;
            });
            this.loadReportsChart(period);
            this._savePeriods();
        });

        // Activity feed period
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.activity-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._activityPeriod = period;
            const lbl = document.getElementById('activity-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            this.loadRecentActivity(period);
            this._savePeriods();
        });

        // Top products period
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.top-products-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._topProductsPeriod = period;
            const lbl = document.getElementById('top-products-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            this.loadTopProducts(period);
            this._savePeriods();
        });

        // Top farmers period
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.top-farmers-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._topFarmersPeriod = period;
            const lbl = document.getElementById('top-farmers-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            this.loadTopFarmers(period);
            this._savePeriods();
        });

        // Recent sales period
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.recent-sales-period-filter');
            if (!link) return;
            e.preventDefault();
            const period = link.dataset.period;
            this._recentSalesPeriod = period;
            const lbl = document.getElementById('recent-sales-period-label');
            if (lbl) lbl.textContent = `| ${this._periodLabel(period)}`;
            this.loadRecentSales(period);
            this._savePeriods();
        });
    }

    setupRealtime() {
        try {
            if (!this.token) return;
            const url = `${this.apiBase}/events?token=${encodeURIComponent(this.token)}`;
            const es = new EventSource(url);

            es.addEventListener('order.updated', (evt) => {
                // Refresh orders + stats; order detail will be refreshed on save/view
                this.loadOrders();
                this.loadDashboardStats();
                const panel = document.getElementById('order-detail-panel');
                if (panel && panel.classList.contains('active')) {
                    // If we currently show an order detail, refresh it
                    const header = document.querySelector('#order-detail-content .panel-header h3');
                    const match = header?.textContent?.match(/Order\s+#(\d+)/i);
                    if (match?.[1]) {
                        this.viewOrderDetails(parseInt(match[1], 10));
                    }
                }
            });

            es.addEventListener('admin.audit', (evt) => {
                const data = JSON.parse(evt.data);
                // Refresh product approvals badge on product approve/reject
                if (data.action === 'product.approve' || data.action === 'product.reject') {
                    this.loadProductApprovalsBadge();
                }
                // If logs tab is open, refresh it
                const logsSection = document.getElementById('logs');
                if (logsSection && logsSection.classList.contains('active')) {
                    this.loadAuditLogs();
                }
                // Always refresh recent activity on dashboard
                this.loadRecentActivity(this._activityPeriod || 'today');
            });

            es.addEventListener('chat.message', () => {
                if (typeof this._refreshUnread === 'function') this._refreshUnread();
            });

            es.addEventListener('notification.created', (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.user_id === this.currentUserId) {
                        this.loadNotifications();
                    }
                } catch (e) {
                    // If parsing fails, refresh anyway as fallback
                    this.loadNotifications();
                }
            });
        } catch (e) {
            // ignore
        }
    }

    setupNavigation() {
        // Load saved section or default to overview
        let savedSection = localStorage.getItem('adminActiveSection') || 'overview';
        // Prevent admin from landing on super_admin-only sections
        const sectionEl = document.getElementById(savedSection);
        if (sectionEl && sectionEl.getAttribute('data-roles') === 'super_admin' && this.currentUserRole !== 'super_admin') {
            savedSection = 'overview';
            localStorage.setItem('adminActiveSection', savedSection);
        }
        this.showSection(savedSection);

        // Add click handlers to sidebar links
        document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                const filterStatus = link.getAttribute('data-filter-status');
                if (section) {
                    this.showSection(section);
                    document.body.classList.remove('toggle-sidebar');
                    if (filterStatus && section === 'products') {
                        const targetTab = document.querySelector(`.products-tabs .tab-btn[data-status="${filterStatus}"]`);
                        if (targetTab) {
                            document.querySelectorAll('.products-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                            targetTab.classList.add('active');
                            this.loadProducts();
                        }
                    }
                }
            });
        });
    }

    navigateTo(sectionId, tab) {
        this.showSection(sectionId);
        if (tab) {
            // Map shorthand tab names to actual HTML data-bs-target IDs
            const tabMap = { 'password': 'change-password', 'edit': 'edit', 'overview': 'overview' };
            const resolvedTab = tabMap[tab] || tab;
            setTimeout(() => {
                const tabBtn = document.querySelector(`#profileTabs [data-bs-target="#profile-${resolvedTab}"]`);
                if (tabBtn && typeof bootstrap !== 'undefined') {
                    new bootstrap.Tab(tabBtn).show();
                }
            }, 100);
        }
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
                    }
                }
            });
        });

        observer.observe(chatSection, { attributes: true });

        // Also scroll to bottom on initial load if chat section is already active
        if (chatSection.classList.contains('active')) {
            setTimeout(() => {
                window.scrollTo(0, document.body.scrollHeight);
            }, 500);
        }
    }

    showSection(sectionId) {
        // Block admin from accessing super_admin-only sections
        const sectionEl = document.getElementById(sectionId);
        if (sectionEl && sectionEl.getAttribute('data-roles') === 'super_admin' && this.currentUserRole !== 'super_admin') {
            this.showToast('Access denied: Super Admin only', 'error');
            sectionId = 'overview';
        }
        this.prevSection = this.activeSection;
        this.activeSection = sectionId;
        localStorage.setItem('adminActiveSection', sectionId);

        // Close all detail panels when navigating to a different section
        this.closeOrderDetails();
        this.closeProductApprovalDetails();
        this.closeCategoryDetails();
        this.closeCustomerDetails();
        this.closeFarmerDetails();

        document.querySelectorAll('.admin-section-card').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) targetSection.classList.add('active');

        document.querySelectorAll('.sidebar-link[data-section]').forEach((link) => {
            const isActive = link.getAttribute('data-section') === sectionId;
            link.classList.toggle('active', isActive);
            link.classList.toggle('collapsed', !isActive);
        });

        // Expand parent collapse menu if the section is inside one
        const activeLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
        if (activeLink) {
            const parentCollapse = activeLink.closest('.nav-content.collapse');
            if (parentCollapse) {
                const parentToggle = document.querySelector(`[data-bs-target="#${parentCollapse.id}"]`);
                if (parentToggle) {
                    parentToggle.classList.remove('collapsed');
                    parentCollapse.classList.add('show');
                }
            }
        }

        // Scroll browser to bottom when chat section becomes active
        if (sectionId === 'chat') {
            setTimeout(() => {
                window.scrollTo(0, document.body.scrollHeight);
            }, 500);
        }

        if (sectionId === 'verification-requests') {
            this.loadVerificationRequests();
        }

        if (sectionId === 'subscription-requests') {
            this.loadSubscriptionRequests('all');
        }

        if (sectionId === 'chat') {
            // Unified inbox - no tabs needed
        }

        // Load data when navigating to sections
        if (sectionId === 'orders') {
            this.loadOrders();
        } else if (sectionId === 'users') {
            this.loadUsers();
        } else if (sectionId === 'products') {
            this.loadProducts();
        } else if (sectionId === 'categories') {
            this.loadCategories();
        } else if (sectionId === 'catalog-products') {
            this.loadProducts();
        } else if (sectionId === 'farmers') {
            this.loadFarmers('all');
        } else if (sectionId === 'admin') {
            this.loadAdmin();
        } else if (sectionId === 'all-users') {
            this.loadAllUsers();
        } else if (sectionId === 'suspicious-patterns') {
            this.loadSuspiciousPatterns();
        } else if (sectionId === 'flagged-users') {
            this.loadFlaggedUsers();
        } else if (sectionId === 'security-log') {
            this.loadSecurityLog();
        } else if (sectionId === 'platform-settings') {
            this.loadPlatformSettings();
        } else if (sectionId === 'feature-flags') {
            this.loadFeatureFlags();
        } else if (sectionId === 'notifications') {
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
        } else if (sectionId === 'category-requests') {
            this.loadCategoryRequests();
        } else if (sectionId === 'product-approvals') {
            this.loadProductApprovals();
        } else if (sectionId === 'profile') {
            this.loadProfileSection();
        }

        // Add active state to parent collapse menu for catalog sections
        const catalogSections = ['catalog-products', 'categories'];
        const catalogParent = document.getElementById('nav-catalog');
        const catalogLink = document.querySelector('[data-bs-target="#nav-catalog"]');
        
        if (catalogSections.includes(sectionId)) {
            if (catalogParent) {
                catalogParent.classList.add('show');
                if (catalogLink) {
                    catalogLink.classList.remove('collapsed');
                    catalogLink.setAttribute('aria-expanded', 'true');
                }
            }
        } else {
            // Collapse catalog menu when switching to non-catalog sections
            if (catalogParent) {
                catalogParent.classList.remove('show');
                if (catalogLink) {
                    catalogLink.classList.add('collapsed');
                    catalogLink.setAttribute('aria-expanded', 'false');
                }
            }
        }

        this.closeOrderDetails();
        this.closeCategoryDetails();
        this.closeCategoryEdit();
        this.closeCatalogEdit();
        this.closeProductEdit();
        document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' });

        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            // Hide page title for all sections with hero titles (all except overview)
            pageTitle.style.display = sectionId === 'overview' ? 'block' : 'none';
            const titles = {
                overview: 'Dashboard Overview',
                orders: 'Order Management',
                users: 'Customer Management',
                products: 'Listings',
                'catalog-products': 'Product Catalog',
                categories: 'Category Management',
                'category-requests': 'Product Catalog Requests',
                'product-approvals': 'Pending Approvals',
                'verification-requests': 'Verification Requests',
                'subscription-requests': 'Subscription Requests',
                farmers: 'Farmer Management',
                admin: 'Admin Management',
                'all-users': 'All Users',
                logs: 'Audit Logs',
                chat: 'Chat & Support',
                notifications: 'Notifications',
                profile: 'My Profile',
                broadcast: 'Broadcast Announcement',
                'suspicious-patterns': 'Suspicious Patterns',
                'flagged-users': 'Flagged Users',
                'security-log': 'Security Log',
                'platform-settings': 'Platform Settings',
                'feature-flags': 'Feature Flags',
                'database-backup': 'Database Data Backup',
                'image-manager': 'Image Manager',
            };
            pageTitle.textContent = titles[sectionId] || 'Dashboard';
        }

        // Update breadcrumb
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbCurrent) {
            const breadcrumbLabels = {
                overview: 'Dashboard',
                orders: 'Orders',
                users: 'Customers',
                products: 'Listings',
                'catalog-products': 'Product Catalog',
                categories: 'Category Management',
                'category-requests': 'Product Catalog Requests',
                'product-approvals': 'Pending Approvals',
                'verification-requests': 'Verification Requests',
                'subscription-requests': 'Subscription Requests',
                'support-tickets': 'Support Tickets',
                farmers: 'Farmers',
                admin: 'Admin',
                'all-users': 'All Users',
                logs: 'Audit Logs',
                chat: 'Support Center',
                notifications: 'Notifications',
                profile: 'My Profile',
                broadcast: 'Broadcast',
                'suspicious-patterns': 'Suspicious Patterns',
                'flagged-users': 'Flagged Users',
                'security-log': 'Security Log',
                'platform-settings': 'Platform Settings',
                'feature-flags': 'Feature Flags',
            };
            breadcrumbCurrent.textContent = breadcrumbLabels[sectionId] || 'Dashboard';
        }

        // Lazy-load sections on first visit
        if (sectionId === 'logs' && !this._loadedSections?.logs) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.logs = true;
            this.loadAdminsForLogs();
            this.loadAuditLogs();
        }
        if (sectionId === 'users' && !this._loadedSections?.users) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.users = true;
            this.loadUsers();
        }
        if (sectionId === 'categories' && !this._loadedSections?.categories) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.categories = true;
            this.loadCategories();
        }
        if (sectionId === 'catalog-products' && !this._loadedSections?.catalogProducts) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.catalogProducts = true;
            this.loadCatalogNames();
            if (!this._loadedSections?.categories) {
                this._loadedSections.categories = true;
                this.loadCategories();
            }
        }
        if (sectionId === 'category-requests' && !this._loadedSections?.categoryRequests) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.categoryRequests = true;
            this.loadCategoryRequests();
        }
        if (sectionId === 'product-approvals' && !this._loadedSections?.productApprovals) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.productApprovals = true;
            this.loadProductApprovals();
        }
        if (sectionId === 'farmers' && !this._loadedSections?.farmers) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.farmers = true;
            this.loadFarmers();
        }
        if (sectionId === 'profile' && !this._loadedSections?.profile) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.profile = true;
            this.loadProfileSection();
        }
        if (sectionId === 'notifications') {
            this.loadNotifications();
        }
        if (sectionId === 'admin' && !this._loadedSections?.admin) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections.admin = true;
            this.loadAdmin();
        }
        if (sectionId === 'all-users' && !this._loadedSections?.['all-users']) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections['all-users'] = true;
            this.loadAllUsers();
        }
        if (sectionId === 'suspicious-patterns' && !this._loadedSections?.['suspicious-patterns']) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections['suspicious-patterns'] = true;
            this.loadSuspiciousPatterns();
        }
        if (sectionId === 'flagged-users' && !this._loadedSections?.['flagged-users']) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections['flagged-users'] = true;
            this.loadFlaggedUsers();
        }
        if (sectionId === 'security-log' && !this._loadedSections?.['security-log']) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections['security-log'] = true;
            this.loadSecurityLog();
        }
        if (sectionId === 'platform-settings' && !this._loadedSections?.['platform-settings']) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections['platform-settings'] = true;
            this.loadPlatformSettings();
            this.loadServiceStatus();
            if (this.currentUserRole === 'super_admin') {
                this.loadPaymentAccounts();
                this.loadSubscriptionSettings();
            }
            
            document.getElementById('refresh-settings-btn')?.addEventListener('click', () => {
                localStorage.removeItem('cached_delivery_fee');
                localStorage.removeItem('cached_delivery_fee_timestamp');
                this.showMessage('Settings cache cleared. Refreshing...', 'info');
                setTimeout(() => location.reload(), 1000);
            });
        }
        if (sectionId === 'feature-flags' && !this._loadedSections?.['feature-flags']) {
            this._loadedSections = this._loadedSections || {};
            this._loadedSections['feature-flags'] = true;
            this.loadFeatureFlags();
        }
    }

    async checkAdminAuth() {
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                    headers: { 
                    'Authorization': `Bearer ${this.token}`
                }
            });

            // Handle invalid token (signature mismatch)
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/?login=1&reason=invalid_token';
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (!['admin', 'super_admin'].includes(data.user.role)) {
                    // Access denied -> redirect non-admin away from admin panel
                    if (data.user.role === 'farmer') {
                        window.location.href = '/farmer.html?denied=admin';
                        return;
                    }
                    window.location.href = '/';
                    return;
                }
                this.currentUserRole = data.user.role;
                this.currentUserId = data.user.id;
                const fullName = data.user.full_name || data.user.username || 'Admin';
                // Extract first name and format as Title Case (capitalize each word)
                const firstName = fullName.split(' ')[0];
                const formattedFirstName = firstName.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
                const userNameEl   = document.getElementById('user-name');
                const userNameDdEl = document.getElementById('user-name-dd');
                const userEmailEl  = document.getElementById('user-email');
                const profileImgEl  = document.getElementById('header-profile-img');
                const roleBadgeEl  = document.getElementById('header-role-badge');
                if (userNameEl)   userNameEl.textContent   = formattedFirstName;
                if (userNameDdEl) userNameDdEl.textContent = formattedFirstName;
                if (userEmailEl)  userEmailEl.textContent  = data.user.email || '';
                if (roleBadgeEl) {
                    roleBadgeEl.textContent = data.user.role || 'admin';
                    roleBadgeEl.style.display = 'inline-block';
                }
                // Set avatar to first letter of first name if no image
                if (profileImgEl && !data.user.profile_image) {
                    const firstLetter = firstName.charAt(0).toUpperCase();
                    profileImgEl.style.display = 'none';
                    // Use profile-initial element
                    const profileInitial = document.getElementById('header-profile-initial');
                    if (profileInitial) {
                        profileInitial.textContent = firstLetter;
                        profileInitial.style.display = 'flex';
                    }
                } else if (profileImgEl && data.user.profile_image) {
                    profileImgEl.src = data.user.profile_image;
                    profileImgEl.style.display = 'block';
                    const profileInitial = document.getElementById('header-profile-initial');
                    if (profileInitial) profileInitial.style.display = 'none';
                }
                // Apply role-based UI
                const visitSiteBtn = document.getElementById('visit-site-btn');
                if (visitSiteBtn) visitSiteBtn.style.display = this.currentUserRole === 'super_admin' ? 'block' : 'none';

                // Hide super_admin-only sidebar items and sections for admin
                if (this.currentUserRole !== 'super_admin') {
                    document.querySelectorAll('[data-roles="super_admin"]').forEach(el => {
                        el.style.display = 'none';
                    });
                }

                // Setup navigation after auth check completes
                this.setupNavigation();

                // Load initial section data before hiding loading screen
                this.loadInitialSectionData();
            } else {
                if (response.status === 401 || response.status === 403) {
                    try { localStorage.removeItem('token'); } catch (_) {}
                    window.location.href = '/?login=1';
                    return;
                }

                const message = response.status === 429
                    ? 'Login verification is being rate-limited. Please retry in a few seconds.'
                    : 'Admin session check failed. Staying on the dashboard so you can retry.';
                this.showToast(message, response.status === 429 ? 'warning' : 'error');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.showToast('Admin session check failed due to a network error. Staying on the dashboard.', 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('visit-site-btn')?.addEventListener('click', () => this.visitMainSite());

        // Audience checkbox mutual exclusion
        this.setupAudienceCheckboxes();

        // Dropdown navigation links
        document.getElementById('show-all-notifications-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateTo('notifications');
        });
        document.getElementById('notif-mark-all-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.markAllNotifsRead();
        });
        document.getElementById('show-all-messages-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateTo('chat');
        });
        document.getElementById('view-all-messages-badge')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateTo('chat');
        });

        // Verification request status filter tabs (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.matches('.verification-tabs .tab-btn')) {
                const parentTabs = e.target.closest('.verification-tabs');
                parentTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Handle different tab types
                if (parentTabs.classList.contains('verification-tabs') && !parentTabs.classList.contains('order-tabs') && !parentTabs.classList.contains('users-tabs') && !parentTabs.classList.contains('products-tabs') && !parentTabs.classList.contains('categories-tabs') && !parentTabs.classList.contains('catalog-tabs') && !parentTabs.classList.contains('farmers-tabs') && !parentTabs.classList.contains('admin-tabs') && !parentTabs.classList.contains('all-users-tabs') && !parentTabs.classList.contains('product-approval-tabs') && !parentTabs.classList.contains('category-request-tabs') && !parentTabs.classList.contains('subscription-tabs')) {
                    this.loadVerificationRequests(1, e.target.dataset.status);
                } else if (parentTabs.classList.contains('product-approval-tabs')) {
                    this.resetPaginationPage('product-approvals');
                    this.loadProductApprovals(e.target.dataset.status, undefined, 1);
                } else if (parentTabs.classList.contains('category-request-tabs')) {
                    this.resetPaginationPage('category-requests');
                    this.loadCategoryRequests(e.target.dataset.status, undefined, 1);
                } else if (parentTabs.classList.contains('subscription-tabs')) {
                    this.resetPaginationPage('subscription-requests');
                    this.loadSubscriptions(e.target.dataset.status, undefined, 1);
                }
            }
        });


        // Support ticket entries per page
        document.getElementById('support-tickets-entries')?.addEventListener('change', (e) => {
            this.supportTicketsPerPage = parseInt(e.target.value);
            this.supportTicketsCurrentPage = 1;
            this.loadSupportTickets(this.supportTicketsCurrentStatus);
        });

        // Admin send ticket message
        document.getElementById('btn-admin-send-ticket-message')?.addEventListener('click', () => {
            this.sendAdminTicketMessage();
        });

        // Admin ticket message input
        document.getElementById('admin-ticket-message-input')?.addEventListener('input', (e) => {
            const count = e.target.value.length;
            const counterEl = document.getElementById('admin-ticket-message-char-count');
            counterEl.textContent = `${count}/500`;
            counterEl.style.color = count > 450 ? 'red' : '';
        });

        // Admin ticket status change
        document.getElementById('admin-ticket-status-select')?.addEventListener('change', (e) => {
            this.updateTicketStatus(this.currentTicketId, e.target.value);
        });

        // Stop ticket polling when modal closes
        document.getElementById('admin-ticket-detail-modal')?.addEventListener('hidden.bs.modal', () => {
            this.stopAdminTicketPolling();
            this.currentTicketId = null;
        });

        // Review modal buttons - now attached in openReviewModal to ensure they work

        // Unverify modal button
        document.getElementById('confirm-unverify-btn')?.addEventListener('click', () => this.handleUnverifyAction());

        // Unverify button in details modal
        document.getElementById('unverify-from-details-btn')?.addEventListener('click', (e) => {
            const requestId = e.target.dataset.requestId;
            this.openUnverifyModal(requestId);
        });

        // Approve button in details modal
        document.getElementById('approve-from-details-btn')?.addEventListener('click', async (e) => {
            console.log('[DEBUG] Approve button clicked', e.target);
            const requestId = e.target.dataset.requestId;
            console.log('[DEBUG] Request ID from dataset:', requestId);
            console.log('[DEBUG] Calling closeVerificationDetailsModal...');
            this.closeVerificationDetailsModal();
            console.log('[DEBUG] Calling openReviewModal with approve...');
            await this.openReviewModal(requestId, 'approve');
        });

        // Reject button in details modal
        document.getElementById('reject-from-details-btn')?.addEventListener('click', async (e) => {
            console.log('[DEBUG] Reject button clicked', e.target);
            const requestId = e.target.dataset.requestId;
            console.log('[DEBUG] Request ID from dataset:', requestId);
            console.log('[DEBUG] Calling closeVerificationDetailsModal...');
            this.closeVerificationDetailsModal();
            console.log('[DEBUG] Calling openReviewModal with reject...');
            await this.openReviewModal(requestId, 'reject');
        });

        // Verification document view buttons (event delegation)
        document.getElementById('verification-requests-table')?.addEventListener('click', async (e) => {
            // Image thumbnail click
            if (e.target.classList.contains('verification-doc-thumb')) {
                const docUrl = e.target.dataset.docUrl;
                const farmerName = e.target.dataset.farmerName;
                this.openVerificationDocModal(docUrl, farmerName);
            }
            // View details button
            if (e.target.classList.contains('view-verification-details-btn')) {
                const requestId = e.target.dataset.requestId;
                const farmerId = e.target.dataset.farmerId;
                this.openVerificationDetailsModal(requestId, farmerId);
            }
            // Approve button
            if (e.target.classList.contains('approve-verification-btn')) {
                const requestId = e.target.dataset.requestId;
                await this.openReviewModal(requestId, 'approve');
            }
            // Reject button
            if (e.target.classList.contains('reject-verification-btn')) {
                const requestId = e.target.dataset.requestId;
                await this.openReviewModal(requestId, 'reject');
            }
        });

        // Sidebar toggle button
        const toggleBtn = document.getElementById('admin-sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.body.classList.toggle('toggle-sidebar');
            });
        } else {
            console.error('Toggle button not found!');
        }

        // Sidebar overlay — clicking backdrop closes sidebar on mobile
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            document.body.classList.remove('toggle-sidebar');
        });

        // Orders in-section filters
        const priceFilter  = document.getElementById('order-price-filter');
        const sortFilter   = document.getElementById('order-sort-filter');
        const orderSearch  = document.getElementById('order-search-btn');
        const orderInput   = document.getElementById('order-search-input');
        
        // Order status tabs
        document.querySelectorAll('.order-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.order-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('orders');
                this.loadOrders(1);
            });
        });
        
        if (priceFilter)  priceFilter.addEventListener('change',  () => this.loadOrders(1));
        if (sortFilter)   sortFilter.addEventListener('change',   () => this.loadOrders(1));
        if (orderSearch)  orderSearch.addEventListener('click',   () => this.loadOrders(1));
        if (orderInput)   orderInput.addEventListener('keydown',  (e) => { if (e.key === 'Enter') this.loadOrders(1); });

        const closePanel   = document.getElementById('close-order-panel');
        const closeCategoryPanel = document.getElementById('close-category-panel');
        const closeCustomerPanel = document.getElementById('close-customer-panel');
        const closeFarmerPanel = document.getElementById('close-farmer-panel');
        const closeProductApprovalPanel = document.getElementById('close-product-approval-panel');

        if (closePanel) closePanel.addEventListener('click', () => this.closeOrderDetails());
        if (closeCategoryPanel) closeCategoryPanel.addEventListener('click', () => this.closeCategoryDetails());
        if (closeCustomerPanel) closeCustomerPanel.addEventListener('click', () => this.closeCustomerDetails());
        if (closeFarmerPanel) closeFarmerPanel.addEventListener('click', () => this.closeFarmerDetails());
        if (closeProductApprovalPanel) closeProductApprovalPanel.addEventListener('click', () => this.closeProductApprovalDetails());

        // Users in-section filter - use API search across all pages
        const usersSearchBtn = document.getElementById('users-search-btn');
        const usersSearchInput = document.getElementById('users-search-input');
        
        // Users status tabs
        document.querySelectorAll('.users-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.users-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('users');
                this.loadUsers(1);
            });
        });
        
        if (usersSearchBtn) usersSearchBtn.addEventListener('click', () => this.loadUsers(1));
        if (usersSearchInput) usersSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadUsers(1); });

        // Products in-section filter - use API search across all pages
        const productsSearchBtn = document.getElementById('products-search-btn');
        const productsSearchInput = document.getElementById('products-search-input');
        const productsCatFilter = document.getElementById('products-category-filter');
        
        // Products status tabs
        document.querySelectorAll('.products-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.products-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('products');
                this.loadProducts(1);
            });
        });
        
        if (productsSearchBtn) productsSearchBtn.addEventListener('click', () => this.loadProducts(1));
        if (productsSearchInput) productsSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadProducts(1); });
        if (productsCatFilter) productsCatFilter.addEventListener('change', () => this.loadProducts(1));

        // Farmers in-section filter - use API search across all pages
        const farmersSearchBtn = document.getElementById('farmers-search-btn');
        const farmersSearchInput = document.getElementById('farmers-search-input');
        const farmersVerificationFilter = document.getElementById('farmers-verification-filter');
        
        // Farmers status tabs
        document.querySelectorAll('.farmers-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.farmers-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('farmers');
                this.loadFarmers('all', 1);
            });
        });
        
        if (farmersSearchBtn) farmersSearchBtn.addEventListener('click', () => this.loadFarmers('all', 1));
        if (farmersSearchInput) farmersSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadFarmers('all', 1); });
        if (farmersVerificationFilter) farmersVerificationFilter.addEventListener('change', () => this.loadFarmers('all', 1));

        // Audit logs filters - auto-apply on change
        const logsSearchBtn = document.getElementById('logs-search-btn');
        const logsActionFilter = document.getElementById('logs-action-filter');
        const logsEntityFilter = document.getElementById('logs-entity-filter');
        const logsActorFilter = document.getElementById('logs-actor-filter');
        const logsDateFrom  = document.getElementById('logs-date-from');
        const logsDateTo    = document.getElementById('logs-date-to');
        if (logsSearchBtn) logsSearchBtn.addEventListener('click', () => this.loadAuditLogs());
        if (logsActionFilter) logsActionFilter.addEventListener('change', () => this.loadAuditLogs());
        if (logsEntityFilter) logsEntityFilter.addEventListener('change', () => this.loadAuditLogs());
        if (logsActorFilter) logsActorFilter.addEventListener('change', () => this.loadAuditLogs());
        if (logsDateFrom) logsDateFrom.addEventListener('change', () => this.loadAuditLogs());
        if (logsDateTo)   logsDateTo.addEventListener('change', () => this.loadAuditLogs());

        // ── Clear + Refresh buttons ─────────────────────────────────────────
        document.getElementById('orders-refresh-btn')?.addEventListener('click', () => {
            ['order-price-filter','order-sort-filter','order-search-input'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = ''); }
            });
            // Reset order tabs to first tab (All)
            document.querySelectorAll('.order-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.order-tabs .tab-btn')?.classList.add('active');
            this.loadOrders();
            this.showToast('Orders refreshed', 'success');
        });

        document.getElementById('products-refresh-btn')?.addEventListener('click', () => {
            const searchInput = document.getElementById('products-search-input');
            const categoryFilter = document.getElementById('products-category-filter');
            if (searchInput) searchInput.value = '';
            if (categoryFilter) categoryFilter.value = '';
            // Reset products tabs to first tab (All)
            document.querySelectorAll('.products-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            const defaultTab = document.querySelector('.products-tabs .tab-btn[data-status=""]');
            if (defaultTab) defaultTab.classList.add('active');
            this.loadProducts();
            this.showToast('Listings refreshed', 'success');
        });

        document.getElementById('categories-refresh-btn')?.addEventListener('click', () => {
            const s = document.getElementById('category-search-input'); if (s) s.value = '';
            // Reset categories tabs to first tab (All)
            document.querySelectorAll('.categories-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.categories-tabs .tab-btn')?.classList.add('active');
            this.loadCategories();
            this.showToast('Categories refreshed', 'success');
        });

        document.getElementById('catalog-refresh-btn')?.addEventListener('click', () => {
            const s = document.getElementById('catalog-search-input'); if (s) s.value = '';
            const f = document.getElementById('catalog-category-filter-bar'); if (f) f.selectedIndex = 0;
            // Reset catalog tabs to first tab (All)
            document.querySelectorAll('.catalog-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.catalog-tabs .tab-btn')?.classList.add('active');
            this.loadCatalogNames();
            this.showToast('Catalog refreshed', 'success');
        });

        document.getElementById('users-refresh-btn')?.addEventListener('click', () => {
            ['users-search-input'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = ''); }
            });
            // Reset users tabs to first tab (All)
            document.querySelectorAll('.users-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.users-tabs .tab-btn')?.classList.add('active');
            this.loadUsers();
            this.showToast('Customers refreshed', 'success');
        });

        // Admin in-section filters
        const adminSearchBtn = document.getElementById('admin-search-btn');
        const adminSearchInput = document.getElementById('admin-search-input');
        const adminVerificationFilter = document.getElementById('admin-verification-filter');
        
        // Admin status tabs
        document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('admin');
                this.loadAdmin(1);
            });
        });
        
        if (adminSearchBtn) adminSearchBtn.addEventListener('click', () => this.loadAdmin(1));
        if (adminSearchInput) adminSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadAdmin(1); });
        if (adminVerificationFilter) adminVerificationFilter.addEventListener('change', () => this.loadAdmin(1));

        document.getElementById('admin-refresh-btn')?.addEventListener('click', () => {
            ['admin-search-input','admin-verification-filter'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = ''); }
            });
            // Reset admin tabs to first tab (All)
            document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.admin-tabs .tab-btn')?.classList.add('active');
            this.loadAdmin();
            this.showToast('Admin refreshed', 'success');
        });

        // All Users in-section filters
        const allUsersSearchBtn = document.getElementById('all-users-search-btn');
        const allUsersSearchInput = document.getElementById('all-users-search-input');
        const allUsersRoleFilter = document.getElementById('all-users-role-filter');
        const allUsersVerificationFilter = document.getElementById('all-users-verification-filter');
        
        // All Users status tabs
        document.querySelectorAll('.all-users-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.all-users-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('all-users');
                this.loadAllUsers(1);
            });
        });
        
        if (allUsersSearchBtn) allUsersSearchBtn.addEventListener('click', () => this.loadAllUsers(1));
        if (allUsersSearchInput) allUsersSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.loadAllUsers(1); });
        if (allUsersRoleFilter) allUsersRoleFilter.addEventListener('change', () => this.loadAllUsers(1));
        if (allUsersVerificationFilter) allUsersVerificationFilter.addEventListener('change', () => this.loadAllUsers(1));

        document.getElementById('all-users-refresh-btn')?.addEventListener('click', () => {
            ['all-users-search-input','all-users-role-filter','all-users-verification-filter'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = ''); }
            });
            // Reset all-users tabs to first tab (All)
            document.querySelectorAll('.all-users-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.all-users-tabs .tab-btn')?.classList.add('active');
            this.loadAllUsers();
            this.showToast('All users refreshed', 'success');
        });

        document.getElementById('farmers-refresh-btn')?.addEventListener('click', () => {
            ['farmers-search-input','farmers-verification-filter'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = ''); }
            });
            // Reset farmers tabs to first tab (All)
            document.querySelectorAll('.farmers-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.farmers-tabs .tab-btn')?.classList.add('active');
            this.loadFarmers();
            this.showToast('Farmers refreshed', 'success');
        });

        document.getElementById('logs-refresh-btn')?.addEventListener('click', () => {
            ['logs-action-filter','logs-entity-filter','logs-actor-filter','logs-date-from','logs-date-to'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.value = ''; }
            });
            this.loadAuditLogs();
            this.showToast('Audit logs refreshed', 'success');
        });

        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-close-modal');
                if (target) this.closeModal(target);
            });
        });

        // Format phone input with spaces (9XX XXX XXXX)
        ['pe-phone', 'edit-user-phone', 'create-user-phone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    // Remove non-digits
                    let digits = el.value.replace(/\D/g, '');
                    // Limit to 10 digits
                    if (digits.length > 10) digits = digits.slice(0, 10);
                    // Format as 9XX XXX XXXX
                    if (digits.length > 0) {
                        let formatted = digits[0];
                        if (digits.length > 1) formatted += digits.slice(1, 3);
                        if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
                        if (digits.length > 6) formatted += ' ' + digits.slice(6, 10);
                        el.value = formatted;
                    } else {
                        el.value = '';
                    }
                });
            }
        });

        const editUserForm = document.getElementById('edit-user-form');
        if (editUserForm) editUserForm.addEventListener('submit', (e) => this.submitUserEdit(e));

        document.getElementById('open-create-user-modal')?.addEventListener('click', () => this.openCreateUserModal('customer'));
        document.getElementById('open-create-farmer-modal')?.addEventListener('click', () => this.openCreateUserModal('farmer'));
        document.getElementById('create-admin-btn')?.addEventListener('click', () => this.openCreateUserModal('admin'));
        document.getElementById('create-any-user-btn')?.addEventListener('click', () => this.openCreateUserModal('customer'));
        document.getElementById('create-user-form')?.addEventListener('submit', (e) => this.submitUserCreate(e));
        const createUserPwToggle = document.getElementById('create-user-pw-toggle');
        const createUserPwInput  = document.getElementById('create-user-password');
        if (createUserPwToggle && createUserPwInput) {
            createUserPwToggle.addEventListener('click', () => {
                const show = createUserPwInput.type === 'password';
                createUserPwInput.type = show ? 'text' : 'password';
                const icon = createUserPwToggle.querySelector('i');
                if (icon) icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }

        const editUserPwToggle = document.getElementById('edit-user-pw-toggle');
        const editUserPwInput  = document.getElementById('edit-user-password');
        if (editUserPwToggle && editUserPwInput) {
            editUserPwToggle.addEventListener('click', () => {
                const show = editUserPwInput.type === 'password';
                editUserPwInput.type = show ? 'text' : 'password';
                const icon = editUserPwToggle.querySelector('i');
                if (icon) icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        }

        // Rejection modal event listeners
        document.getElementById('reject-product-modal-close')?.addEventListener('click', () => {
            const modal = document.getElementById('reject-product-modal');
            if (modal) modal.classList.remove('open');
        });
        document.getElementById('reject-product-cancel')?.addEventListener('click', () => {
            const modal = document.getElementById('reject-product-modal');
            if (modal) modal.classList.remove('open');
        });
        document.getElementById('reject-product-confirm')?.addEventListener('click', () => this.confirmRejectProduct());

        const editProductForm = document.getElementById('edit-product-form');
        if (editProductForm) editProductForm.addEventListener('submit', (e) => this.submitProductEdit(e));

        document.getElementById('create-category-btn')?.addEventListener('click', () => this.createCategory());
        document.getElementById('add-catalog-name-btn')?.addEventListener('click', () => this.addCatalogName());
        document.getElementById('send-announcement-btn')?.addEventListener('click', () => this.sendAnnouncement());

        // "Add Category" button → open the modal
        document.getElementById('show-add-category-form')?.addEventListener('click', () => {
            document.getElementById('add-category-modal')?.classList.add('open');
        });
        document.getElementById('add-category-cancel')?.addEventListener('click', () => {
            document.getElementById('add-category-modal')?.classList.remove('open');
        });
        document.getElementById('add-category-modal-close')?.addEventListener('click', () => {
            document.getElementById('add-category-modal')?.classList.remove('open');
        });

        // "Add Catalog Product" button → open the modal
        document.getElementById('show-add-catalog-form')?.addEventListener('click', async () => {
            const modal = document.getElementById('add-catalog-modal');
            if (modal) {
                // Pre-load categories if not already loaded
                if (!this.lastCategories || this.lastCategories.length === 0) {
                    await this.loadCategories();
                }
                const sel = document.getElementById('catalog-category-select');
                const cats = this.lastCategories || [];
                if (sel) {
                    if (cats.length === 0) {
                        this.showMessage('No categories available. Please create a category first.', 'error');
                        return;
                    }
                    sel.innerHTML = cats.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
                }
                modal.classList.add('open');
            }
        });
        document.getElementById('add-catalog-cancel')?.addEventListener('click', () => {
            document.getElementById('add-catalog-modal')?.classList.remove('open');
        });
        document.getElementById('add-catalog-modal-close')?.addEventListener('click', () => {
            document.getElementById('add-catalog-modal')?.classList.remove('open');
        });

        // Category-requests filter search button
        document.getElementById('cat-req-search-btn')?.addEventListener('click', () => {
            this.resetPaginationPage('category-requests');
            this.loadCategoryRequests(undefined, undefined, 1);
        });
        document.getElementById('cat-req-search-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.resetPaginationPage('category-requests');
                this.loadCategoryRequests(undefined, undefined, 1);
            }
        });
        document.getElementById('cat-req-refresh-btn')?.addEventListener('click', () => {
            const s = document.getElementById('cat-req-search-input'); if (s) s.value = '';
            // Reset tabs to first tab (All)
            const tabsContainer = document.querySelector('.category-request-tabs');
            if (tabsContainer) {
                tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabsContainer.querySelector('.tab-btn[data-status="all"]')?.classList.add('active');
            }
            this.loadCategoryRequests();
            this.showToast('Product name requests refreshed', 'success');
        });

        // Product-approvals filter search button
        document.getElementById('product-approval-search-btn')?.addEventListener('click', () => {
            this.resetPaginationPage('product-approvals');
            this.loadProductApprovals(undefined, undefined, 1);
        });
        document.getElementById('product-approval-search-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.resetPaginationPage('product-approvals');
                this.loadProductApprovals(undefined, undefined, 1);
            }
        });
        document.getElementById('product-approval-refresh-btn')?.addEventListener('click', () => {
            // Reset tabs to first tab (All)
            const tabsContainer = document.querySelector('.product-approval-tabs');
            if (tabsContainer) {
                tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabsContainer.querySelector('.tab-btn[data-status="all"]')?.classList.add('active');
            }
            this.loadProductApprovals();
            this.showToast('Product approvals refreshed', 'success');
        });

        // Category search filter
        document.getElementById('category-search-btn')?.addEventListener('click', () => {
            this.resetPaginationPage('categories');
            this.loadCategories(1);
        });
        document.getElementById('category-search-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('category-search-btn')?.click();
        });
        
        // Categories status tabs
        document.querySelectorAll('.categories-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.categories-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.resetPaginationPage('categories');
                this.loadCategories(1);
            });
        });

        // Catalog (catalog-products) search + category filter + status filter
        const runCatalogFilter = () => {
            this.resetPaginationPage('catalog-products');
            this.loadCatalogNames(1);
        };
        document.getElementById('catalog-search-btn')?.addEventListener('click', runCatalogFilter);
        document.getElementById('catalog-search-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runCatalogFilter();
        });
        document.getElementById('catalog-category-filter-bar')?.addEventListener('change', runCatalogFilter);
        
        // Catalog status tabs
        document.querySelectorAll('.catalog-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.catalog-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                runCatalogFilter();
            });
        });

        // Superadmin section buttons
        document.getElementById('detect-patterns-btn')?.addEventListener('click', () => this.loadSuspiciousPatterns());
        document.getElementById('refresh-flagged-btn')?.addEventListener('click', () => this.loadFlaggedUsers());
        document.getElementById('seclog-refresh-btn')?.addEventListener('click', () => this.loadSecurityLog());
        document.getElementById('flags-refresh-btn')?.addEventListener('click', () => this.loadFeatureFlags());
        document.getElementById('refresh-status-btn')?.addEventListener('click', () => this.loadServiceStatus());

        // Security log filters - auto-apply on change
        document.getElementById('seclog-action-filter')?.addEventListener('change', () => this.loadSecurityLog());
        document.getElementById('seclog-date-from')?.addEventListener('change', () => this.loadSecurityLog());
        document.getElementById('seclog-date-to')?.addEventListener('change', () => this.loadSecurityLog());

        // Entries-per-page selects
        document.addEventListener('change', (e) => {
            const sel = e.target.closest('[data-entries-section]');
            if (!sel) return;
            const section = sel.getAttribute('data-entries-section');
            const limit = Number(sel.value) || 50;
            if (this.pagination[section]) {
                this.pagination[section].limit = limit;
                this.pagination[section].page  = 1;
            }
            const loaders = {
                'orders': () => this.loadOrders(),
                'users': () => this.loadUsers(),
                'products': () => this.loadProducts(),
                'farmers': () => this.loadFarmers(),
                'categories': () => this.loadCategories(),
                'catalog-products': () => this.loadCatalogNames(),
                'category-requests': () => this.loadCategoryRequests(),
                'product-approvals': () => this.loadProductApprovals(),
                'verification-requests': () => this.loadVerificationRequests(1, this.verificationCurrentStatus || 'all'),
                'logs': () => this.loadAuditLogs(),
                'activity': () => this.loadRecentActivity(this._activityPeriod || 'today'),
                'top-products': () => this.loadTopProducts(this._topProductsPeriod || 'today'),
                'top-farmers': () => this.loadTopFarmers(this._topFarmersPeriod || 'today'),
                'recent-sales': () => this.loadRecentSales(this._recentSalesPeriod || 'today'),
                'admin': () => this.loadAdmin(),
                'all-users': () => this.loadAllUsers(),
                'security-log': () => this.loadSecurityLog(),
            };
            loaders[section]?.();
        });

        // Profile forms
        document.getElementById('profile-edit-form')?.addEventListener('submit', (e) => this.submitProfileEdit(e));
        document.getElementById('profile-password-form')?.addEventListener('submit', (e) => this.submitProfilePassword(e));

        this.syncPanelAccessibility();
    }

    syncPanelAccessibility() {
        const panels = [
            document.getElementById('order-detail-panel'),
            document.getElementById('category-detail-panel'),
            document.getElementById('customer-detail-panel'),
            document.getElementById('farmer-detail-panel'),
            document.getElementById('category-edit-panel'),
            document.getElementById('catalog-edit-panel'),
            document.getElementById('edit-product-panel')
        ].filter(Boolean);

        panels.forEach((panel) => {
            const isActive = panel.classList.contains('active');
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            panel.hidden = !isActive;
            if (isActive) {
                panel.removeAttribute('inert');
            } else {
                panel.setAttribute('inert', '');
            }
        });
    }

    async loadAdminsForLogs() {
        try {
            const params = new URLSearchParams();
            if (this.currentUserRole === 'admin') {
                params.set('role', 'admin');
            }
            const response = await fetch(`${this.apiBase}/admin/users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const users = data.users || data || [];
            const select = document.getElementById('logs-actor-filter');
            if (!select) return;

            // Keep the "All admins" option
            select.innerHTML = '<option value="">All admins</option>';

            // Filter to only show admin and super_admin users
            const admins = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
            admins.forEach(admin => {
                const option = document.createElement('option');
                option.value = admin.id;
                option.textContent = `${admin.full_name || admin.username} (ID: ${admin.id})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading admins for logs:', error);
        }
    }

    async loadAuditLogs(page = 1) {
        try {
            const pg = this.pagination.logs;
            pg.page = page;
            const actor_admin_id = document.getElementById('logs-actor-filter')?.value?.trim();
            const action  = document.getElementById('logs-action-filter')?.value?.trim();
            const entity  = document.getElementById('logs-entity-filter')?.value?.trim();
            const dateFrom = document.getElementById('logs-date-from')?.value?.trim();
            const dateTo   = document.getElementById('logs-date-to')?.value?.trim();

            const params = new URLSearchParams();
            params.set('limit', String(pg.limit));
            params.set('page', String(pg.page));
            if (actor_admin_id) params.set('actor_admin_id', actor_admin_id);
            if (action) params.set('action', action);
            if (entity) params.set('entity', entity);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo)   params.set('date_to', dateTo);

                const response = await fetch(`${this.apiBase}/admin/logs?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            this._lastLogs = data.logs || [];
            pg.total = Number(data.pagination?.total || 0);
            this.renderAuditLogs(this._lastLogs);
            this.renderPagination('logs-pagination', pg, (p) => this.loadAuditLogs(p));
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    }

    renderAuditLogs(logs) {
        this.destroySortableTable('logs-table');
        this._lastLogs = logs || [];
        const tbody = document.getElementById('logs-tbody');
        if (!tbody) return;

        let sortedLogs = logs || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_logs-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedLogs.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        case 1: // actor name
                            valA = (a.actor_admin_name || a.actor_admin_email || '').toLowerCase();
                            valB = (b.actor_admin_name || b.actor_admin_email || '').toLowerCase();
                            break;
                        case 2: // actor email
                            valA = (a.actor_admin_email || '').toLowerCase();
                            valB = (b.actor_admin_email || '').toLowerCase();
                            break;
                        case 3: // action
                            valA = (a.action || '').toLowerCase();
                            valB = (b.action || '').toLowerCase();
                            break;
                        case 4: // entity
                            valA = (a.entity || '').toLowerCase();
                            valB = (b.entity || '').toLowerCase();
                            break;
                        case 5: // entity_id
                            valA = a.entity_id || 0;
                            valB = b.entity_id || 0;
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedLogs.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No logs found.</td></tr>`;
            this.refreshSortableTable('logs-table', { columns: [{ select: 6, sortable: false }] });
            return;
        }

        const colorIcons = {
            success: 'bi-check-circle-fill text-success',
            primary: 'bi-pencil-fill text-primary',
            danger: 'bi-x-circle-fill text-danger',
            warning: 'bi-exclamation-circle-fill text-warning',
            info: 'bi-info-circle-fill text-info',
            secondary: 'bi-circle text-secondary',
        };

        const getColor = (action) => {
            if (action.includes('unverify') || action.includes('disable') || action.includes('reject') || action.includes('delete')) return 'danger';
            if (action.includes('create') || action.includes('verify') || action.includes('approve') || action.includes('enable')) return 'success';
            if (action.includes('update') || action.includes('status')) return 'primary';
            if (action.includes('login')) return 'info';
            return 'secondary';
        };

        tbody.innerHTML = sortedLogs.map(log => {
            const actor = log.actor_admin_name || log.actor_admin_email || `Admin #${log.actor_admin_id}`;
            const email = log.actor_admin_email || '—';
            const color = getColor(log.action || '');
            const iconClass = colorIcons[color] || 'bi-circle text-secondary';
            const detailBtn = `<button class="btn btn-sm py-0 px-2 btn-ac-green audit-log-view-btn" data-log-id="${log.id}">View</button>`;
            return `
            <tr>
                <td class="text-muted small">${log.created_at ? new Date(log.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td>${this.escapeHtml(actor)}</td>
                <td class="text-muted small">${this.escapeHtml(email)}</td>
                <td><i class="bi ${iconClass} me-1"></i>${this.escapeHtml(this.humanizeAction(log.action))}</td>
                <td>${this.escapeHtml(log.entity)}</td>
                <td>${log.entity_id || '—'}</td>
                <td>${detailBtn}</td>
            </tr>`;
        }).join('');

        this.refreshSortableTable('logs-table', { columns: [{ select: 6, sortable: false }] });
    }

    openAuditLogDetailModalById(id) {
        // First check if log is in _lastLogs for immediate display
        const cachedLog = (this._lastLogs || []).find(l => l.id === id);
        if (cachedLog) {
            this.openAuditLogDetailModal(cachedLog);
            return;
        }
        // Otherwise fetch from API
        this.fetchAuditLogDetail(id);
    }

    async fetchAuditLogDetail(id) {
        try {
            const res = await fetch(`/api/admin/audit-logs/${id}`);
            if (!res.ok) throw new Error('Failed to fetch audit log');
            const data = await res.json();
            this.openAuditLogDetailModal(data.log);
        } catch (err) {
            console.error('Fetch audit log detail error:', err);
            alert('Failed to load audit log details');
        }
    }

    openAuditLogDetailModal(log) {
        if (typeof bootstrap === 'undefined') return;
        const modal = document.getElementById('audit-log-detail-modal');
        if (!modal) return;

        const metaEl = document.getElementById('ald-meta');
        const securityEl = document.getElementById('ald-security');
        const beforeEl = document.getElementById('ald-before');
        const afterEl  = document.getElementById('ald-after');
        const diffEl   = document.getElementById('ald-diff');
        const jsonView = document.getElementById('ald-json-view');
        const diffView = document.getElementById('ald-diff-view');
        const toggleBtn = document.getElementById('ald-toggle-diff');

        // Dynamic color logic (same as Recent Activity)
        const getColor = (action) => {
            if (action.includes('unverify') || action.includes('disable') || action.includes('reject') || action.includes('delete')) return 'danger';
            if (action.includes('create') || action.includes('verify') || action.includes('approve') || action.includes('enable')) return 'success';
            if (action.includes('update') || action.includes('status')) return 'primary';
            if (action.includes('login')) return 'info';
            return 'secondary';
        };
        const color = getColor(log.action || '');
        const time = log.created_at ? new Date(log.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

        if (metaEl) metaEl.innerHTML = `
            <div class="col-auto"><span class="audit-badge audit-badge-${color}">${this.escapeHtml(this.humanizeAction(log.action || ''))}</span></div>
            ${log.entity ? `<div class="col-auto"><span class="badge bg-light text-dark">${this.escapeHtml(log.entity)}</span></div>` : ''}
            ${log.entity_id != null ? `<div class="col-auto"><span class="badge bg-secondary-subtle text-secondary">ID: ${log.entity_id}</span></div>` : ''}
            <div class="col-auto"><span class="badge bg-light text-muted small">${time}</span></div>
            ${log.actor_admin_name ? `<div class="col-auto"><span class="badge bg-info-subtle text-info small"><i class="bi bi-person me-1"></i>${this.escapeHtml(log.actor_admin_name)}</span></div>` : ''}
            ${log.actor_admin_email ? `<div class="col-auto"><span class="badge bg-secondary-subtle text-secondary small"><i class="bi bi-envelope me-1"></i>${this.escapeHtml(log.actor_admin_email)}</span></div>` : ''}
        `;

        // Security fields
        if (securityEl) {
            const securityBadges = [];
            if (log.ip_address) securityBadges.push(`<div class="col-auto"><span class="badge bg-secondary-subtle text-secondary small"><i class="bi bi-globe me-1"></i>${this.escapeHtml(log.ip_address)}</span></div>`);
            if (log.session_id) securityBadges.push(`<div class="col-auto"><span class="badge bg-warning-subtle text-warning small"><i class="bi bi-key me-1"></i>${this.escapeHtml(log.session_id)}</span></div>`);
            if (log.user_agent) securityBadges.push(`<div class="col-auto"><span class="badge bg-secondary-subtle text-secondary small" data-bs-toggle="tooltip" data-bs-placement="top" title="${this.escapeHtml(log.user_agent)}"><i class="bi bi-browser me-1"></i>${this.escapeHtml(log.user_agent.substring(0, 50))}${log.user_agent.length > 50 ? '...' : ''}</span></div>`);
            securityEl.innerHTML = securityBadges.join('') || '<div class="col-auto"><span class="text-muted small">No security info available</span></div>';
        }

        // Pretty-print JSON with syntax highlighting
        if (beforeEl) beforeEl.innerHTML = log.before ? this.formatJson(log.before) : '—';
        if (afterEl)  afterEl.innerHTML  = log.after  ? this.formatJson(log.after) : '—';

        // Generate diff
        if (diffEl) {
            const diffHtml = this.generateDiff(log.before, log.after);
            diffEl.innerHTML = diffHtml || '—';
        }

        // Reset view to JSON
        if (jsonView) jsonView.classList.remove('d-none');
        if (diffView) diffView.classList.add('d-none');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="bi bi-code-diff me-1"></i>Show Diff';
            toggleBtn.onclick = () => this.toggleDiffView();
        }

        const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
        bsModal.show();

        // Initialize tooltips for new elements
        const tooltipTriggerList = modal.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }

    toggleDiffView() {
        const jsonView = document.getElementById('ald-json-view');
        const diffView = document.getElementById('ald-diff-view');
        const toggleBtn = document.getElementById('ald-toggle-diff');

        if (jsonView.classList.contains('d-none')) {
            // Show JSON view
            jsonView.classList.remove('d-none');
            diffView.classList.add('d-none');
            toggleBtn.innerHTML = '<i class="bi bi-code-diff me-1"></i>Show Diff';
        } else {
            // Show diff view
            jsonView.classList.add('d-none');
            diffView.classList.remove('d-none');
            toggleBtn.innerHTML = '<i class="bi bi-list me-1"></i>Show JSON';
        }
    }

    generateDiff(before, after) {
        if (!before && !after) return null;
        if (!before) return `<span class="text-success">+ New entry</span>\n${this.formatJson(after)}`;
        if (!after) return `<span class="text-danger">- Deleted entry</span>\n${this.formatJson(before)}`;

        const beforeStr = JSON.stringify(before, null, 2);
        const afterStr = JSON.stringify(after, null, 2);

        if (beforeStr === afterStr) return '<span class="text-muted">No changes detected</span>';

        // Simple line-by-line diff
        const beforeLines = beforeStr.split('\n');
        const afterLines = afterStr.split('\n');
        let diff = '';

        const maxLen = Math.max(beforeLines.length, afterLines.length);
        for (let i = 0; i < maxLen; i++) {
            const beforeLine = beforeLines[i] || '';
            const afterLine = afterLines[i] || '';

            if (beforeLine === afterLine) {
                diff += this.formatJsonLine(beforeLine) + '\n';
            } else {
                if (beforeLine) diff += `<span class="text-danger">- ${this.escapeHtml(beforeLine)}</span>\n`;
                if (afterLine) diff += `<span class="text-success">+ ${this.escapeHtml(afterLine)}</span>\n`;
            }
        }

        return diff;
    }

    formatJsonLine(line) {
        return line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(".*?")/g, '<span class="text-success">$1</span>')
            .replace(/(\d+)/g, '<span class="text-primary">$1</span>')
            .replace(/(true|false|null)/g, '<span class="text-danger">$1</span>');
    }

    humanizeAction(action) {
        const map = {
            'user.create': 'Created user', 'user.update': 'Updated user',
            'user.disable': 'Disabled user', 'user.enable': 'Enabled user',
            'user.verify': 'Verified farmer', 'user.unverify': 'Unverified farmer',
            'user.shop_profile.update': 'Updated shop profile',
            'user.generate_temp_password': 'Generated temp password',
            'user.role.update': 'Updated user role',
            'user.login': 'Admin login',
            'product.create': 'Added product', 'product.update': 'Updated product',
            'product.disable': 'Disabled product', 'product.enable': 'Enabled product',
            'product.assign': 'Reassigned product',
            'order.status.update': 'Updated pre-order status', 'order.disable': 'Disabled pre-order',
            'order.enable': 'Enabled pre-order',
            'category.create': 'Created category', 'category.update': 'Updated category',
            'category.disable': 'Disabled category', 'category.enable': 'Enabled category',
            'category.delete': 'Deleted category',
            'catalog_name.create': 'Added catalog name', 'catalog_name.update': 'Updated catalog name',
            'catalog_name.disable': 'Disabled catalog name', 'catalog_name.enable': 'Enabled catalog name',
            'category.request.review': 'Reviewed name request',
            'announcement.broadcast': 'Broadcast announcement',
            'settings.update': 'Updated settings',
            'feature_flag.update': 'Updated feature flag',
        };
        return map[action] || action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    formatJson(obj) {
        const json = JSON.stringify(obj, null, 2);
        // Simple syntax highlighting
        return json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(".*?")/g, '<span class="text-success">$1</span>')
            .replace(/(\d+)/g, '<span class="text-primary">$1</span>')
            .replace(/(true|false|null)/g, '<span class="text-danger">$1</span>');
    }

    _periodLabel(period) {
        const map = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };
        return map[period] || period;
    }

    _comparisonLabel(period) {
        const map = { today: 'vs prev today', week: 'vs prev week', month: 'vs prev month', year: 'vs prev year', all: '' };
        return map[period] || 'vs prev today';
    }

    _restorePeriods() {
        try {
            const saved = localStorage.getItem('adminDashboardPeriods');
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed.kpiPeriods) this._kpiPeriods = { ...this._kpiPeriods, ...parsed.kpiPeriods };
            if (parsed.reportPeriod) this._reportPeriod = parsed.reportPeriod;
            if (parsed.activityPeriod) this._activityPeriod = parsed.activityPeriod;
            if (parsed.topProductsPeriod) this._topProductsPeriod = parsed.topProductsPeriod;
            if (parsed.topFarmersPeriod) this._topFarmersPeriod = parsed.topFarmersPeriod;
            if (parsed.recentSalesPeriod) this._recentSalesPeriod = parsed.recentSalesPeriod;
        } catch (_) {}
    }

    _savePeriods() {
        try {
            localStorage.setItem('adminDashboardPeriods', JSON.stringify({
                kpiPeriods: this._kpiPeriods,
                reportPeriod: this._reportPeriod,
                activityPeriod: this._activityPeriod,
                topProductsPeriod: this._topProductsPeriod,
                topFarmersPeriod: this._topFarmersPeriod,
                recentSalesPeriod: this._recentSalesPeriod,
            }));
        } catch (_) {}
    }

    _periodToDates(period) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const today = fmt(now);
        if (period === 'today') return { date_from: today, date_to: today };
        if (period === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 6); return { date_from: fmt(d), date_to: today }; }
        if (period === 'month') { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { date_from: fmt(d), date_to: today }; }
        if (period === 'year')  { const d = new Date(now.getFullYear(), 0, 1); return { date_from: fmt(d), date_to: today }; }
        return {}; // all time — no date restriction
    }

    async loadDashboardStats() {
        // Load all KPI cards with their saved periods
        for (const [card, period] of Object.entries(this._kpiPeriods)) {
            this.loadKpiCard(card, period);
        }
        // Load other dashboard widgets with saved periods
        this.loadReportsChart(this._reportPeriod);
        this.loadRecentActivity(this._activityPeriod);
        this.loadTopProducts(this._topProductsPeriod);
        this.loadTopFarmers(this._topFarmersPeriod);
        this.loadRecentSales(this._recentSalesPeriod);

        // Update visible period labels to match restored values
        const reportLbl = document.getElementById('reports-period-label');
        if (reportLbl) reportLbl.textContent = `| ${this._periodLabel(this._reportPeriod)}`;
        const activityLbl = document.getElementById('activity-period-label');
        if (activityLbl) activityLbl.textContent = `| ${this._periodLabel(this._activityPeriod)}`;
        const topProdLbl = document.getElementById('top-products-period-label');
        if (topProdLbl) topProdLbl.textContent = `| ${this._periodLabel(this._topProductsPeriod)}`;
        const topFarmLbl = document.getElementById('top-farmers-period-label');
        if (topFarmLbl) topFarmLbl.textContent = `| ${this._periodLabel(this._topFarmersPeriod)}`;
        const recentSalesLbl = document.getElementById('recent-sales-period-label');
        if (recentSalesLbl) recentSalesLbl.textContent = `| ${this._periodLabel(this._recentSalesPeriod)}`;
    }

    async loadKpiCard(card, period) {
        try {
            const res = await fetch(`${this.apiBase}/admin/dashboard/stats?period=${period}&metric=${card}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { stats } = await res.json();

            const periodLabel = this._periodLabel(period);
            const metric = card.replace('kpi-', '');

            const valEl = document.getElementById(`${card}-value`);
            const periodEl = document.getElementById(`${card}-period`);
            const changeEl = document.getElementById(`${card}-change`);
            const changeLabelEl = document.getElementById(`${card}-change-label`);

            if (periodEl) periodEl.textContent = `| ${periodLabel}`;
            if (valEl) {
                if (metric === 'revenue') {
                    valEl.textContent = this.fmtCurrency(stats.revenue ?? 0);
                } else if (metric === 'sales') {
                    valEl.textContent = this.fmtNumber(stats.sales ?? 0);
                } else if (metric === 'customers') {
                    valEl.textContent = this.fmtNumber(stats.customers ?? 0);
                } else if (metric === 'farmers') {
                    valEl.textContent = this.fmtNumber(stats.farmers ?? 0);
                }
            }

            const changeProp = metric + 'Change';
            const change = stats[changeProp] ?? 0;
            if (changeEl) {
                if (period !== 'all') {
                    const isPos = change >= 0;
                    changeEl.className = `small fw-bold ${isPos ? 'text-success' : 'text-danger'}`;
                    changeEl.textContent = `${isPos ? '+' : ''}${change}%`;
                } else {
                    changeEl.textContent = '';
                }
            }
            if (changeLabelEl) {
                if (period !== 'all') {
                    changeLabelEl.textContent = ` vs prev ${period}`;
                } else {
                    changeLabelEl.textContent = '';
                }
            }
        } catch (err) {
            console.warn('KPI card error:', err);
        }
    }

    async loadReportsChart(period) {
        try {
            const res = await fetch(`${this.apiBase}/admin/dashboard/report?period=${period}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { data } = await res.json();

            const el = document.getElementById('reportsChart');
            if (!el) return;

            if (this._reportsChart) {
                this._reportsChart.destroy();
                this._reportsChart = null;
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

            this._reportsChart = new ApexCharts(el, {
                series: [
                    { name: 'Revenue (₱)', data: data.map(d => parseFloat(d.revenue) || 0) },
                    { name: 'Sales', data: data.map(d => parseInt(d.sales) || 0) },
                    { name: 'Customers', data: data.map(d => parseInt(d.customers) || 0) },
                    { name: 'Farmers', data: data.map(d => parseInt(d.farmers) || 0) },
                ],
                chart: {
                    height: 350,
                    type: 'area',
                    toolbar: { show: false },
                },
                markers: { size: 4 },
                colors: ['#4154f1', '#2eca6a', '#ff771d', '#9b59b6'],
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
                stroke: { curve: 'smooth', width: 2 },
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
            });
            this._reportsChart.render();
        } catch (err) {
            console.warn('Reports chart error:', err);
        }
    }

    async loadRecentActivity(period, page = 1) {
        try {
            const pg = this.pagination.activity;
            pg.page = page;
            const params = new URLSearchParams({ period, page: String(page), limit: String(pg.limit) });
            const res = await fetch(`${this.apiBase}/admin/dashboard/recent-activity?${params}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { activity, total } = await res.json();
            this.lastActivity = activity || [];
            pg.total = Number(total || 0);
            this.renderRecentActivityList(this.lastActivity);
        } catch (err) {
            console.warn('Recent activity error:', err);
        }
    }

    async loadTopProducts(period, page = 1) {
        try {
            const pg = this.pagination['top-products'];
            pg.page = page;
            const params = new URLSearchParams({ period, page: String(page), limit: String(pg.limit) });
            const res = await fetch(`${this.apiBase}/admin/dashboard/top-products?${params}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { products, total } = await res.json();
            this.lastTopProducts = products || [];
            pg.total = Number(total || 0);
            this.renderTopProductsTable(this.lastTopProducts);
        } catch (err) {
            console.warn('Top products error:', err);
        }
    }

    async loadTopFarmers(period, page = 1) {
        try {
            const pg = this.pagination['top-farmers'];
            pg.page = page;
            const params = new URLSearchParams({ period, page: String(page), limit: String(pg.limit) });
            const res = await fetch(`${this.apiBase}/admin/dashboard/top-farmers?${params}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { farmers, total } = await res.json();
            this.lastTopFarmers = farmers || [];
            pg.total = Number(total || 0);
            this.renderTopFarmersTable(this.lastTopFarmers);
        } catch (err) {
            console.warn('Top farmers error:', err);
        }
    }

    async loadRecentSales(period, page = 1) {
        try {
            const dates = this._periodToDates(period || 'today');
            const pg = this.pagination['recent-sales'];
            pg.page = page;
            const params = new URLSearchParams({ page: String(page), limit: String(pg.limit) });
            if (dates.date_from) params.set('date_from', dates.date_from);
            if (dates.date_to)   params.set('date_to',   dates.date_to);
            const res = await fetch(`${this.apiBase}/admin/orders?${params}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { orders, total } = await res.json();
            this.lastRecentSales = orders || [];
            pg.total = Number(total || 0);
            this.renderRecentSalesTable(this.lastRecentSales);
        } catch (err) {
            console.warn('Recent sales error:', err);
        }
    }

    async loadUsers(page = 1) {
        try {
            const pg = this.pagination.users;
            pg.page = page;
            const search = (document.getElementById('users-search-input')?.value || '').trim();
            const activeTab = document.querySelector('.users-tabs .tab-btn.active');
            const status = activeTab ? activeTab.getAttribute('data-status') : '';
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit),
                role: 'customer'
            });
            if (search) params.set('search', search);
            if (status) params.set('status', status);

            const response = await fetch(`${this.apiBase}/admin/users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastUsers = data.users || [];
                pg.total = Number(data.total || 0);
                this.renderUsers(this.lastUsers);
                this.renderPagination('users-pagination', pg, (p) => this.loadUsers(p));
            } else {
                const tbody = document.getElementById('users-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load users. Please try again.</td></tr>`;
                this.showMessage('Failed to load users', 'error');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            const tbody = document.getElementById('users-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load users. Please try again.</td></tr>`;
            this.showMessage('Failed to load users', 'error');
        }
    }

    // Kept for backward compat (called by realtime events etc.)
    renderUsersFiltered() { this.applyUsersFilter(); }

    async loadOrders(page = 1) {
        try {
            const pg = this.pagination?.orders || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const activeTab = document.querySelector('.order-tabs .tab-btn.active');
            const status = activeTab ? activeTab.getAttribute('data-status') : '';
            const price = document.getElementById('order-price-filter')?.value || '';
            const sort = document.getElementById('order-sort-filter')?.value || 'date_desc';
            const search = (document.getElementById('order-search-input')?.value || '').trim();
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit),
                sort,
                t: String(Date.now())
            });
            if (status) params.set('status', status);
            if (search) params.set('search', search);
            if (price) {
                if (price === '3000+') {
                    params.set('min_total', '3000');
                } else {
                    const [min, max] = price.split('-').map(Number);
                    if (!Number.isNaN(min)) params.set('min_total', String(min));
                    if (!Number.isNaN(max)) params.set('max_total', String(max));
                }
            }
            const response = await fetch(`${this.apiBase}/admin/orders?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                this.lastOrders = data.orders || [];
                pg.total = Number(data.total || 0);
                this.renderOrders(this.lastOrders);
                this.renderPagination('orders-pagination', pg, (p) => this.loadOrders(p));
                // Update admin charts whenever orders are refreshed
                if (window.AdminCharts) window.AdminCharts.update(this.lastOrders);
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    applyUsersFilter() {
        const q      = (document.getElementById('users-search-input')?.value || '').trim().toLowerCase();
        const activeTab = document.querySelector('.users-tabs .tab-btn.active');
        const status = activeTab ? activeTab.getAttribute('data-status') : '';

        let users = [...(this.lastUsers || [])].filter(u => (u.role || '') === 'customer');
        if (q) {
            users = users.filter(u =>
                String(u.id || '').includes(q) ||
                String(u.full_name || '').toLowerCase().includes(q) ||
                String(u.username || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q)
            );
        }
        if (status === 'active') users = users.filter(u => !u.is_disabled);
        else if (status === 'suspended') users = users.filter(u => u.is_disabled && u.disable_type === 'suspended');
        else if (status === 'banned') users = users.filter(u => u.is_disabled && u.disable_type === 'banned');

        this.renderUsers(users);
    }

    applyFarmersFilter() {
        const q = (document.getElementById('farmers-search-input')?.value || '').trim().toLowerCase();
        const activeTab = document.querySelector('.farmers-tabs .tab-btn.active');
        const status = activeTab ? activeTab.getAttribute('data-status') : '';
        const verification = (document.getElementById('farmers-verification-filter')?.value || '').trim().toLowerCase();

        let farmers = [...(this.lastFarmers || [])];
        
        if (q) {
            farmers = farmers.filter(f =>
                String(f.id || '').includes(q) ||
                String(f.full_name || '').toLowerCase().includes(q) ||
                String(f.username || '').toLowerCase().includes(q) ||
                String(f.email || '').toLowerCase().includes(q)
            );
        }
        
        if (status === 'active') farmers = farmers.filter(f => !f.is_disabled);
        else if (status === 'disabled') farmers = farmers.filter(f => !!f.is_disabled);
        
        if (verification === 'verified') farmers = farmers.filter(f => !!f.is_verified);
        else if (verification === 'unverified') farmers = farmers.filter(f => !f.is_verified);

        this.renderFarmers(farmers);
    }

    applyProductsFilter() {
        const q = (document.getElementById('products-search-input')?.value || '').trim().toLowerCase();
        const catId = document.getElementById('products-category-filter')?.value || '';
        const activeTab = document.querySelector('.products-tabs .tab-btn.active');
        const status = activeTab ? activeTab.getAttribute('data-status') : '';

        let products = [...(this.lastProducts || [])];
        
        if (q) {
            products = products.filter(p =>
                String(p.id || '').includes(q) ||
                String(p.name || '').toLowerCase().includes(q) ||
                String(p.farmer_name || '').toLowerCase().includes(q)
            );
        }
        
        if (catId) {
            products = products.filter(p => String(p.category_id) === catId);
        }
        
        if (status === 'available') {
            products = products.filter(p => !p.is_admin_disabled && !p.farmer_is_disabled && p.is_available);
        } else if (status === 'disabled') {
            products = products.filter(p => p.is_admin_disabled || p.farmer_is_disabled || !p.is_available);
        }

        this.renderProducts(products);
    }

    renderUsers(users) {
        this.destroySortableTable('users-table');
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        let sortedUsers = users || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_users-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedUsers.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // full_name
                            valA = (a.full_name || '').toLowerCase();
                            valB = (b.full_name || '').toLowerCase();
                            break;
                        case 2: // username
                            valA = (a.username || '').toLowerCase();
                            valB = (b.username || '').toLowerCase();
                            break;
                        case 3: // email
                            valA = (a.email || '').toLowerCase();
                            valB = (b.email || '').toLowerCase();
                            break;
                        case 4: // status (is_disabled)
                            valA = a.is_disabled ? 1 : 0;
                            valB = b.is_disabled ? 1 : 0;
                            break;
                        case 5: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedUsers.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No users found</td></tr>`;
            this.refreshSortableTable('users-table', { columns: [{ select: 6, sortable: false }] });
            return;
        }
        tbody.innerHTML = sortedUsers.map(user => {
            const safeRole = 'customer';
            const isSuperAdmin = false;
            const canEditThisUser = true;
            const canToggleDisable = this.currentUserRole === 'super_admin'
                ? user.id !== this.currentUserId && !isSuperAdmin
                : user.role !== 'admin' && user.id !== this.currentUserId && !isSuperAdmin;
            const isDisabled = !!user.is_disabled;

            const statusBadge = isSuperAdmin ? '' :
                this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active');

            const fullName = user.full_name || '—';

            return `
                <tr>
                    <td class="text-muted">${user.id}</td>
                    <td class="text-center">
                        <div class="user-cell text-center">
                            <div class="user-cell-name">${this.escapeHtml(fullName)}</div>
                        </div>
                    </td>
                    <td style="color:#777171f0">${this.escapeHtml(user.username || '—')}</td>
                    <td>${this.escapeHtml(user.email)}</td>
                    <td class="text-center">
                        <div class="d-flex flex-column gap-1 align-items-center">
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="text-muted">${user.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>
                        <button class="btn btn-sm py-0 px-2 btn-ac-green customer-view-btn" data-user-id="${user.id}">View</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.refreshSortableTable('users-table', { columns: [{ select: 6, sortable: false }] });
    }

    formatRole(role) {
        const map = { super_admin: 'Super Admin', admin: 'Admin', farmer: 'Farmer', customer: 'Customer' };
        return map[role] || role;
    }

    async loadAdmin(page = 1) {
        try {
            const pg = this.pagination.admin;
            pg.page = page;
            const search = (document.getElementById('admin-search-input')?.value || '').trim();
            const activeTab = document.querySelector('.admin-tabs .tab-btn.active');
            const status = activeTab ? activeTab.getAttribute('data-status') : '';
            const verification = (document.getElementById('admin-verification-filter')?.value || '').trim();
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit),
                role: 'admin'
            });
            if (search) params.set('search', search);
            if (status) params.set('status', status);
            if (verification) params.set('verification', verification);

            const response = await fetch(`${this.apiBase}/admin/users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                this.lastAdmin = data.users || [];
                pg.total = Number(data.total || 0);
                this.renderAdmin(this.lastAdmin);
                this.renderPagination('admin-pagination', pg, (p) => this.loadAdmin(p));
            } else {
                const tbody = document.getElementById('admin-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load admin. Please try again.</td></tr>`;
                this.showMessage('Failed to load admin', 'error');
            }
        } catch (error) {
            console.error('Error loading admin:', error);
            const tbody = document.getElementById('admin-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load admin. Please try again.</td></tr>`;
            this.showMessage('Failed to load admin', 'error');
        }
    }

    renderAdmin(users) {
        this.destroySortableTable('admin-table');
        const tbody = document.getElementById('admin-tbody');
        if (!tbody) return;

        let sortedUsers = users || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_admin-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedUsers.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // full_name
                            valA = (a.full_name || '').toLowerCase();
                            valB = (b.full_name || '').toLowerCase();
                            break;
                        case 2: // username
                            valA = (a.username || '').toLowerCase();
                            valB = (b.username || '').toLowerCase();
                            break;
                        case 3: // email
                            valA = (a.email || '').toLowerCase();
                            valB = (b.email || '').toLowerCase();
                            break;
                        case 4: // role
                            valA = (a.role || '').toLowerCase();
                            valB = (b.role || '').toLowerCase();
                            break;
                        case 5: // status (is_disabled)
                            valA = a.is_disabled ? 1 : 0;
                            valB = b.is_disabled ? 1 : 0;
                            break;
                        case 6: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedUsers.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No admin found</td></tr>`;
            this.refreshSortableTable('admin-table', { columns: [{ select: 7, sortable: false }] });
            return;
        }
        tbody.innerHTML = sortedUsers.map(user => {
            const isDisabled = !!user.is_disabled;
            const statusBadge = this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active');

            const actions = `<button class="btn btn-sm py-0 px-2 btn-ac-green admin-view-btn" data-user-id="${user.id}">View</button>`;

            return `
                <tr>
                    <td class="text-muted">${user.id}</td>
                    <td class="text-center">
                        <div class="user-cell text-center">
                            <div class="user-cell-name">${this.escapeHtml(user.full_name || '—')}</div>
                        </div>
                    </td>
                    <td style="color:#777171f0">${this.escapeHtml(user.username || '—')}</td>
                    <td>${this.escapeHtml(user.email)}</td>
                    <td>${this.formatRole(user.role)}</td>
                    <td class="text-center">
                        <div class="d-flex flex-column gap-1 align-items-center">
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="text-muted">${user.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');

        this.refreshSortableTable('admin-table', { columns: [{ select: 7, sortable: false }] });
    }

    applyAdminFilter() {
        const q = (document.getElementById('admin-search-input')?.value || '').trim().toLowerCase();
        const activeTab = document.querySelector('.admin-tabs .tab-btn.active');
        const status = activeTab ? activeTab.getAttribute('data-status') : '';
        const verification = (document.getElementById('admin-verification-filter')?.value || '').trim().toLowerCase();

        let users = [...(this.lastAdmin || [])];
        if (q) {
            users = users.filter(u =>
                String(u.id || '').includes(q) ||
                String(u.full_name || '').toLowerCase().includes(q) ||
                String(u.username || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q)
            );
        }
        if (status === 'active') users = users.filter(u => !u.is_disabled);
        else if (status === 'disabled') users = users.filter(u => !!u.is_disabled);
        if (verification === 'verified') users = users.filter(u => !!u.is_verified);
        else if (verification === 'unverified') users = users.filter(u => !u.is_verified);

        this.renderAdmin(users);
    }

    async loadAllUsers(page = 1) {
        try {
            const pg = this.pagination['all-users'];
            pg.page = page;
            const search = (document.getElementById('all-users-search-input')?.value || '').trim();
            const role = (document.getElementById('all-users-role-filter')?.value || '').trim();
            const activeTab = document.querySelector('.all-users-tabs .tab-btn.active');
            const status = activeTab ? activeTab.getAttribute('data-status') : '';
            const verification = (document.getElementById('all-users-verification-filter')?.value || '').trim();
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });
            if (search) params.set('search', search);
            if (role) params.set('role', role);
            if (status) params.set('status', status);
            if (verification) params.set('verification', verification);
            // Superadmin gets password field for modal
            if (this.currentUserRole === 'super_admin') {
                params.set('include_password', 'true');
            }

            const response = await fetch(`${this.apiBase}/admin/users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                this.lastAllUsers = data.users || [];
                pg.total = Number(data.total || 0);
                this.renderAllUsers(this.lastAllUsers);
                this.renderPagination('all-users-pagination', pg, (p) => this.loadAllUsers(p));
            } else {
                const tbody = document.getElementById('all-users-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load users. Please try again.</td></tr>`;
                this.showMessage('Failed to load users', 'error');
            }
        } catch (error) {
            console.error('Error loading all users:', error);
            const tbody = document.getElementById('all-users-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load users. Please try again.</td></tr>`;
            this.showMessage('Failed to load users', 'error');
        }
    }

    renderAllUsers(users) {
        this.destroySortableTable('all-users-table');
        const tbody = document.getElementById('all-users-tbody');
        if (!tbody) return;

        let sortedUsers = users || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_all-users-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedUsers.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // full_name
                            valA = (a.full_name || '').toLowerCase();
                            valB = (b.full_name || '').toLowerCase();
                            break;
                        case 2: // username
                            valA = (a.username || '').toLowerCase();
                            valB = (b.username || '').toLowerCase();
                            break;
                        case 3: // email
                            valA = (a.email || '').toLowerCase();
                            valB = (b.email || '').toLowerCase();
                            break;
                        case 4: // role
                            valA = (a.role || '').toLowerCase();
                            valB = (b.role || '').toLowerCase();
                            break;
                        case 5: // status (is_disabled)
                            valA = a.is_disabled ? 1 : 0;
                            valB = b.is_disabled ? 1 : 0;
                            break;
                        case 6: // created_at
                            const dateA = new Date(a.created_at || 0);
                            const dateB = new Date(b.created_at || 0);
                            valA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
                            valB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedUsers.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No users found</td></tr>`;
            this.refreshSortableTable('all-users-table', { columns: [{ select: 7, sortable: false }] });
            return;
        }
        tbody.innerHTML = sortedUsers.map(user => {
            const isSuperAdmin = user.role === 'super_admin';
            const isDisabled = !!user.is_disabled;
            const statusBadge = isSuperAdmin ? '' : this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active');

            const actions = `<button class="btn btn-sm py-0 px-2 btn-ac-green all-users-view-btn" data-user-id="${user.id}">View</button>`;

            return `
                <tr>
                    <td class="text-muted">${user.id}</td>
                    <td class="text-center">
                        <div class="user-cell text-center">
                            <div class="user-cell-name">${this.escapeHtml(user.full_name || '—')}</div>
                        </div>
                    </td>
                    <td style="color:#777171f0">${this.escapeHtml(user.username || '—')}</td>
                    <td>${this.escapeHtml(user.email)}</td>
                    <td>${this.formatRole(user.role)}</td>
                    <td class="text-center">
                        <div class="d-flex flex-column gap-1 align-items-center">
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="text-muted">${user.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');

        this.refreshSortableTable('all-users-table', { columns: [{ select: 7, sortable: false }] });
    }

    applyAllUsersFilter() {
        const q = (document.getElementById('all-users-search-input')?.value || '').trim().toLowerCase();
        const role = (document.getElementById('all-users-role-filter')?.value || '').trim().toLowerCase();
        const activeTab = document.querySelector('.all-users-tabs .tab-btn.active');
        const status = activeTab ? activeTab.getAttribute('data-status') : '';
        const verification = (document.getElementById('all-users-verification-filter')?.value || '').trim().toLowerCase();

        let users = [...(this.lastAllUsers || [])];
        if (q) {
            users = users.filter(u =>
                String(u.id || '').includes(q) ||
                String(u.full_name || '').toLowerCase().includes(q) ||
                String(u.username || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q)
            );
        }
        if (role) users = users.filter(u => u.role === role);
        if (status === 'active') users = users.filter(u => !u.is_disabled);
        else if (status === 'disabled') users = users.filter(u => !!u.is_disabled);
        if (verification === 'verified') users = users.filter(u => !!u.is_verified);
        else if (verification === 'unverified') users = users.filter(u => !u.is_verified);

        this.renderAllUsers(users);
    }

    async loadSuspiciousPatterns(page = 1) {
        try {
            const pg = this.pagination['suspicious-patterns'] || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });

            const response = await fetch(`${this.apiBase}/admin/suspicious-patterns?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastSuspiciousPatterns = data;
                this.renderSuspiciousPatterns(data);

                // Update pagination total using max of the two pattern counts
                const pagination = data.pagination || {};
                const maxTotal = Math.max(
                    pagination.single_farmer_total || 0,
                    pagination.same_phone_total || 0
                );
                pg.total = maxTotal;
                this.renderPagination('suspicious-patterns-pagination', pg, (p) => this.loadSuspiciousPatterns(p));
            } else {
                const singleTbody = document.getElementById('single-farmer-pattern-tbody');
                const phoneTbody = document.getElementById('same-phone-pattern-tbody');
                if (singleTbody) singleTbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Failed to load suspicious patterns. Please try again.</td></tr>`;
                if (phoneTbody) phoneTbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Failed to load suspicious patterns. Please try again.</td></tr>`;
                this.showMessage('Failed to load suspicious patterns', 'error');
            }
        } catch (error) {
            console.error('Error loading suspicious patterns:', error);
            const singleTbody = document.getElementById('single-farmer-pattern-tbody');
            const phoneTbody = document.getElementById('same-phone-pattern-tbody');
            if (singleTbody) singleTbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-3">Failed to load suspicious patterns. Please try again.</td></tr>`;
            if (phoneTbody) phoneTbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Failed to load suspicious patterns. Please try again.</td></tr>`;
            this.showMessage('Failed to load suspicious patterns', 'error');
        }
    }

    renderSuspiciousPatterns(data) {
        const { single_farmer_pattern, same_phone_pattern } = data;

        // Render single farmer pattern
        const singleTbody = document.getElementById('single-farmer-pattern-tbody');
        if (singleTbody) {
            if (!single_farmer_pattern || !single_farmer_pattern.length) {
                singleTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No suspicious patterns detected</td></tr>`;
            } else {
                singleTbody.innerHTML = single_farmer_pattern.map(p => `
                    <tr>
                        <td class="fw-semibold">${this.escapeHtml(p.username || '—')}</td>
                        <td>${this.escapeHtml(p.email || '—')}</td>
                        <td class="text-muted">${p.order_count}</td>
                        <td class="text-muted">${p.avg_rating ? p.avg_rating.toFixed(1) : '—'}</td>
                        <td class="text-muted">${p.review_count || 0}</td>
                        <td>${this.escapeHtml(p.farmer_username || '—')}</td>
                        <td>
                            <button class="btn btn-sm py-0 px-2 btn-ac-green suspicious-view-btn" data-user-id="${p.user_id}">View</button>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Render same phone pattern
        const phoneTbody = document.getElementById('same-phone-pattern-tbody');
        if (phoneTbody) {
            if (!same_phone_pattern || !same_phone_pattern.length) {
                phoneTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No suspicious patterns detected</td></tr>`;
            } else {
                phoneTbody.innerHTML = same_phone_pattern.map(p => `
                    <tr>
                        <td class="fw-semibold">${this.escapeHtml(p.customer_username || '—')}</td>
                        <td>${this.escapeHtml(p.customer_email || '—')}</td>
                        <td class="text-muted">${this.escapeHtml(p.phone || '—')}</td>
                        <td>${this.escapeHtml(p.farmer_username || '—')}</td>
                        <td>${this.escapeHtml(p.farmer_email || '—')}</td>
                        <td>
                            <button class="btn btn-sm py-0 px-2 btn-ac-green suspicious-view-btn" data-user-id="${p.customer_id}">View</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    }

    async loadFlaggedUsers(page = 1) {
        try {
            const pg = this.pagination['flagged-users'] || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });

            const response = await fetch(`${this.apiBase}/admin/flagged-users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastFlaggedUsers = data.flagged_users || [];
                pg.total = Number(data.pagination?.total || 0);
                this.renderFlaggedUsers(this.lastFlaggedUsers);
                this.renderPagination('flagged-users-pagination', pg, (p) => this.loadFlaggedUsers(p));
            } else {
                const tbody = document.getElementById('flagged-users-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Failed to load flagged users. Please try again.</td></tr>`;
                this.showMessage('Failed to load flagged users', 'error');
            }
        } catch (error) {
            console.error('Error loading flagged users:', error);
            const tbody = document.getElementById('flagged-users-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Failed to load flagged users. Please try again.</td></tr>`;
            this.showMessage('Failed to load flagged users', 'error');
        }
    }

    renderFlaggedUsers(users) {
        this.destroySortableTable('flagged-users-table');
        const tbody = document.getElementById('flagged-users-tbody');
        if (!tbody) return;

        let sortedUsers = users || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_flagged-users-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedUsers.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // username
                            valA = (a.username || '').toLowerCase();
                            valB = (b.username || '').toLowerCase();
                            break;
                        case 2: // email
                            valA = (a.email || '').toLowerCase();
                            valB = (b.email || '').toLowerCase();
                            break;
                        case 3: // role
                            valA = (a.role || '').toLowerCase();
                            valB = (b.role || '').toLowerCase();
                            break;
                        case 4: // phone
                            valA = (a.phone || '').toLowerCase();
                            valB = (b.phone || '').toLowerCase();
                            break;
                        case 5: // flag_reason
                            valA = (a.flag_reason || '').toLowerCase();
                            valB = (b.flag_reason || '').toLowerCase();
                            break;
                        case 6: // flagged_at
                            valA = new Date(a.flagged_at || 0).getTime();
                            valB = new Date(b.flagged_at || 0).getTime();
                            break;
                        case 7: // flagged_by_username
                            valA = (a.flagged_by_username || '').toLowerCase();
                            valB = (b.flagged_by_username || '').toLowerCase();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedUsers.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No flagged users found</td></tr>`;
            this.refreshSortableTable('flagged-users-table');
            return;
        }

        tbody.innerHTML = sortedUsers.map(user => {
            const isDisabled = !!user.is_disabled;
            const statusBadge = this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active');
            return `
                <tr>
                    <td class="text-muted">${user.id}</td>
                    <td class="fw-semibold">${this.escapeHtml(user.username || '—')}</td>
                    <td>${this.escapeHtml(user.email || '—')}</td>
                    <td>${this.escapeHtml(user.role || '—')}</td>
                    <td class="text-muted">${this.escapeHtml(user.phone || '—')}</td>
                    <td>${this.escapeHtml(user.flag_reason || '—')}</td>
                    <td class="text-muted">${user.flagged_at ? new Date(user.flagged_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td class="text-muted">${user.flagged_by_username || '—'}</td>
                    <td>
                        <div class="d-flex gap-1">
                            ${statusBadge}
                            <button class="btn btn-sm py-0 px-2 btn-ac-green flagged-unflag-btn" data-user-id="${user.id}">Unflag</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.refreshSortableTable('flagged-users-table', { columns: [{ select: 8, sortable: false }] });
    }

    async unflagUser(userId) {
        try {
            const response = await fetch(`${this.apiBase}/admin/users/${userId}/unflag`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.showMessage('User unflagged successfully', 'success');
                this.loadFlaggedUsers();
            } else {
                const data = await response.json().catch(() => ({}));
                this.showMessage(data.message || 'Failed to unflag user', 'error');
            }
        } catch (error) {
            console.error('Error unflagging user:', error);
            this.showMessage('Failed to unflag user', 'error');
        }
    }

    async loadSecurityLog(page = 1) {
        try {
            const pg = this.pagination['security-log'] || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const actionFilter = document.getElementById('seclog-action-filter')?.value || '';
            const dateFrom = document.getElementById('seclog-date-from')?.value || '';
            const dateTo = document.getElementById('seclog-date-to')?.value || '';
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });
            if (actionFilter) params.set('action', actionFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);

            const response = await fetch(`${this.apiBase}/superadmin/security-log?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastSecurityLogs = data.logs || [];
                pg.total = Number(data.total || 0);
                this.renderSecurityLog(this.lastSecurityLogs);
                this.renderPagination('seclog-pagination', pg, (p) => this.loadSecurityLog(p));
            } else {
                const tbody = document.getElementById('seclog-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Failed to load security log. Please try again.</td></tr>`;
                this.showMessage('Failed to load security log', 'error');
            }
        } catch (error) {
            console.error('Error loading security log:', error);
            const tbody = document.getElementById('seclog-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Failed to load security log. Please try again.</td></tr>`;
            this.showMessage('Failed to load security log', 'error');
        }
    }

    renderSecurityLog(logs) {
        this.destroySortableTable('seclog-table');
        const tbody = document.getElementById('seclog-tbody');
        if (!tbody) return;

        let sortedLogs = logs || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_seclog-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedLogs.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        case 1: // actor name
                            valA = (a.actor_admin_name || a.actor_admin_email || '').toLowerCase();
                            valB = (b.actor_admin_name || b.actor_admin_email || '').toLowerCase();
                            break;
                        case 2: // action
                            valA = (a.action || '').toLowerCase();
                            valB = (b.action || '').toLowerCase();
                            break;
                        case 3: // entity
                            valA = (a.entity || '').toLowerCase();
                            valB = (b.entity || '').toLowerCase();
                            break;
                        case 4: // ip_address
                            valA = (a.ip_address || '').toLowerCase();
                            valB = (b.ip_address || '').toLowerCase();
                            break;
                        case 5: // user_agent
                            valA = (a.user_agent || '').toLowerCase();
                            valB = (b.user_agent || '').toLowerCase();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedLogs.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No security log entries found</td></tr>`;
            this.refreshSortableTable('seclog-table');
            return;
        }

        tbody.innerHTML = sortedLogs.map(log => {
            return `
                <tr>
                    <td class="text-muted">${log.created_at ? new Date(log.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'}</td>
                    <td>${this.escapeHtml(log.actor_admin_name || log.actor_admin_email || '—')}</td>
                    <td>${this.escapeHtml(log.action || '—')}</td>
                    <td>${this.escapeHtml(log.entity || '—')}</td>
                    <td class="text-muted">${log.ip_address || '—'}</td>
                    <td class="text-muted small">${this.escapeHtml(log.user_agent || '—')}</td>
                </tr>
            `;
        }).join('');

        this.refreshSortableTable('seclog-table', { columns: [{ select: 6, sortable: false }] });
    }

    async loadPlatformSettings() {
        try {
            const response = await fetch(`${this.apiBase}/superadmin/settings`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastPlatformSettings = data.settings || {};
                this.renderPlatformSettings(this.lastPlatformSettings);
            } else {
                const container = document.getElementById('settings-form');
                if (container) container.innerHTML = `<div class="text-center text-danger py-4">Failed to load platform settings. Please try again.</div>`;
                this.showMessage('Failed to load platform settings', 'error');
            }
        } catch (error) {
            console.error('Error loading platform settings:', error);
            const container = document.getElementById('settings-form');
            if (container) container.innerHTML = `<div class="text-center text-danger py-4">Failed to load platform settings. Please try again.</div>`;
            this.showMessage('Failed to load platform settings', 'error');
        }
    }

    async loadServiceStatus() {
        try {
            const response = await fetch(`${this.apiBase}/superadmin/status`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderServiceStatus(data);
            } else {
                const container = document.getElementById('service-status-list');
                if (container) container.innerHTML = `<div class="text-center text-danger py-3">Failed to load service status. Please try again.</div>`;
                this.showMessage('Failed to load service status', 'error');
            }
        } catch (error) {
            console.error('Error loading service status:', error);
            const container = document.getElementById('service-status-list');
            if (container) container.innerHTML = `<div class="text-center text-danger py-3">Failed to load service status. Please try again.</div>`;
            this.showMessage('Failed to load service status', 'error');
        }
    }

    renderServiceStatus(data) {
        const container = document.getElementById('service-status-list');
        if (!container) return;

        const { services = [] } = data;
        if (!services.length) {
            container.innerHTML = `<div class="text-center text-muted py-3">No service status available</div>`;
            return;
        }

        container.innerHTML = services.map(service => {
            const badgeClass = service.online ? 'ac-service-badge--online' : (service.configured ? 'ac-service-badge--warning' : 'ac-service-badge--offline');
            const statusIcon = service.online ? 'bi-check-circle-fill' : (service.configured ? 'bi-exclamation-circle-fill' : 'bi-dash-circle');
            const statusText = service.online ? 'Online' : (service.configured ? 'Configured (Offline)' : 'Not Configured');

            let detailsHtml = '';
            if (service.details && Object.keys(service.details).length > 0) {
                detailsHtml = Object.entries(service.details).map(([key, value]) => {
                    if (value === null || value === undefined) return '';
                    return `<div class="ac-service-detail"><strong>${key}:</strong> ${this.escapeHtml(String(value))}</div>`;
                }).join('');
            }

            return `
                <div class="ac-service-item">
                    <div>
                        <div class="ac-service-name">${this.escapeHtml(service.name)}</div>
                        ${detailsHtml}
                    </div>
                    <span class="ac-service-badge ${badgeClass}">
                        <i class="bi ${statusIcon}"></i>${statusText}
                    </span>
                </div>
            `;
        }).join('');
    }

    renderPlatformSettings(settings) {
        const container = document.getElementById('settings-form');
        if (!container) return;

        const entries = Object.entries(settings);
        if (!entries.length) {
            container.innerHTML = `<div class="text-center text-muted py-4">No platform settings configured</div>`;
            return;
        }

        container.innerHTML = entries.map(([key, data]) => {
            if (key === 'delivery_fee') {
                return `
                    <div class="mb-3">
                        <label for="setting-delivery_fee" class="form-label fw-semibold">Delivery Fee (₱)</label>
                        <input type="number" id="setting-delivery_fee" class="form-control platform-setting-input"
                               data-key="${key}" min="0" step="1" value="${this.escapeHtml(data.value || '35')}">
                        <div class="form-text text-muted">Set to 0 to disable delivery fee - it will not appear in checkout</div>
                        <small class="text-muted">Last updated: ${data.updated_at ? new Date(data.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'}</small>
                    </div>
                `;
            }
            return `
                <div class="mb-3">
                    <label class="form-label fw-semibold">${this.escapeHtml(key)}</label>
                    <input type="text" class="form-control platform-setting-input" data-key="${key}" value="${this.escapeHtml(data.value || '')}">
                    <small class="text-muted">Last updated: ${data.updated_at ? new Date(data.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'}</small>
                </div>
            `;
        }).join('');

        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.savePlatformSettings());
    }

    async savePlatformSettings() {
        const inputs = document.querySelectorAll('.platform-setting-input');
        const updates = {};
        inputs.forEach(input => {
            updates[input.dataset.key] = input.value;
        });

        try {
            const response = await fetch(`${this.apiBase}/superadmin/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(updates)
            });

            if (response.ok) {
                this.showMessage('Platform settings updated successfully', 'success');
                this.loadPlatformSettings();
            } else {
                const data = await response.json().catch(() => ({}));
                this.showMessage(data.message || 'Failed to update platform settings', 'error');
            }
        } catch (error) {
            console.error('Error saving platform settings:', error);
            this.showMessage('Failed to update platform settings', 'error');
        }
    }

    async loadFeatureFlags() {
        try {
            const response = await fetch(`${this.apiBase}/superadmin/flags`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastFeatureFlags = data.flags || [];
                this.renderFeatureFlags(this.lastFeatureFlags);
            } else {
                const container = document.getElementById('feature-flags-list');
                if (container) container.innerHTML = `<div class="text-center text-danger py-4">Failed to load feature flags. Please try again.</div>`;
                this.showMessage('Failed to load feature flags', 'error');
            }
        } catch (error) {
            console.error('Error loading feature flags:', error);
            const container = document.getElementById('feature-flags-list');
            if (container) container.innerHTML = `<div class="text-center text-danger py-4">Failed to load feature flags. Please try again.</div>`;
            this.showMessage('Failed to load feature flags', 'error');
        }
    }

    renderFeatureFlags(flags) {
        const container = document.getElementById('feature-flags-list');
        if (!container) return;

        if (!flags.length) {
            container.innerHTML = `<div class="text-center text-muted py-4">No feature flags found</div>`;
            return;
        }

        container.innerHTML = flags.map(flag => `
            <div class="ac-flag-row">
                <div class="flex-grow-1 min-width-0">
                    <div class="ac-flag-name">${this.escapeHtml(flag.name)}</div>
                    <div class="ac-flag-desc">${this.escapeHtml(flag.description || '')}</div>
                </div>
                <div class="ac-flag-meta">
                    <span class="text-muted" style="font-size:.74rem">${flag.updated_at ? new Date(flag.updated_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : '—'}</span>
                    <label class="ac-toggle-switch">
                        <input type="checkbox" class="feature-flag-toggle-input" data-key="${flag.key}" ${flag.enabled ? 'checked' : ''}>
                        <span class="ac-toggle-slider"></span>
                    </label>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.feature-flag-toggle-input').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.key;
                const newEnabled = input.checked;
                this.toggleFeatureFlag(key, newEnabled);
            });
        });
    }

    async toggleFeatureFlag(key, enabled) {
        try {
            const response = await fetch(`${this.apiBase}/superadmin/flags/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ enabled })
            });

            if (response.ok) {
                this.showMessage(`Feature flag ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
                this.loadFeatureFlags();
            } else {
                const data = await response.json().catch(() => ({}));
                this.showMessage(data.message || 'Failed to toggle feature flag', 'error');
            }
        } catch (error) {
            console.error('Error toggling feature flag:', error);
            this.showMessage('Failed to toggle feature flag', 'error');
        }
    }

    async loadProducts(page = 1) {
        try {
            const pg = this.pagination?.products || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const search = (document.getElementById('products-search-input')?.value || '').trim();
            const category = (document.getElementById('products-category-filter')?.value || '').trim();
            const activeTab = document.querySelector('.products-tabs .tab-btn.active');
            let status = activeTab ? activeTab.getAttribute('data-status') : '';
            // Set default to empty string (All) if filter is empty on initial load
            if (!status && page === 1) {
                status = '';
                const defaultTab = document.querySelector('.products-tabs .tab-btn[data-status=""]');
                if (defaultTab) {
                    document.querySelectorAll('.products-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                    defaultTab.classList.add('active');
                }
            }
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });
            if (search) params.set('search', search);
            if (category) params.set('category', category);
            if (status) params.set('status', status);

            const response = await fetch(`${this.apiBase}/admin/products?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastProducts = data.products || [];
                pg.total = Number(data.total || 0);
                this.renderProducts(this.lastProducts);
                this.renderPagination('products-pagination', pg, (p) => this.loadProducts(p));
            } else {
                const tbody = document.getElementById('products-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-3">Failed to load products. Please try again.</td></tr>`;
                this.showMessage('Failed to load products', 'error');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            const tbody = document.getElementById('products-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-3">Failed to load products. Please try again.</td></tr>`;
            this.showMessage('Failed to load products', 'error');
        }
    }

    renderProducts(products) {
        this.destroySortableTable('products-table');
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        let sortedProducts = products || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_products-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedProducts.sort((a, b) => {
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
                        case 6: // farmer name
                            valA = (a.farmer_shop_name || a.farmer_name || '').toLowerCase();
                            valB = (b.farmer_shop_name || b.farmer_name || '').toLowerCase();
                            break;
                        case 7: // status
                            const statusA = a.is_admin_disabled ? 'admin_disabled' : a.farmer_is_disabled ? 'farmer_disabled' : (a.is_available ? 'available' : 'unavailable');
                            const statusB = b.is_admin_disabled ? 'admin_disabled' : b.farmer_is_disabled ? 'farmer_disabled' : (b.is_available ? 'available' : 'unavailable');
                            valA = statusA;
                            valB = statusB;
                            break;
                        case 8: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedProducts.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No products found</td></tr>`;
            this.refreshSortableTable('products-table', { columns: [{ select: 0, sortable: false }, { select: 9, sortable: false }] });
            return;
        }
        tbody.innerHTML = sortedProducts.map(product => {
            const isAdminDisabled = !!product.is_admin_disabled;
            const isFarmerDisabled = !!product.farmer_is_disabled;
            const statusLabel = isAdminDisabled
                ? 'Admin Disabled'
                : isFarmerDisabled
                    ? 'Farmer Disabled'
                    : (product.is_available ? 'Available' : 'Unavailable');
            const statusKey = isAdminDisabled ? 'admin_disabled' : isFarmerDisabled ? 'farmer_disabled' : (product.is_available ? 'available' : 'unavailable');
            const createdAt = product.created_at ? new Date(product.created_at) : null;
            const createdLabel = createdAt ? createdAt.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const createdOrder = createdAt ? createdAt.getTime() : 0;
            const thumb = product.image_url
                ? `<img src="${this.escapeHtml(product.image_url)}" class="product-thumb" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">`
                : '';
            const placeholder = `<div class="product-thumb-placeholder" ${product.image_url ? 'style="display:none"' : ''}><i class="bi bi-image"></i></div>`;

            return `
            <tr>
                <td>${thumb}${placeholder}</td>
                <td class="text-muted">${product.id}</td>
                <td class="fw-semibold">${this.escapeHtml(product.name)}</td>
                <td class="text-muted">${this.escapeHtml(product.category_name || '—')}</td>
                <td>${this.fmtCurrency(product.price)}</td>
                <td>${this.fmtNumber(product.stock_quantity ?? 0)}</td>
                <td>
                    <div class="fw-semibold">${this.escapeHtml(product.farmer_shop_name || product.farmer_name || 'Unassigned')}</div>
                    ${product.farmer_name ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(product.farmer_name)}${product.farmer_username ? ` (${this.escapeHtml(product.farmer_username)})` : ''}</div>` : ''}
                    ${product.farmer_email ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(product.farmer_email)}</div>` : ''}
                </td>
                <td>${this.renderStatus(statusLabel, statusKey)}</td>
                <td class="text-muted" data-order="${createdOrder}">${createdLabel}</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green product-edit-btn" data-product-id="${product.id}">Edit</button>
                </td>
            </tr>
        `;
        }).join('');

        this.refreshSortableTable('products-table', { columns: [{ select: 0, sortable: false }, { select: 9, sortable: false }] });
    }

    clearOrdersFromUI() {
        this.lastOrders = [];
        this.renderOrders([]);
        this.loadOrders();
    }

    // ────────────────────────────────────────────────────────────
    //  Customer detail modal
    // ────────────────────────────────────────────────────────────
    async openCustomerDetailModal(userId) {
        try {
            const res = await fetch(`${this.apiBase}/admin/customers/${userId}/summary`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) {
                const ov = document.getElementById('cdt-overview-content');
                if (ov) ov.innerHTML = `<div class="text-center text-danger py-3">Failed to load customer details. Please try again.</div>`;
                this.showToast('Failed to load customer details', 'error');
                return;
            }
            const { user, orders, addresses, total_spent, total_orders } = await res.json();
            const safeUser = { ...user, role: 'customer' };

            // Overview tab
            const ov = document.getElementById('cdt-overview-content');
            if (ov) ov.innerHTML = `
                <div class="row g-2 mb-3">
                    ${[
                        ['Full Name', safeUser.full_name || '—'], ['Username', safeUser.username || '—'],
                        ['Email', safeUser.email || '—'], ['Phone', safeUser.phone || '—'],
                        ['Address', safeUser.address || '—'],
                        ['Status', safeUser.is_disabled ? this.renderStatus('Disabled', 'disabled') : this.renderStatus('Active', 'active')],
                        ['Rating', user.rating ? `<span class="star-rating">★</span> ${Number(user.rating).toFixed(1)}` : '—'],
                        ['Joined', safeUser.created_at ? new Date(safeUser.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
                        ['Total Orders', total_orders], ['Total Spent', this.fmtCurrency(total_spent)],
                    ].map(([k,v]) => `<div class="col-6"><div class="text-muted small">${k}</div><div class="fw-semibold small">${v}</div></div>`).join('')}
                </div>
            `;

            // Orders tab
            const otbody = document.getElementById('cdt-orders-tbody');
            if (otbody) {
                if (!orders.length) {
                    otbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3 small">No orders</td></tr>`;
                } else {
                    otbody.innerHTML = orders.map(o => `
                        <tr>
                            <td class="small">#${o.id}</td>
                            <td class="small">${this.escapeHtml(o.product_name || (o.items && o.items[0] && o.items[0].product_name) || '—')}</td>
                            <td class="small">
                                <div class="fw-semibold">${this.escapeHtml(o.farmer_shop_name || o.farmer_name || '—')}</div>
                                ${o.farmer_name && o.farmer_shop_name ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(o.farmer_name)}</div>` : ''}
                                ${o.farmer_address ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(o.farmer_address)}</div>` : ''}
                            </td>
                            <td>${this.renderStatus(this.formatStatus(o.status), o.status)}</td>
                            <td class="small">${this.fmtCurrency(o.total_amount)}</td>
                            <td class="small text-muted">${o.created_at ? new Date(o.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                        </tr>
                    `).join('');
                }
            }

            // Addresses tab
            const addrEl = document.getElementById('cdt-addresses-content');
            if (addrEl) {
                if (!addresses.length) {
                    addrEl.innerHTML = `<div class="text-muted small py-3 text-center">No saved addresses</div>`;
                } else {
                    addrEl.innerHTML = addresses.map(a => `
                        <div class="border rounded p-2 mb-2 small">
                            ${a.is_default ? `<span class="badge bg-success-subtle text-success mb-1">Default</span><br>` : ''}
                            <div class="fw-semibold">${this.escapeHtml(a.full_address || a.address_line || '')}</div>
                            ${a.barangay ? `<div class="text-muted">${this.escapeHtml([a.barangay, a.city, a.province].filter(Boolean).join(', '))}</div>` : ''}
                        </div>
                    `).join('');
                }
            }

            // Action buttons
            const isDisabled = !!user.is_disabled;
            const disableBtn = document.getElementById('cdt-disable-btn');
            const enableBtn  = document.getElementById('cdt-enable-btn');

            if (disableBtn) disableBtn.style.display = isDisabled ? 'none' : '';
            if (enableBtn)  enableBtn.style.display  = isDisabled ? '' : 'none';

            const editBtn = document.getElementById('cdt-edit-btn');
            if (editBtn) { editBtn.onclick = () => { this.previousModalId = 'customer-detail-modal'; this.openUserEdit(userId); }; }

            if (disableBtn) { disableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to disable this customer?', { title: 'Disable Customer', danger: true })) return;
                
                // Show loading state
                const spinner = document.getElementById('cdt-disable-spinner');
                if (disableBtn) disableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                const r = await fetch(`${this.apiBase}/admin/users/${userId}/disable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ is_disabled: true })
                });
                
                // Hide loading state
                if (disableBtn) disableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                
                if (r.ok) {
                    this.showToast('User disabled', 'success');
                    disableBtn.style.display = 'none';
                    if (enableBtn) enableBtn.style.display = '';
                    // Update overview status
                    const ov = document.getElementById('cdt-overview-content');
                    if (ov) ov.innerHTML = ov.innerHTML.replace(/<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active<\/span>/, '<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled</span>');
                    this.loadUsers();
                }
            }; }

            if (enableBtn) { enableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to enable this customer?', { title: 'Enable Customer', danger: false })) return;
                
                // Show loading state
                const spinner = document.getElementById('cdt-enable-spinner');
                if (enableBtn) enableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                const r = await fetch(`${this.apiBase}/admin/users/${userId}/enable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }
                });
                
                // Hide loading state
                if (enableBtn) enableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                
                if (r.ok) {
                    this.showToast('User enabled', 'success');
                    enableBtn.style.display = 'none';
                    if (disableBtn) disableBtn.style.display = '';
                    // Update overview status
                    const ov = document.getElementById('cdt-overview-content');
                    if (ov) ov.innerHTML = ov.innerHTML.replace(/<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled<\/span>/, '<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active</span>');
                    this.loadUsers();
                }
            }; }

            const modal = document.getElementById('customer-detail-modal');
            if (modal) {
                this.modalZIndex++;
                modal.style.zIndex = this.modalZIndex;
                modal.classList.add('open');
            }
        } catch (err) {
            console.error('Customer detail error:', err);
        }
    }

    // ────────────────────────────────────────────────────────────
    //  Farmer detail modal
    // ────────────────────────────────────────────────────────────
    async openFarmerDetailModal(farmerId) {
        try {
            const res = await fetch(`${this.apiBase}/admin/farmers/${farmerId}/summary`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) {
                const infoEl = document.getElementById('fdt-info-content');
                if (infoEl) infoEl.innerHTML = `<div class="text-center text-danger py-3">Failed to load farmer details. Please try again.</div>`;
                this.showToast('Failed to load farmer details', 'error');
                return;
            }
            const { farmer, products, reviews, revenue, order_count } = await res.json();

            const infoEl = document.getElementById('fdt-info-content');
            if (infoEl) infoEl.innerHTML = `
                <div class="row g-2">
                    ${[
                        ['Shop Name', farmer.shop_name || '—'], ['Full Name', farmer.full_name || '—'],
                        ['Username', farmer.username || '—'],
                        ['Email', farmer.email || '—'], ['Phone', farmer.phone || '—'],
                        ['Address', farmer.address || '—'],
                        ['Verified', farmer.is_verified ? this.renderStatus('Yes', 'verified') : this.renderStatus('No', 'unverified')],
                        ['Status', farmer.is_disabled ? this.renderStatus('Disabled', 'disabled') : this.renderStatus('Active', 'active')],
                        ['Rating', farmer.rating ? `<span class="star-rating">★</span> ${Number(farmer.rating).toFixed(1)}` : '—'],
                        ['Joined', farmer.created_at ? new Date(farmer.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
                        ['Total Revenue', this.fmtCurrency(revenue)], ['Order Count', order_count],
                    ].map(([k,v]) => `<div class="col-6"><div class="text-muted small">${k}</div><div class="fw-semibold small">${v}</div></div>`).join('')}
                </div>
            `;

            const ptbody = document.getElementById('fdt-products-tbody');
            if (ptbody) {
                ptbody.innerHTML = products.length
                    ? products.map(p => `
                        <tr>
                            <td class="small fw-semibold">${this.escapeHtml(p.name)}</td>
                            <td class="small">${this.fmtCurrency(p.price)}</td>
                            <td class="small">${p.stock_quantity}</td>
                            <td>${this.renderStatus(p.is_available ? 'Available' : 'Unavailable', p.is_available ? 'available' : 'unavailable')}</td>
                        </tr>
                    `).join('')
                    : `<tr><td colspan="4" class="text-center text-muted py-3 small">No products</td></tr>`;
            }

            const rvEl = document.getElementById('fdt-reviews-content');
            if (rvEl) {
                rvEl.innerHTML = reviews.length
                    ? `<div class="list-group list-group-flush">` + reviews.map(r => `
                        <div class="list-group-item border-0 px-0 py-2">
                            <div class="d-flex align-items-center gap-1 mb-1">
                                <span class="star-rating">${'★'.repeat(Math.round(r.rating || 0))}<span class="empty">${'★'.repeat(5 - Math.round(r.rating || 0))}</span></span>
                                <span class="text-muted small">(${Number(r.rating || 0).toFixed(1)})</span>
                            </div>
                            ${r.comment ? `<div class="small text-muted">"${this.escapeHtml(r.comment)}"</div>` : ''}
                        </div>
                    `).join('') + `</div>`
                    : `<div class="text-muted small py-3 text-center">No reviews yet</div>`;
            }

            // Action buttons
            const editBtn = document.getElementById('fdt-edit-btn');
            const disableBtn = document.getElementById('fdt-disable-btn');
            const enableBtn  = document.getElementById('fdt-enable-btn');
            const verifyBtn  = document.getElementById('fdt-verify-btn');
            const unverifyBtn = document.getElementById('fdt-unverify-btn');
            const isDisabled = !!farmer.is_disabled;
            if (editBtn) editBtn.onclick = () => { this.previousModalId = 'farmer-detail-modal'; this.openUserEdit(farmerId); };
            if (disableBtn) disableBtn.style.display = isDisabled ? 'none' : '';
            if (enableBtn)  enableBtn.style.display  = isDisabled ? '' : 'none';
            // Only show verify/unverify buttons for super_admin
            if (this.currentUserRole === 'super_admin') {
                if (verifyBtn) verifyBtn.classList.toggle('d-none', !!farmer.is_verified);
                if (unverifyBtn) unverifyBtn.classList.toggle('d-none', !farmer.is_verified);
            } else {
                if (verifyBtn) verifyBtn.classList.add('d-none');
                if (unverifyBtn) unverifyBtn.classList.add('d-none');
            }

            if (disableBtn) { disableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to disable this farmer?', { title: 'Disable Farmer', danger: true })) return;
                
                // Show loading state
                const spinner = document.getElementById('fdt-disable-spinner');
                if (disableBtn) disableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                const r = await fetch(`${this.apiBase}/admin/users/${farmerId}/disable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ is_disabled: true })
                });
                
                // Hide loading state
                if (disableBtn) disableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                
                if (r.ok) {
                    this.showToast('Farmer disabled', 'success');
                    disableBtn.style.display = 'none';
                    if (enableBtn) enableBtn.style.display = '';
                    const infoEl = document.getElementById('fdt-info-content');
                    if (infoEl) infoEl.innerHTML = infoEl.innerHTML.replace(/<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active<\/span>/, '<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:.85rem;font-weight:500;">Disabled</span>');
                    this.loadFarmers();
                }
            }; }

            if (verifyBtn) verifyBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to verify this farmer?', { title: 'Verify Farmer', danger: false })) return;
                
                // Show loading state
                const spinner = document.getElementById('fdt-verify-spinner');
                if (verifyBtn) verifyBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                await this.toggleFarmerVerification(farmerId, true);
                
                // Hide loading state
                if (verifyBtn) verifyBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                
                verifyBtn.classList.add('d-none');
                if (unverifyBtn) unverifyBtn.classList.remove('d-none');
                const infoEl = document.getElementById('fdt-info-content');
                if (infoEl) infoEl.innerHTML = infoEl.innerHTML.replace(/<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">No<\/span>/, '<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:.85rem;font-weight:500;">Yes</span>');
                this.loadFarmers();
            };
            if (unverifyBtn) unverifyBtn.onclick = async () => {
                // Open the unverify modal instead of using prompt
                this.currentUnverifyFarmerId = farmerId;
                const modal = document.getElementById('unverify-modal');
                this.modalZIndex++;
                modal.style.zIndex = this.modalZIndex;
                modal.classList.add('open');
                // Clear previous reason
                document.getElementById('unverify-reason').value = '';
            };
            if (enableBtn)  enableBtn.onclick  = async () => {
                if (!await this.adminConfirm('Are you sure you want to enable this farmer?', { title: 'Enable Farmer', danger: false })) return;
                
                // Show loading state
                const spinner = document.getElementById('fdt-enable-spinner');
                if (enableBtn) enableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                const r = await fetch(`${this.apiBase}/admin/users/${farmerId}/enable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }
                });
                
                // Hide loading state
                if (enableBtn) enableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                
                if (r.ok) {
                    this.showToast('Farmer enabled', 'success');
                    enableBtn.style.display = 'none';
                    if (disableBtn) disableBtn.style.display = '';
                    const infoEl = document.getElementById('fdt-info-content');
                    if (infoEl) infoEl.innerHTML = infoEl.innerHTML.replace(/<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled<\/span>/, '<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:.85rem;font-weight:500;">Active</span>');
                    this.loadFarmers();
                }
            };

            const modal = document.getElementById('farmer-detail-modal');
            if (modal) {
                this.modalZIndex++;
                modal.style.zIndex = this.modalZIndex;
                modal.classList.add('open');
            }
        } catch (err) {
            console.error('Farmer detail error:', err);
        }
    }

    // ────────────────────────────────────────────────────────────
    //  Admin detail modal
    // ────────────────────────────────────────────────────────────
    async openAdminDetailModal(userId) {
        try {
            const user = (this.lastAdmin || []).find(u => u.id === Number(userId));
            if (!user) {
                const ov = document.getElementById('sdt-overview-content');
                if (ov) ov.innerHTML = `<div class="text-center text-danger py-3">Admin not found. Please refresh the list.</div>`;
                this.showToast('Admin not found', 'error');
                return;
            }

            const ov = document.getElementById('sdt-overview-content');
            if (ov) ov.innerHTML = `
                <div class="row g-2 mb-3">
                    ${[
                        ['Full Name', user.full_name || '—'], ['Username', user.username || '—'],
                        ['Email', user.email || '—'], ['Phone', user.phone || '—'],
                        ['Address', user.address || '—'],
                        ['Role', this.formatRole(user.role)],
                        ['Status', user.is_disabled ? this.renderStatus('Disabled', 'disabled') : this.renderStatus('Active', 'active')],
                        ['Joined', user.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
                    ].map(([k,v]) => `<div class="col-6"><div class="text-muted small">${k}</div><div class="fw-semibold small">${v}</div></div>`).join('')}
                </div>
            `;

            const activityEl = document.getElementById('sdt-activity-content');
            if (activityEl) activityEl.innerHTML = `<div class="text-muted small py-3 text-center">Activity log not implemented</div>`;

            const isDisabled = !!user.is_disabled;
            const canToggle = this.currentUserRole === 'super_admin' && user.id !== this.currentUserId;
            const disableBtn = document.getElementById('sdt-disable-btn');
            const enableBtn  = document.getElementById('sdt-enable-btn');
            const editBtn    = document.getElementById('sdt-edit-btn');

            if (disableBtn) disableBtn.style.display = (isDisabled || !canToggle) ? 'none' : '';
            if (enableBtn)  enableBtn.style.display  = (!isDisabled || !canToggle) ? 'none' : '';
            if (editBtn)    editBtn.style.display    = canToggle ? '' : 'none';

            if (editBtn) { editBtn.onclick = () => { this.previousModalId = 'admin-detail-modal'; this.openUserEdit(userId); }; }

            if (disableBtn) { disableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to disable this admin member?', { title: 'Disable Admin', danger: true })) return;
                const spinner = document.getElementById('sdt-disable-spinner');
                if (disableBtn) disableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                const r = await fetch(`${this.apiBase}/admin/users/${userId}/disable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ is_disabled: true })
                });
                if (disableBtn) disableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                if (r.ok) {
                    this.showToast('Admin disabled', 'success');
                    disableBtn.style.display = 'none';
                    if (enableBtn) enableBtn.style.display = '';
                    const ov = document.getElementById('sdt-overview-content');
                    if (ov) ov.innerHTML = ov.innerHTML.replace(/<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active<\/span>/, '<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled</span>');
                    this.loadAdmin();
                }
            }; }

            if (enableBtn) { enableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to enable this admin member?', { title: 'Enable Admin', danger: false })) return;
                const spinner = document.getElementById('sdt-enable-spinner');
                if (enableBtn) enableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                const r = await fetch(`${this.apiBase}/admin/users/${userId}/enable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }
                });
                if (enableBtn) enableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                if (r.ok) {
                    this.showToast('Admin enabled', 'success');
                    enableBtn.style.display = 'none';
                    if (disableBtn) disableBtn.style.display = '';
                    const ov = document.getElementById('sdt-overview-content');
                    if (ov) ov.innerHTML = ov.innerHTML.replace(/<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled<\/span>/, '<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active</span>');
                    this.loadAdmin();
                }
            }; }

            const modal = document.getElementById('admin-detail-modal');
            if (modal) {
                this.modalZIndex++;
                modal.style.zIndex = this.modalZIndex;
                modal.classList.add('open');
            }
        } catch (err) {
            console.error('Admin detail error:', err);
        }
    }

    // ────────────────────────────────────────────────────────────
    //  All Users detail modal
    // ────────────────────────────────────────────────────────────
    async openAllUsersDetailModal(userId) {
        try {
            const user = (this.lastAllUsers || []).find(u => u.id === Number(userId));
            if (!user) {
                const ov = document.getElementById('adt-overview-content');
                if (ov) ov.innerHTML = `<div class="text-center text-danger py-3">User not found. Please refresh the list.</div>`;
                this.showToast('User not found', 'error');
                return;
            }

            const ov = document.getElementById('adt-overview-content');
            const overviewFields = [
                ['Full Name', user.full_name || '—'], ['Username', user.username || '—'],
                ['Email', user.email || '—'], ['Phone', user.phone || '—'],
                ['Address', user.address || '—'],
                ['Role', this.formatRole(user.role)],
                ['Status', user.is_disabled ? this.renderStatus('Disabled', 'disabled') : this.renderStatus('Active', 'active')],
                ['Joined', user.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
            ];

            // Add password field for superadmin
            if (this.currentUserRole === 'super_admin' && user.password) {
                overviewFields.push(['Password', `<span class="password-modal-masked" data-password="${this.escapeHtml(user.password)}" data-is-masked="true">${'•'.repeat(Math.min(user.password.length, 20))}</span> <button class="btn btn-sm btn-link p-0 ms-1 toggle-modal-password-btn text-dark"><i class="bi bi-eye"></i></button>`]);
            }

            if (ov) ov.innerHTML = `
                <div class="row g-2 mb-3">
                    ${overviewFields.map(([k,v]) => `<div class="col-6"><div class="text-muted small">${k}</div><div class="fw-semibold small">${v}</div></div>`).join('')}
                </div>
            `;

            const activityEl = document.getElementById('adt-activity-content');
            if (activityEl) activityEl.innerHTML = `<div class="text-muted small py-3 text-center">Activity log not implemented</div>`;

            const isSuperAdmin = user.role === 'super_admin';
            const isDisabled = !!user.is_disabled;
            const canToggle = this.currentUserRole === 'super_admin' && user.id !== this.currentUserId && !isSuperAdmin;
            const disableBtn = document.getElementById('adt-disable-btn');
            const enableBtn  = document.getElementById('adt-enable-btn');
            const editBtn    = document.getElementById('adt-edit-btn');

            if (disableBtn) disableBtn.style.display = (isDisabled || !canToggle) ? 'none' : '';
            if (enableBtn)  enableBtn.style.display  = (!isDisabled || !canToggle) ? 'none' : '';
            if (editBtn)    editBtn.style.display    = canToggle ? '' : 'none';

            if (editBtn) { editBtn.onclick = () => { this.previousModalId = 'all-users-detail-modal'; this.openUserEdit(userId); }; }

            if (disableBtn) { disableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to disable this user?', { title: 'Disable User', danger: true })) return;
                const spinner = document.getElementById('adt-disable-spinner');
                if (disableBtn) disableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                const r = await fetch(`${this.apiBase}/admin/users/${userId}/disable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ is_disabled: true })
                });
                if (disableBtn) disableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                if (r.ok) {
                    this.showToast('User disabled', 'success');
                    disableBtn.style.display = 'none';
                    if (enableBtn) enableBtn.style.display = '';
                    const ov = document.getElementById('adt-overview-content');
                    if (ov) ov.innerHTML = ov.innerHTML.replace(/<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active<\/span>/, '<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled</span>');
                    this.loadAllUsers();
                }
            }; }

            if (enableBtn) { enableBtn.onclick = async () => {
                if (!await this.adminConfirm('Are you sure you want to enable this user?', { title: 'Enable User', danger: false })) return;
                const spinner = document.getElementById('adt-enable-spinner');
                if (enableBtn) enableBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                const r = await fetch(`${this.apiBase}/admin/users/${userId}/enable`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }
                });
                if (enableBtn) enableBtn.disabled = false;
                if (spinner) spinner.classList.add('d-none');
                if (r.ok) {
                    this.showToast('User enabled', 'success');
                    enableBtn.style.display = 'none';
                    if (disableBtn) disableBtn.style.display = '';
                    const ov = document.getElementById('adt-overview-content');
                    if (ov) ov.innerHTML = ov.innerHTML.replace(/<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Disabled<\/span>/, '<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Active</span>');
                    this.loadAllUsers();
                }
            }; }

            const modal = document.getElementById('all-users-detail-modal');
            if (modal) {
                this.modalZIndex++;
                modal.style.zIndex = this.modalZIndex;
                modal.classList.add('open');
            }
        } catch (err) {
            console.error('All Users detail error:', err);
        }
    }

    toggleModalPasswordVisibility() {
        const passwordSpan = document.querySelector('.password-modal-masked');
        const toggleBtn = document.querySelector('.toggle-modal-password-btn');
        if (!passwordSpan || !toggleBtn) return;

        const isMasked = passwordSpan.dataset.isMasked === 'true';
        const password = passwordSpan.dataset.password;

        if (isMasked) {
            passwordSpan.textContent = password;
            passwordSpan.dataset.isMasked = 'false';
            toggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
        } else {
            const masked = '•'.repeat(Math.min(password.length, 20));
            passwordSpan.textContent = masked;
            passwordSpan.dataset.isMasked = 'true';
            toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
        }
    }

    // ────────────────────────────────────────────────────────────
    //  Profile section
    // ────────────────────────────────────────────────────────────
    async loadInitialSectionData() {
        try {
            const savedSection = localStorage.getItem('adminActiveSection') || 'overview';
            const validSections = new Set(['overview', 'orders', 'users', 'products', 'categories', 'catalog-products', 'farmers', 'suspicious-patterns', 'flagged-users', 'logs', 'admin', 'all-users', 'platform-settings', 'security-log', 'feature-flags', 'broadcast', 'database-backup', 'image-manager', 'notifications', 'chat', 'category-requests', 'product-approvals', 'verification-requests', 'subscription-requests', 'profile']);
            const safeSection = validSections.has(savedSection) ? savedSection : 'overview';

            // Load data based on initial section
            if (safeSection === 'orders') {
                await this.loadOrders();
            } else if (safeSection === 'users') {
                await this.loadUsers();
            } else if (safeSection === 'products') {
                await this.loadProducts();
            } else if (safeSection === 'categories') {
                await this.loadCategories();
            } else if (safeSection === 'catalog-products') {
                await this.loadProducts();
            } else if (safeSection === 'farmers') {
                await this.loadFarmers('all');
            } else if (safeSection === 'admin') {
                await this.loadAdmin();
            } else if (safeSection === 'all-users') {
                await this.loadAllUsers();
            } else if (safeSection === 'suspicious-patterns') {
                await this.loadSuspiciousPatterns();
            } else if (safeSection === 'flagged-users') {
                await this.loadFlaggedUsers();
            } else if (safeSection === 'security-log') {
                await this.loadSecurityLog();
            } else if (safeSection === 'platform-settings') {
                await this.loadPlatformSettings();
            } else if (safeSection === 'feature-flags') {
                await this.loadFeatureFlags();
            } else if (safeSection === 'notifications') {
                await this.loadNotifications();
            } else if (safeSection === 'category-requests') {
                await this.loadCategoryRequests();
            } else if (safeSection === 'product-approvals') {
                await this.loadProductApprovals();
            } else if (safeSection === 'verification-requests') {
                await this.loadVerificationRequests(1, 'all');
            } else if (safeSection === 'subscription-requests') {
                await this.loadSubscriptionRequests('all');
            } else if (safeSection === 'profile') {
                await this.loadProfileSection();
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

    async loadProfileSection() {
        try {
            const res = await fetch(`${this.apiBase}/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const { user } = await res.json();
            this._profileUser = user;

            const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
            const roleName = this.formatRole(user.role);
            const isDisabled = !!user.is_disabled;

            // Profile card
            const avatarEl = document.getElementById('profile-avatar-img');
            const avatarInitialEl = document.getElementById('profile-avatar-initial');
            const nameEl   = document.getElementById('profile-full-name');
            const roleEl   = document.getElementById('profile-role-label');
            
            // Set avatar to first letter of first name if no image
            if (avatarEl && !user.avatar_url) {
                const firstName = user.first_name || user.username || 'U';
                const firstLetter = firstName.charAt(0).toUpperCase();
                avatarEl.style.display = 'none';
                if (avatarInitialEl) {
                    avatarInitialEl.textContent = firstLetter;
                    avatarInitialEl.style.display = 'flex';
                }
            } else if (avatarEl && user.avatar_url) {
                avatarEl.src = user.avatar_url;
                avatarEl.style.display = 'block';
                if (avatarInitialEl) avatarInitialEl.style.display = 'none';
            }
            
            if (nameEl)   nameEl.textContent  = fullName;
            if (roleEl)   roleEl.textContent  = roleName;

            // Overview tab fields
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
            setVal('po-fullname', fullName);
            setVal('po-username', user.username || '');
            setVal('po-email', user.email);
            setVal('po-phone', user.phone);
            setVal('po-role', roleName);

            const nameParts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
            const dbFullName = nameParts.join(' ') || user.full_name || '';

            // Edit tab pre-fill with actual values
            const setValue = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.value = value || '';
            };
            setValue('pe-fullname', dbFullName);
            setValue('pe-firstname', user.first_name || '');
            setValue('pe-middlename', user.middle_name || '');
            setValue('pe-lastname', user.last_name || '');
            // Format phone with spaces (9XX XXX XXXX)
            const phoneDigits = String(user.phone || '').replace(/\D/g, '');
            if (phoneDigits.length > 0) {
                let formatted = phoneDigits[0];
                if (phoneDigits.length > 1) formatted += phoneDigits.slice(1, 3);
                if (phoneDigits.length > 3) formatted += ' ' + phoneDigits.slice(3, 6);
                if (phoneDigits.length > 6) formatted += ' ' + phoneDigits.slice(6, 10);
                setValue('pe-phone', formatted);
            } else {
                setValue('pe-phone', '');
            }

        } catch (err) {
            console.error('Profile section error:', err);
        }
    }

    async submitProfileEdit(e) {
        e.preventDefault();
        const btn     = document.getElementById('profile-save-btn');
        const spinner = document.getElementById('profile-save-spinner');
        const first_name  = document.getElementById('pe-firstname')?.value?.trim();
        const middle_name = document.getElementById('pe-middlename')?.value?.trim();
        const last_name   = document.getElementById('pe-lastname')?.value?.trim();
        const full_name   = document.getElementById('pe-fullname')?.value?.trim();
        const rawPhone    = document.getElementById('pe-phone')?.value?.trim();
        const profileUser = this._profileUser || {};
        const fallbackPhone = String(profileUser.phone || '').replace(/^\+63/, '');
        const effectiveFirstName = first_name || profileUser.first_name || '';
        const effectiveMiddleName = middle_name || profileUser.middle_name || '';
        const effectiveLastName = last_name || profileUser.last_name || '';
        const effectiveFullName = full_name || profileUser.full_name || `${effectiveFirstName} ${effectiveMiddleName} ${effectiveLastName}`.trim();
        const effectiveRawPhone = rawPhone || fallbackPhone;
        // Remove spaces for validation and API
        const phoneDigits = effectiveRawPhone.replace(/\s/g, '');
        // Validate phone format: must be 10 digits starting with 9
        if (phoneDigits && !/^9[0-9]{9}$/.test(phoneDigits)) {
            this.showToast('Phone must be 10 digits starting with 9 (e.g. 912 345 6789)', 'error');
            return;
        }
        // Prepend +63 if a value is entered; leave blank if empty
        const phone = phoneDigits ? ('+63' + phoneDigits) : '';

        if (btn) btn.disabled = true;
        if (spinner) spinner.classList.remove('d-none');
        try {
            const res = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ first_name: effectiveFirstName, middle_name: effectiveMiddleName, last_name: effectiveLastName, full_name: effectiveFullName, phone })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { this.showToast(data.message || 'Update failed', 'error'); return; }
            this.showToast('Profile updated', 'success');
            this._loadedSections.profile = false;
            this.loadProfileSection();
        } catch(e) {
            this.showToast('Update failed', 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
        }
    }

    async submitProfilePassword(e) {
        e.preventDefault();
        const btn     = document.getElementById('profile-pw-btn');
        const spinner = document.getElementById('profile-pw-spinner');
        const current = document.getElementById('pp-current')?.value;
        const newPw   = document.getElementById('pp-new')?.value;
        const confirm = document.getElementById('pp-confirm')?.value;

        if (newPw !== confirm) { this.showToast('Passwords do not match', 'error'); return; }
        if ((newPw || '').length < 6) { this.showToast('Password must be at least 6 characters', 'error'); return; }

        if (btn) btn.disabled = true;
        if (spinner) spinner.classList.remove('d-none');
        try {
            const res = await fetch(`${this.apiBase}/auth/change-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ currentPassword: current, newPassword: newPw })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { this.showToast(data.message || 'Failed to change password', 'error'); return; }
            this.showToast('Password changed', 'success');
            document.getElementById('profile-password-form')?.reset();
        } catch(e) {
            this.showToast('Failed to change password', 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
        }
    }

    // ────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────
    //  Notifications
    // ────────────────────────────────────────────────────────────
    async loadNotifications(page = 1) {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        list.innerHTML = `<div class="text-center py-4"><span class="spinner-border spinner-border-sm text-success"></span></div>`;
        try {
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
            const badge  = document.getElementById('notif-badge');
            const count  = document.getElementById('notif-count');
            if (badge) {
                badge.textContent = unread > 99 ? '99+' : String(unread);
                badge.style.display = unread ? '' : 'none';
            }
            if (count) count.textContent = unread > 99 ? '99+' : String(unread);

            // Play notification sound if unread count increased
            if (this.previousUnreadCount !== undefined && unread > this.previousUnreadCount) {
                this.playNotificationSound();
            }
            this.previousUnreadCount = unread;
        } catch (err) {
            const l = document.getElementById('notifications-list');
            if (l) l.innerHTML = `<div class="text-center py-4 text-muted small">Failed to load notifications.</div>`;
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
                <a class="dropdown-item notification-item-dropdown ${readStatus} py-2 notif-header-link" href="#" style="border:none;padding:0.75rem 1rem;margin:0.25rem 0.5rem;border-radius:8px;">
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

        // Add click handlers to navigate to notifications section and highlight selected notification
        dropdownList.querySelectorAll('.notif-header-link').forEach((link, index) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const notifId = recent[index]?.id;
                this.showSection('notifications');
                if (notifId) {
                    this.highlightNotification(notifId);
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
            fraud_alert: 'bi-exclamation-diamond-fill text-danger',
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

    _relativeTime(date) {
        if (isNaN(date.getTime())) return '';
        const diff = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diff < 60)    return 'just now';
        if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
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
            console.error('Failed to mark notification as read:', err);
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
                this.showToast('Failed to mark all as read', 'error');
                return;
            }
            this.loadNotifications();
        } catch (err) {
            this.showToast('Failed to mark all as read', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    //  Farmers analytics chart
    // ────────────────────────────────────────────────────────────
    async renderFarmersAnalyticsChart() {
        const el = document.getElementById('farmersRevenueChart');
        if (!el || typeof ApexCharts === 'undefined') return;
        try {
            let farmers = this.lastTopFarmers || [];
            if (!farmers.length) {
                const params = new URLSearchParams({ period: 'month', page: '1', limit: '10' });
                const res = await fetch(`${this.apiBase}/admin/dashboard/top-farmers?${params}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (!res.ok) return;
                const data = await res.json();
                farmers = data.farmers || [];
            }
            if (!farmers.length) return;

            const names    = farmers.map(f => f.full_name || f.username);
            const revenues = farmers.map(f => parseFloat(f.revenue) || 0);

            if (this._farmersChart) { this._farmersChart.destroy(); }
            this._farmersChart = new ApexCharts(el, {
                series: [{ name: 'Revenue', data: revenues }],
                chart: { type: 'bar', height: 380, toolbar: { show: false } },
                colors: ['#2d7a3a'],
                plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: false } },
                dataLabels: { enabled: false },
                xaxis: { categories: names, labels: { formatter: v => '₱' + this.fmtNumber(v) } },
                yaxis: { labels: { style: { fontSize: '12px' } } },
                tooltip: { y: { formatter: v => this.fmtCurrency(v) } },
                grid: { borderColor: '#f0f0f0' },
            });
            this._farmersChart.render();
        } catch (err) {
            console.warn('Farmers chart error:', err);
        }
    }

    async loadCategories(page = 1) {
        try {
            const pg = this.pagination.categories || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });
            const search = document.getElementById('category-search-input')?.value?.trim();
            const activeTab = document.querySelector('.categories-tabs .tab-btn.active');
            const statusFilter = activeTab ? activeTab.getAttribute('data-status') : '';
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            const response = await fetch(`${this.apiBase}/admin/categories?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (!response.ok) {
                const tbody = document.getElementById('categories-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Failed to load categories. Please try again.</td></tr>`;
                this.showMessage('Failed to load categories', 'error');
                return;
            }
            const data = await response.json();
            this.lastCategories = data.categories || [];
            pg.total = Number(data.total || 0);
            this.renderCategories(this.lastCategories);
            this.populateCategoryFilters();
        } catch (error) {
            console.error('Error loading categories:', error);
            const tbody = document.getElementById('categories-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Failed to load categories. Please try again.</td></tr>`;
            this.showMessage('Failed to load categories', 'error');
        }
    }

    populateCategoryFilters() {
        const categories = this.lastCategories || [];
        const filters = [
            'products-category-filter',
            'catalog-category-filter-bar'
        ];

        filters.forEach(filterId => {
            const select = document.getElementById(filterId);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">All categories</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    renderCategories(categories) {
        this.destroySortableTable('categories-table');
        const tbody = document.getElementById('categories-tbody');
        if (!tbody) return;

        let filtered = Array.isArray(categories) ? categories : [];
        this.filteredCategories = filtered;
        const pg = this.pagination.categories || { page: 1, total: 0, limit: 50 };

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_categories-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                filtered.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // name
                            valA = (a.name || '').toLowerCase();
                            valB = (b.name || '').toLowerCase();
                            break;
                        case 2: // description
                            valA = (a.description || '').toLowerCase();
                            valB = (b.description || '').toLowerCase();
                            break;
                        case 3: // product_count
                            valA = a.product_count || 0;
                            valB = b.product_count || 0;
                            break;
                        case 4: // status (is_disabled)
                            valA = a.is_disabled ? 1 : 0;
                            valB = b.is_disabled ? 1 : 0;
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-placeholder">No categories found.</td></tr>`;
        } else {
            tbody.innerHTML = filtered.map((category) => {
            const isDisabled = !!category.is_disabled;
            const statusPill = this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active');
            return `
            <tr>
                <td>${category.id}</td>
                <td>${this.escapeHtml(category.name || '')}</td>
                <td>${this.escapeHtml(category.description || '—')}</td>
                <td>${category.product_count || 0}</td>
                <td>${statusPill}</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green category-edit-btn" data-category-id="${category.id}">Edit</button>
                </td>
            </tr>
        `;
            }).join('');
        }

        this.renderPagination('categories-pagination', pg, (page) => {
            this.loadCategories(page);
        });

        this.refreshSortableTable('categories-table', { columns: [{ select: 5, sortable: false }] });

        const catalogCategorySelect = document.getElementById('catalog-category-select');
        if (catalogCategorySelect) {
            const options = ['<option value="">Select category</option>']
                .concat((this.lastCategories || []).filter(c => !c.is_disabled).map((category) => `<option value="${category.id}">${this.escapeHtml(category.name || '')}</option>`));
            catalogCategorySelect.innerHTML = options.join('');
        }

        // Also populate the filter-bar category dropdown in #catalog-products
        const filterCatSel = document.getElementById('catalog-category-filter-bar');
        if (filterCatSel) {
            filterCatSel.innerHTML = ['<option value="">All categories</option>']
                .concat((this.lastCategories || []).map(c => `<option value="${c.id}">${this.escapeHtml(c.name || '')}</option>`))
                .join('');
        }
    }

    async createCategory() {
        const nameEl = document.getElementById('new-category-name');
        const descEl = document.getElementById('new-category-description');
        const name = String(nameEl?.value || '').trim();
        const description = String(descEl?.value || '').trim();

        if (!name) {
            this.showMessage('Category name is required', 'error');
            return;
        }

        // Check for duplicate category name
        const existingCategory = (this.lastCategories || []).find(
            c => c.name.toLowerCase() === name.toLowerCase()
        );
        if (existingCategory) {
            this.showMessage('A category with this name already exists', 'error');
            return;
        }

        const restoreContext = this._currentCategoryRequestId;
        try {
            const response = await fetch(`${this.apiBase}/admin/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ name, description, type: 'agricultural' })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to create category', 'error');
                return;
            }

            this.showMessage('Category created', 'success');
            const newCategory = data.category || {};
            const newCategoryId = newCategory.id || null;
            if (nameEl) nameEl.value = '';
            if (descEl) descEl.value = '';
            document.getElementById('add-category-modal')?.classList.remove('open');
            await this.loadCategories();
            // If a request review panel is open, refresh its category dropdown and select the new category
            const reqCatSel = document.getElementById('category-request-category');
            if (reqCatSel && newCategoryId) {
                const opts = ['<option value="">Select category</option>'].concat((this.lastCategories || []).map((c) => {
                    return `<option value="${c.id}" ${Number(c.id) === Number(newCategoryId) ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`;
                })).concat(['<option value="__new__">+ Add New Category</option>']).join('');
                reqCatSel.innerHTML = opts;
            }
        } catch (err) {
            console.error('Create category error:', err);
            this.showMessage('Failed to create category', 'error');
        }
    }

    async sendAnnouncement() {
        const titleEl = document.getElementById('announcement-title');
        const messageEl = document.getElementById('announcement-message');

        const title = String(titleEl?.value || '').trim();
        const message = String(messageEl?.value || '').trim();

        // Read audience from checkboxes
        const audienceAll = document.getElementById('audience-all');
        const audienceFarmer = document.getElementById('audience-farmer');
        const audienceCustomer = document.getElementById('audience-customer');
        const audienceAdmin = document.getElementById('audience-admin');

        const selectedAudiences = [];
        const audienceDisplayNames = [];

        if (audienceAll?.checked) {
            selectedAudiences.push('all');
            audienceDisplayNames.push('All Users');
        } else {
            if (audienceFarmer?.checked) {
                selectedAudiences.push('farmer');
                audienceDisplayNames.push('Farmers');
            }
            if (audienceCustomer?.checked) {
                selectedAudiences.push('customer');
                audienceDisplayNames.push('Customers');
            }
            if (audienceAdmin?.checked) {
                selectedAudiences.push('admin');
                audienceDisplayNames.push('Admins');
            }
        }

        const audience = selectedAudiences.length > 0 ? selectedAudiences.join(',') : 'all';
        const audienceDisplay = selectedAudiences.length > 0 ? audienceDisplayNames.join(', ') : 'All users';

        if (!title) {
            this.showMessage('Title is required', 'error');
            return;
        }
        if (!message) {
            this.showMessage('Message is required', 'error');
            return;
        }

        // Show confirmation with announcement details
        const confirmed = await this.adminConfirm(
            `Title: ${title}\n\nMessage:\n${message}\n\nAudience: ${audienceDisplay}`,
            { title: 'Send Announcement', danger: false, okLabel: 'Send' }
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${this.apiBase}/superadmin/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ title, message, audience })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to send announcement', 'error');
                return;
            }

            this.showMessage('Announcement sent successfully', 'success');
            if (titleEl) titleEl.value = '';
            if (messageEl) messageEl.value = '';
            if (audienceAll) audienceAll.checked = false;
            if (audienceFarmer) audienceFarmer.checked = false;
            if (audienceCustomer) audienceCustomer.checked = false;
            if (audienceAdmin) audienceAdmin.checked = false;
        } catch (err) {
            console.error('Send announcement error:', err);
            this.showMessage('Failed to send announcement', 'error');
        }
    }

    setupAudienceCheckboxes() {
        const audienceAll = document.getElementById('audience-all');
        const audienceFarmer = document.getElementById('audience-farmer');
        const audienceCustomer = document.getElementById('audience-customer');
        const audienceAdmin = document.getElementById('audience-admin');

        if (audienceAll) {
            audienceAll.addEventListener('change', () => {
                if (audienceAll.checked) {
                    if (audienceFarmer) audienceFarmer.checked = false;
                    if (audienceCustomer) audienceCustomer.checked = false;
                    if (audienceAdmin) audienceAdmin.checked = false;
                }
            });
        }

        const specificCheckboxes = [audienceFarmer, audienceCustomer, audienceAdmin];
        specificCheckboxes.forEach(checkbox => {
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked && audienceAll) {
                        audienceAll.checked = false;
                    }
                });
            }
        });
    }

    async loadCatalogNames(page = 1) {
        try {
            const pg = this.pagination['catalog-products'] || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit)
            });
            const search = document.getElementById('catalog-search-input')?.value?.trim();
            const catId = document.getElementById('catalog-category-filter-bar')?.value || '';
            const activeTab = document.querySelector('.catalog-tabs .tab-btn.active');
            const statusFilter = activeTab ? activeTab.getAttribute('data-status') : '';
            if (search) params.set('search', search);
            if (catId) params.set('category', catId);
            if (statusFilter) params.set('status', statusFilter);
            const response = await fetch(`${this.apiBase}/admin/catalog-names?${params.toString()}`, {
                    headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (!response.ok) return;
            const data = await response.json();
            this.lastCatalogNames = data.names || [];
            pg.total = Number(data.total || 0);
            this.renderCatalogNames(this.lastCatalogNames);
        } catch (error) {
            console.error('Error loading catalog names:', error);
        }
    }

    renderCatalogNames(items) {
        this.destroySortableTable('catalog-products-table');
        const tbody = document.getElementById('catalog-names-tbody');
        if (!tbody) return;

        let filtered = Array.isArray(items) ? items : [];
        this.filteredCatalogNames = filtered;
        const pg = this.pagination['catalog-products'] || { page: 1, total: 0, limit: 50 };

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_catalog-products-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                filtered.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // name
                            valA = (a.name || '').toLowerCase();
                            valB = (b.name || '').toLowerCase();
                            break;
                        case 2: // category_name
                            valA = (a.category_name || '').toLowerCase();
                            valB = (b.category_name || '').toLowerCase();
                            break;
                        case 3: // product_count
                            valA = a.product_count || 0;
                            valB = b.product_count || 0;
                            break;
                        case 4: // status (is_disabled)
                            valA = a.is_disabled ? 1 : 0;
                            valB = b.is_disabled ? 1 : 0;
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="color:#64748b;">No catalog names yet.</td></tr>`;
            this.renderPagination('catalog-products-pagination', pg, (page) => {
                this.loadCatalogNames(page);
            });
            this.refreshSortableTable('catalog-products-table', { columns: [{ select: 5, sortable: false }] });
            return;
        }

        tbody.innerHTML = filtered.map((item) => {
            const isDisabled = !!item.is_disabled;
            const statusPill = this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active');
            return `
            <tr>
                <td>${item.id}</td>
                <td>${this.escapeHtml(item.name || '')}</td>
                <td>${this.escapeHtml(item.category_name || '—')}</td>
                <td>${item.product_count || 0}</td>
                <td>${statusPill}</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green catalog-edit-btn" data-catalog-id="${item.id}">Edit</button>
                </td>
            </tr>
        `;
        }).join('');

        this.renderPagination('catalog-products-pagination', pg, (page) => {
            this.loadCatalogNames(page);
        });

        this.refreshSortableTable('catalog-products-table', { columns: [{ select: 4, sortable: false }] });
    }

    async toggleCatalogNameDisabled(catalogId, disable) {
        const label = disable ? 'disable' : 'enable';
        if (!await this.adminConfirm(`Are you sure you want to ${label} this product name?`, { title: `${disable ? 'Disable' : 'Enable'} Product Name`, danger: disable })) return;
        try {
            const response = await fetch(`${this.apiBase}/admin/catalog-names/${catalogId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ is_disabled: disable })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) { this.showMessage(data.message || 'Failed to update', 'error'); return; }
            this.showMessage(disable ? 'Product name disabled' : 'Product name enabled', 'success');
            this.loadCatalogNames();
        } catch (error) {
            console.error('Toggle catalog name error:', error);
            this.showMessage('Operation failed', 'error');
        }
    }

    async deleteCatalogName(catalogId) {
        if (!await this.adminConfirm('Delete this product name permanently?', { title: 'Delete Product Name', okLabel: 'Delete' })) return;
        try {
            const response = await fetch(`${this.apiBase}/admin/catalog-names/${catalogId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) { this.showMessage(data.message || 'Failed to delete', 'error'); return; }
            this.showMessage('Product name deleted', 'success');
            this.loadCatalogNames();
        } catch (error) {
            console.error('Delete catalog name error:', error);
            this.showMessage('Delete failed', 'error');
        }
    }

    async addCatalogName() {
        const categoryId = Number(document.getElementById('catalog-category-select')?.value || 0);
        const nameEl = document.getElementById('new-catalog-name');
        const name = String(nameEl?.value || '').trim();

        if (!categoryId || !name) {
            this.showMessage('Category and product name are required', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/catalog-names`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ name, category_id: categoryId })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to add product name', 'error');
                return;
            }

            this.showMessage('Product name added to catalog', 'success');
            if (nameEl) nameEl.value = '';
            document.getElementById('add-catalog-modal')?.classList.remove('open');
            this.loadCatalogNames();
        } catch (error) {
            console.error('Add catalog name error:', error);
            this.showMessage('Failed to add product name', 'error');
        }
    }

    async editCatalogName(catalogId) {
        const item = (this.lastCatalogNames || []).find((entry) => Number(entry.id) === Number(catalogId));
        if (!item) return;

        const result = await this.openCatalogEditModal(item);
        if (!result) return;

        if (result.action === 'save') {
            try {
                const response = await fetch(`${this.apiBase}/admin/catalog-names/${catalogId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ name: result.name, category_id: result.category_id })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    this.showMessage(data.message || 'Failed to update product name', 'error');
                    return;
                }
                this.showMessage('Product name updated', 'success');
                this.loadCatalogNames();
            } catch (error) {
                console.error('Edit catalog name error:', error);
                this.showMessage('Failed to update product name', 'error');
            }
        } else if (result.action === 'disable') {
            await this.toggleCatalogNameDisabled(catalogId, !item.is_disabled);
        } else if (result.action === 'delete') {
            await this.deleteCatalogName(catalogId);
        }
    }

    async editCategory(categoryId) {
        const category = (this.lastCategories || []).find((item) => Number(item.id) === Number(categoryId));
        if (!category) return;

        const result = await this.openCategoryEditModal(category);
        if (!result) return;

        if (result.action === 'save') {
            try {
                const response = await fetch(`${this.apiBase}/admin/categories/${categoryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ name: result.name, description: result.description, type: 'agricultural' })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    this.showMessage(data.message || 'Failed to update category', 'error');
                    return;
                }
                this.showMessage('Category updated', 'success');
                this.loadCategories();
            } catch (error) {
                console.error('Update category error:', error);
                this.showMessage('Failed to update category', 'error');
            }
        } else if (result.action === 'disable') {
            await this.toggleCategoryDisabled(categoryId, !category.is_disabled);
        } else if (result.action === 'delete') {
            await this.deleteCategory(categoryId);
        }
    }

    async deleteCategory(categoryId) {
        if (!await this.adminConfirm('Delete this category permanently? This cannot be undone.', { title: 'Delete Category', okLabel: 'Delete' })) return;

        try {
            const response = await fetch(`${this.apiBase}/admin/categories/${categoryId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to delete category', 'error');
                return;
            }
            this.showMessage('Category deleted', 'success');
            this.loadCategories();
        } catch (error) {
            console.error('Delete category error:', error);
            this.showMessage('Failed to delete category', 'error');
        }
    }

    async loadCategoryRequests(status, search, page = 1) {
        try {
            const pg = this.pagination['category-requests'] || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const params = new URLSearchParams();
            const rawStatusVal = status !== undefined ? status : (document.querySelector('.category-request-tabs .tab-btn.active')?.dataset.status ?? 'all');
            const statusVal = rawStatusVal === '' ? 'all' : rawStatusVal;
            if (statusVal) params.set('status', statusVal);
            const searchVal = search !== undefined ? search : (document.getElementById('cat-req-search-input')?.value?.trim() ?? '');
            if (searchVal) params.set('search', searchVal);
            params.set('page', String(page));
            params.set('limit', String(pg.limit));

            const response = await fetch(`${this.apiBase}/admin/category-requests?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;

            const data = await response.json();
            this.lastCategoryRequests = data.requests || [];
            pg.total = Number(data.total || 0);
            this.renderCategoryRequests(this.lastCategoryRequests);
            
            // Load all requests for stats
            await this.loadCategoryRequestStats();
        } catch (error) {
            console.error('Error loading category requests:', error);
        }
    }

    async loadCategoryRequestStats() {
        try {
            const response = await fetch(`${this.apiBase}/admin/category-requests?status=all&limit=10000`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;

            const data = await response.json();
            this.updateCategoryRequestStats(data.requests || []);
        } catch (error) {
            console.error('Error loading category request stats:', error);
        }
    }

    updateCategoryRequestStats(requests) {
        const pending = requests.filter(r => r.status === 'pending').length;
        const approved = requests.filter(r => r.status === 'approved').length;
        const rejected = requests.filter(r => r.status === 'rejected').length;

        const pendingCount = document.getElementById('category-request-pending-count');
        const approvedCount = document.getElementById('category-request-approved-count');
        const rejectedCount = document.getElementById('category-request-rejected-count');

        if (pendingCount) pendingCount.textContent = pending;
        if (approvedCount) approvedCount.textContent = approved;
        if (rejectedCount) rejectedCount.textContent = rejected;
    }

    async loadProductApprovals(status, search, page = 1) {
        try {
            const pg = this.pagination['product-approvals'] || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const params = new URLSearchParams();
            const rawStatusVal = status !== undefined ? status : (document.querySelector('.product-approval-tabs .tab-btn.active')?.dataset.status ?? 'all');
            const statusVal = rawStatusVal === '' ? 'all' : rawStatusVal;
            if (statusVal) params.set('status', statusVal);
            const searchVal = search !== undefined ? search : (document.getElementById('product-approval-search-input')?.value?.trim() ?? '');
            if (searchVal) params.set('search', searchVal);
            params.set('page', String(page));
            params.set('limit', String(pg.limit));

            const response = await fetch(`${this.apiBase}/admin/products?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;

            const data = await response.json();
            this.lastProductApprovals = data.products || [];
            pg.total = Number(data.total || 0);
            this.renderProductApprovals(this.lastProductApprovals);
            this.updateProductApprovalsBadge();
            
            // Load all products for stats
            await this.loadProductApprovalStats();
        } catch (error) {
            console.error('Error loading product approvals:', error);
        }
    }

    async loadProductApprovalStats() {
        try {
            const response = await fetch(`${this.apiBase}/admin/products?status=all&limit=10000`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;

            const data = await response.json();
            this.updateProductApprovalStats(data.products || []);
        } catch (error) {
            console.error('Error loading product approval stats:', error);
        }
    }

    updateProductApprovalStats(products) {
        const pending = products.filter(p => p.status === 'pending').length;
        const approved = products.filter(p => p.status === 'approved').length;
        const rejected = products.filter(p => p.status === 'rejected').length;

        const pendingCount = document.getElementById('product-approval-pending-count');
        const approvedCount = document.getElementById('product-approval-approved-count');
        const rejectedCount = document.getElementById('product-approval-rejected-count');

        if (pendingCount) pendingCount.textContent = pending;
        if (approvedCount) approvedCount.textContent = approved;
        if (rejectedCount) rejectedCount.textContent = rejected;
    }

    renderProductApprovals(products) {
        this.destroySortableTable('product-approvals-table');
        const tbody = document.getElementById('product-approvals-tbody');
        if (!tbody) return;

        let filtered = Array.isArray(products) ? products : [];
        this.filteredProductApprovals = filtered;
        const pg = this.pagination['product-approvals'] || { page: 1, total: 0, limit: 50 };

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="9" class="table-placeholder">No products found</td></tr>`;
            this.renderPagination('product-approvals-pagination', pg, (p) => this.loadProductApprovals(undefined, undefined, p));
            return;
        }

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_product-approvals-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                filtered.sort((a, b) => {
                    let valA, valB;

                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // name
                            valA = (a.name || '').toLowerCase();
                            valB = (b.name || '').toLowerCase();
                            break;
                        case 2: // category_name
                            valA = (a.category_name || '').toLowerCase();
                            valB = (b.category_name || '').toLowerCase();
                            break;
                        case 3: // farmer name
                            valA = (a.farmer_shop_name || a.farmer_name || '').toLowerCase();
                            valB = (b.farmer_shop_name || b.farmer_name || '').toLowerCase();
                            break;
                        case 4: // price
                            valA = parseFloat(a.price) || 0;
                            valB = parseFloat(b.price) || 0;
                            break;
                        case 5: // stock
                            valA = a.stock || 0;
                            valB = b.stock || 0;
                            break;
                        case 6: // status
                            valA = (a.status || '').toLowerCase();
                            valB = (b.status || '').toLowerCase();
                            break;
                        case 7: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        default:
                            return 0;
                    }

                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {
                console.error('Failed to apply saved sort:', e);
            }
        }

        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td class="small text-muted">${p.id}</td>
                <td class="small fw-semibold">${this.escapeHtml(p.name || '')}</td>
                <td class="small">${this.escapeHtml(p.category_name || '—')}</td>
                <td class="small">
                    <div class="fw-semibold">${this.escapeHtml(p.farmer_shop_name || p.farmer_name || '—')}</div>
                    ${p.farmer_name ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(p.farmer_name)}</div>` : ''}
                </td>
                <td class="small">${this.fmtCurrency(p.price)}</td>
                <td class="small">${p.stock || 0}</td>
                <td class="small text-muted">${this.renderStatus(this.formatStatus(p.status), p.status)}</td>
                <td class="small text-muted">${p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green product-view-btn" data-product-id="${p.id}" type="button">View</button>
                </td>
            </tr>
        `).join('');

        this.refreshSortableTable('product-approvals-table');
        this.renderPagination('product-approvals-pagination', pg, (p) => this.loadProductApprovals(undefined, undefined, p));
    }

    updateProductApprovalsBadge() {
        const badge = document.getElementById('product-approvals-badge');
        if (!badge) return;
        const pendingCount = this.lastProductApprovals?.filter(p => p.status === 'pending').length || 0;
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    async loadProductApprovalsBadge() {
        try {
            const response = await fetch(`${this.apiBase}/admin/products?status=pending&limit=1`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const pendingCount = data.total || 0;
            const badge = document.getElementById('product-approvals-badge');
            if (badge) {
                badge.textContent = pendingCount;
                badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
            }
        } catch (error) {
            console.error('Error loading product approvals badge:', error);
        }
    }

    async loadSubscriptionBadgeCount() {
        try {
            const res = await fetch(`${this.apiBase}/admin/subscriptions?status=pending&limit=1`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const count = data.subscriptions?.length || 0;
            const badge = document.getElementById('subscription-requests-badge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        } catch (e) { console.error('Error loading subscription badge:', e); }
    }

    async loadSupportTicketsBadge() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets?status=open&limit=1`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            const count = data.total || 0;
            const badge = document.getElementById('chat-support-badge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        } catch (error) {
            console.error('Load support tickets badge error:', error);
        }
    }

    async loadSupportTickets(status = 'open') {
        this.supportTicketsCurrentStatus = status;
        this.supportTicketsCurrentPage = 1;

        try {
            const response = await fetch(`${this.apiBase}/support-tickets?status=${status}&page=${this.supportTicketsCurrentPage}&limit=${this.supportTicketsPerPage}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load tickets');

            const data = await response.json();
            this.supportTickets = data.tickets;
            this.supportTicketsTotal = data.total;
            this.renderAdminSupportTicketsTable();
            this.renderAdminSupportTicketsPagination();
        } catch (error) {
            console.error('Load support tickets error:', error);
            this.showError('Failed to load support tickets');
        }
    }

    renderAdminSupportTicketsTable() {
        const tbody = document.querySelector('#admin-support-tickets-table tbody');
        if (!tbody) return;

        if (this.supportTickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No support tickets in this status.</td></tr>';
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
                    <td>${this.escapeHtml(ticket.farmer_name || 'Unknown')}</td>
                    <td>${this.escapeHtml(ticket.subject)}</td>
                    <td><span style="background:${style.bg};color:${style.color};font-size:0.75rem;font-weight:600;padding:4px 10px;border-radius:9999px;text-transform:uppercase;">${style.label}</span></td>
                    <td>${new Date(ticket.created_at).toLocaleDateString('en-PH')}</td>
                    <td>${ticket.updated_at ? new Date(ticket.updated_at).toLocaleDateString('en-PH') : '—'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-admin-ticket-btn" data-id="${ticket.id}">View</button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.view-admin-ticket-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openAdminTicketDetail(btn.dataset.id));
        });
    }

    renderAdminSupportTicketsPagination() {
        const container = document.getElementById('admin-support-tickets-pagination');
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
                this.loadSupportTickets(this.supportTicketsCurrentStatus);
            });
        });
    }

    async openAdminTicketDetail(ticketId) {
        this.currentTicketId = ticketId;
        this.loadAdminTicketDetail(ticketId);
        new bootstrap.Modal(document.getElementById('admin-ticket-detail-modal')).show();
        this.startAdminTicketPolling();
    }

    async loadAdminTicketDetail(ticketId) {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Failed to load ticket');

            const data = await response.json();
            this.renderAdminTicketDetail(data.ticket, data.messages);
        } catch (error) {
            console.error('Load ticket detail error:', error);
            this.showError('Failed to load ticket');
        }
    }

    renderAdminTicketDetail(ticket, messages) {
        document.getElementById('admin-ticket-detail-subject').textContent = ticket.subject;

        const statusStyles = {
            open: { bg: '#dcfce7', color: '#16a34a', label: 'Open' },
            in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
            resolved: { bg: '#fef3c7', color: '#d97706', label: 'Resolved' },
            closed: { bg: '#fee2e2', color: '#dc2626', label: 'Closed' }
        };
        const style = statusStyles[ticket.status] || statusStyles.open;

        const statusEl = document.getElementById('admin-ticket-detail-status');
        statusEl.textContent = style.label;
        statusEl.style.background = style.bg;
        statusEl.style.color = style.color;
        statusEl.style.fontSize = '0.75rem';
        statusEl.style.fontWeight = '600';
        statusEl.style.padding = '4px 10px';
        statusEl.style.borderRadius = '9999px';
        statusEl.style.textTransform = 'uppercase';
        statusEl.className = '';

        document.getElementById('admin-ticket-detail-created').textContent = new Date(ticket.created_at).toLocaleDateString('en-PH');
        document.getElementById('admin-ticket-status-select').value = ticket.status;

        this.renderAdminTicketMessages(messages);
    }

    renderAdminTicketMessages(messages) {
        const container = document.getElementById('admin-ticket-messages-container');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No messages yet. Start the conversation.</p>';
            return;
        }

        // Sort messages by timestamp
        const sortedMessages = [...messages].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        );

        // Group messages: same sender within 5 minutes
        const groups = [];
        let currentGroup = null;

        sortedMessages.forEach((msg) => {
            const isSent = msg.sender_role !== 'farmer';
            const msgDate = new Date(msg.created_at);

            if (!currentGroup) {
                currentGroup = {
                    senderId: msg.sender_id,
                    lastMessageTime: msgDate,
                    messages: [msg]
                };
            } else {
                const timeDiff = (msgDate - currentGroup.lastMessageTime) / 60000;
                const sameSender = msg.sender_id === currentGroup.senderId;

                if (sameSender && timeDiff < 5) {
                    currentGroup.messages.push(msg);
                    currentGroup.lastMessageTime = msgDate;
                } else {
                    groups.push(currentGroup);
                    currentGroup = {
                        senderId: msg.sender_id,
                        lastMessageTime: msgDate,
                        messages: [msg]
                    };
                }
            }
        });

        if (currentGroup) {
            groups.push(currentGroup);
        }

        let html = '';
        const senderName = 'You';

        groups.forEach((group) => {
            const isSent = group.messages[0].sender_role !== 'farmer';
            const otherName = group.messages[0].sender_role === 'admin' ? 'Support Admin' : group.messages[0].sender_name;

            html += `<div class="chat-msg-group ${isSent ? 'sent' : 'received'}">`;

            group.messages.forEach((msg) => {
                const msgIsSent = msg.sender_role !== 'farmer';
                const displayName = msgIsSent ? senderName : otherName;
                const exactTime = new Date(msg.created_at).toLocaleString('en-PH');

                html += `
                    <div class="chat-msg ${msgIsSent ? 'sent' : 'received'}" title="${exactTime}">
                        <div class="chat-msg-bubble">
                            <p class="chat-msg-text">${this.escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    startAdminTicketPolling() {
        this.stopAdminTicketPolling();
        this.ticketPollFailures = 0;
        this.ticketPollInterval = setInterval(() => {
            this.pollAdminTicketMessages();
        }, 5000);
    }

    stopAdminTicketPolling() {
        if (this.ticketPollInterval) {
            clearInterval(this.ticketPollInterval);
            this.ticketPollInterval = null;
        }
    }

    async pollAdminTicketMessages() {
        if (!this.currentTicketId) return;

        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages?page=1&limit=50`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) throw new Error('Polling failed');

            const data = await response.json();
            this.renderAdminTicketMessages(data.messages);
            this.ticketPollFailures = 0;
        } catch (error) {
            console.error('Poll ticket messages error:', error);
            this.ticketPollFailures++;
            if (this.ticketPollFailures >= 3) {
                this.stopAdminTicketPolling();
                this.showError('Connection lost. Please refresh to see new messages.');
            }
        }
    }

    async sendAdminTicketMessage() {
        const input = document.getElementById('admin-ticket-message-input');
        const message = input.value.trim();
        if (!message) return;

        if (message.length > 500) {
            this.showError('Message exceeds maximum length of 500 characters');
            return;
        }

        const sendBtn = document.getElementById('btn-admin-send-ticket-message');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';

        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                input.value = '';
                document.getElementById('admin-ticket-message-char-count').textContent = '0/500';
                this.loadAdminTicketDetail(this.currentTicketId);
            } else {
                const data = await response.json();
                this.showError(data.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Send ticket message error:', error);
            this.showError('Failed to send message');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }

    async updateTicketStatus(ticketId, status) {
        if (status === 'closed') {
            if (!confirm('Are you sure you want to close this ticket?')) {
                document.getElementById('admin-ticket-status-select').value = this.supportTickets.find(t => t.id === ticketId)?.status || 'open';
                return;
            }
        }

        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                this.showToast('Ticket status updated', 'success');
                this.loadAdminTicketDetail(ticketId);
                this.loadSupportTickets(this.supportTicketsCurrentStatus);
                this.loadSupportTicketsBadge();
            } else {
                const data = await response.json();
                this.showError(data.message || 'Failed to update status');
            }
        } catch (error) {
            console.error('Update ticket status error:', error);
            this.showError('Failed to update status');
        }
    }

    async approveProduct(productId) {
        if (!await this.adminConfirm('Are you sure you want to approve this product?', { title: 'Approve Product', danger: false })) return;
        try {
            const response = await fetch(`${this.apiBase}/admin/products/${productId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) throw new Error('Failed to approve product');
            this.showToast('Product approved successfully', 'success');
            this.closeProductApprovalDetails();
            this.loadProductApprovals();
        } catch (error) {
            console.error('Error approving product:', error);
            this.showToast('Failed to approve product', 'error');
        }
    }

    async rejectProduct(productId) {
        this.currentRejectProductId = productId;
        const modal = document.getElementById('reject-product-modal');
        const textarea = document.getElementById('rejection-reason');
        if (textarea) textarea.value = '';
        if (modal) modal.classList.add('open');
    }

    async confirmRejectProduct() {
        const textarea = document.getElementById('rejection-reason');
        const reason = textarea?.value?.trim();
        
        if (!reason || reason.length === 0) {
            this.showToast('Please provide a rejection reason', 'error');
            return;
        }

        if (!this.currentRejectProductId) {
            this.showToast('No product selected for rejection', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/products/${this.currentRejectProductId}/reject`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rejection_reason: reason })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to reject product');
            }
            
            this.showToast('Product rejected successfully', 'success');
            
            // Close modal
            const modal = document.getElementById('reject-product-modal');
            if (modal) modal.classList.remove('open');
            
            // Close panel and refresh
            this.closeProductApprovalDetails();
            this.loadProductApprovals();
        } catch (error) {
            console.error('Error rejecting product:', error);
            this.showToast(error.message || 'Failed to reject product', 'error');
        }
    }

    renderCategoryRequestsPreview(requests) {
        const tbody = document.getElementById('cat-req-preview-tbody');
        if (!tbody) return;
        if (!(requests || []).length) {
            tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder">No pending requests</td></tr>`;
            return;
        }
        tbody.innerHTML = requests.slice(0, 10).map(r => `
            <tr>
                <td class="small text-muted">${r.id}</td>
                <td class="small fw-semibold">${this.escapeHtml(r.name || '')}</td>
                <td class="small">${this.escapeHtml(r.category_name || r.requested_category_name || '—')}</td>
                <td class="small">
                    <div class="fw-semibold">${this.escapeHtml(r.requested_by_shop_name || r.requested_by_full_name || r.requested_by_username || 'Farmer')}</div>
                    ${r.requested_by_username ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(r.requested_by_username)}</div>` : ''}
                </td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green category-requests-view-btn"
                        data-section="category-requests">View</button>
                </td>
            </tr>
        `).join('');

    }

    renderCategoryRequests(requests) {
        this.destroySortableTable('category-requests-table');
        const tbody = document.getElementById('category-requests-tbody');
        if (!tbody) return;

        let filtered = Array.isArray(requests) ? requests : [];
        this.filteredCategoryRequests = filtered;
        const pg = this.pagination['category-requests'] || { page: 1, total: 0, limit: 50 };

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_category-requests-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                filtered.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // name
                            valA = (a.name || '').toLowerCase();
                            valB = (b.name || '').toLowerCase();
                            break;
                        case 2: // category_name
                            valA = (a.category_name || a.requested_category_name || '').toLowerCase();
                            valB = (b.category_name || b.requested_category_name || '').toLowerCase();
                            break;
                        case 3: // requester name
                            valA = (a.requested_by_shop_name || a.requested_by_full_name || a.requested_by_username || '').toLowerCase();
                            valB = (b.requested_by_shop_name || b.requested_by_full_name || b.requested_by_username || '').toLowerCase();
                            break;
                        case 4: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        case 5: // status
                            valA = (a.status || '').toLowerCase();
                            valB = (b.status || '').toLowerCase();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No requests found.</td></tr>`;
            this.renderPagination('category-requests-pagination', pg, (page) => {
                this.loadCategoryRequests(undefined, undefined, page);
            });
            this.refreshSortableTable('category-requests-table', { columns: [{ select: 6, sortable: false }] });
            return;
        }

        tbody.innerHTML = filtered.map((request) => {
            const date   = request.created_at ? new Date(request.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const status = request.status || 'pending';
            const requesterName = this.escapeHtml(request.requested_by_shop_name || request.requested_by_full_name || request.requested_by_username || 'Farmer');
            const requesterSub = request.requested_by_full_name ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(request.requested_by_full_name)}</div>` : '';
            const requesterUser = request.requested_by_username ? ` <span style="color:#777171f0;font-size:.75rem">(${this.escapeHtml(request.requested_by_username)})</span>` : '';
            const requesterEmail = request.requested_by_email ? `<div class="text-muted" style="font-size:.75rem">${this.escapeHtml(request.requested_by_email)}</div>` : '';
            return `
            <tr>
                <td class="text-muted">${request.id}</td>
                <td class="fw-semibold">${this.escapeHtml(request.name || '')}</td>
                <td>${this.escapeHtml(request.category_name || request.requested_category_name || '—')}</td>
                <td><div class="fw-semibold">${requesterName}${requesterUser}</div>${requesterSub}${requesterEmail}</td>
                <td class="text-muted">${date}</td>
                <td>${this.renderStatus(this.formatStatus(status), status)}</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green category-request-review-btn" data-request-id="${request.id}">Review</button>
                </td>
            </tr>
        `}).join('');

        this.renderPagination('category-requests-pagination', pg, (page) => {
            this.loadCategoryRequests(undefined, undefined, page);
        });

        this.refreshSortableTable('category-requests-table', { columns: [{ select: 6, sortable: false }] });
    }

    openCategoryRequestPanel(requestId) {
        const request = (this.lastCategoryRequests || []).find((item) => Number(item.id) === Number(requestId));
        if (!request) return;

        // Store current request ID for context restoration after adding new category
        this._currentCategoryRequestId = requestId;

        const panel = document.getElementById('category-detail-panel');
        const content = document.getElementById('category-detail-content');
        if (!panel || !content) return;

        const categoryOptions = ['<option value="">Select category</option>'].concat((this.lastCategories || []).map((category) => {
            const selected = Number(category.id) === Number(request.category_id) ? 'selected' : '';
            return `<option value="${category.id}" ${selected}>${this.escapeHtml(category.name)}</option>`;
        })).join('');

        const requesterInfo = [
            request.requested_by_shop_name ? `<span class="fw-semibold">${this.escapeHtml(request.requested_by_shop_name)}</span>` : '',
            request.requested_by_full_name ? `<span class="text-muted" style="font-size:.85rem">${this.escapeHtml(request.requested_by_full_name)}</span>` : '',
            request.requested_by_username ? `<span style="color:#777171f0;font-size:.85rem">${this.escapeHtml(request.requested_by_username)}</span>` : '',
            request.requested_by_email ? `<span class="text-muted" style="font-size:.85rem">${this.escapeHtml(request.requested_by_email)}</span>` : '',
            request.requested_by_address ? `<span class="text-muted" style="font-size:.85rem">${this.escapeHtml(request.requested_by_address)}</span>` : ''
        ].filter(Boolean).join(' &nbsp;&bull;&nbsp; ');

        const categoryOptionsWithNew = categoryOptions.replace('</select>', '') + `<option value="__new__">+ Add New Category</option></select>`;

        content.innerHTML = `
            <div class="panel-header" style="background:#f8faf8;color:var(--ac-heading);padding:12px 16px;border-radius:8px 8px 0 0;border-bottom:1px solid var(--ac-border-light);">
                <h3 style="color:var(--ac-heading);margin:0;">Request #${request.id}</h3>
            </div>
            ${requesterInfo ? `<div class="panel-section" style="padding-bottom:0.5rem;border-bottom:1px solid #e8ede9;margin-bottom:0.5rem;"><div class="small">${requesterInfo}</div></div>` : ''}
            <div class="panel-section" style="display:flex; flex-direction:column; gap:0.6rem;">
                <label>Name</label>
                <input id="category-request-name" class="form-control form-control-sm" value="${this.escapeHtml(request.name || '')}">
                <label>Category</label>
                <select id="category-request-category" class="form-select form-select-sm">${categoryOptionsWithNew}</select>
                <label>Request Notes</label>
                <textarea class="form-control form-control-sm" rows="3" disabled maxlength="250">${this.escapeHtml((request.notes || '').substring(0, 250))}</textarea>
                <label>Review Notes</label>
                <textarea id="category-request-review-notes" class="form-control form-control-sm" rows="3" placeholder="Optional review notes (max 250 characters)" maxlength="250"></textarea>
                <div class="text-muted small" style="text-align:right; margin-top:2px;">
                    <span id="category-request-review-notes-counter">0</span>/250
                </div>
            </div>
        `;

        // Remove any existing footer to prevent button duplication
        panel.querySelectorAll('.detail-panel-footer').forEach((f) => f.remove());

        // Add footer with approve/decline buttons
        const footer = document.createElement('div');
        footer.className = 'detail-panel-footer gap-2';
        footer.innerHTML = `
            <button class="btn btn-sm btn-ac-red category-request-reject-btn" data-request-id="${request.id}" data-status="rejected">
                <span class="spinner-border spinner-border-sm d-none me-1 category-request-reject-spinner"></span>
                Decline
            </button>
            <button class="btn btn-sm btn-ac-green category-request-approve-btn" data-request-id="${request.id}" data-status="approved">
                <span class="spinner-border spinner-border-sm d-none me-1 category-request-approve-spinner"></span>
                Approve
            </button>
        `;
        panel.appendChild(footer);

        // Wire "Add New Category" dropdown option to open the Add Category modal
        const catSel = document.getElementById('category-request-category');
        if (catSel) {
            catSel.addEventListener('change', () => {
                if (catSel.value === '__new__') {
                    catSel.value = '';
                    document.getElementById('add-category-modal')?.classList.add('open');
                }
            });
        }

        // Wire character counter for review notes
        const reviewNotesEl = document.getElementById('category-request-review-notes');
        const counterEl = document.getElementById('category-request-review-notes-counter');
        if (reviewNotesEl && counterEl) {
            const updateCounter = () => {
                counterEl.textContent = reviewNotesEl.value.length;
            };
            reviewNotesEl.addEventListener('input', updateCounter);
            updateCounter();
        }

        // Add event listeners for approve/decline buttons
        panel.querySelector('.category-request-approve-btn')?.addEventListener('click', async () => {
            const requestId = Number(panel.querySelector('.category-request-approve-btn').dataset.requestId);
            if (!await this.adminConfirm('Are you sure you want to approve this category request?', { title: 'Approve Request', danger: false })) return;
            
            // Show loading state
            const approveBtn = panel.querySelector('.category-request-approve-btn');
            const rejectBtn = panel.querySelector('.category-request-reject-btn');
            const approveSpinner = panel.querySelector('.category-request-approve-spinner');
            if (approveBtn) approveBtn.disabled = true;
            if (rejectBtn) rejectBtn.disabled = true;
            if (approveSpinner) approveSpinner.classList.remove('d-none');
            
            this.reviewCategoryRequest(requestId, 'approved');
            // Remove footer after action
            footer.remove();
        });

        panel.querySelector('.category-request-reject-btn')?.addEventListener('click', async () => {
            const requestId = Number(panel.querySelector('.category-request-reject-btn').dataset.requestId);
            if (!await this.adminConfirm('Are you sure you want to reject this category request?', { title: 'Reject Request', danger: true })) return;
            
            // Show loading state
            const approveBtn = panel.querySelector('.category-request-approve-btn');
            const rejectBtn = panel.querySelector('.category-request-reject-btn');
            const rejectSpinner = panel.querySelector('.category-request-reject-spinner');
            if (approveBtn) approveBtn.disabled = true;
            if (rejectBtn) rejectBtn.disabled = true;
            if (rejectSpinner) rejectSpinner.classList.remove('d-none');
            
            this.reviewCategoryRequest(requestId, 'rejected');
            // Remove footer after action
            footer.remove();
        });

        panel.classList.add('active');
        this.syncPanelAccessibility();
    }

    closeCategoryDetails() {
        const panel = document.getElementById('category-detail-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    closeCustomerDetails() {
        const panel = document.getElementById('customer-detail-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    closeFarmerDetails() {
        const panel = document.getElementById('farmer-detail-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    closeCategoryEdit() {
        const panel = document.getElementById('category-edit-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    closeCatalogEdit() {
        const panel = document.getElementById('catalog-edit-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    closeProductEdit() {
        const panel = document.getElementById('edit-product-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    async reviewCategoryRequest(requestId, status) {
        const name = String(document.getElementById('category-request-name')?.value || '').trim();
        const category_id = Number(document.getElementById('category-request-category')?.value || 0);
        const review_notes = String(document.getElementById('category-request-review-notes')?.value || '').trim();

        if (status === 'approved' && (!name || !category_id)) {
            this.showMessage('Name and category are required for approval', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/category-requests/${requestId}/review`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    status,
                    name,
                    category_id,
                    review_notes
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to review request', 'error');
                return;
            }

            this.showMessage(`Request ${status === 'pending' ? 'saved' : status}`, 'success');
            if (status !== 'pending') this.closeCategoryDetails();
            this.loadCategories();
            this.loadCategoryRequests();
            this.loadCatalogNames();
        } catch (error) {
            console.error('Review category request error:', error);
            this.showMessage('Failed to review request', 'error');
        }
    }

    async toggleFarmerVerification(userId, isVerified) {
        try {
            const body = { is_verified: isVerified };
            
            // Require reason when unverifying
            if (!isVerified) {
                const reason = prompt('Please provide a reason for unverifying this farmer:');
                if (!reason) {
                    this.showMessage('Reason is required to unverify', 'error');
                    return;
                }
                body.reason = reason;
            }
            
            const response = await fetch(`${this.apiBase}/admin/users/${userId}/verify`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                this.showMessage('Farmer verification updated!', 'success');
                await this.loadFarmers();
            } else {
                const data = await response.json();
                this.showMessage(data.message || 'Failed to update verification', 'error');
            }
        } catch (error) {
            console.error('Error updating verification:', error);
            this.showMessage('Error updating verification', 'error');
        }
    }

    async updateUserRole(userId, newRole) {
        try {
            const response = await fetch(`${this.apiBase}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (response.ok) {
                this.showMessage('User role updated successfully!', 'success');
            } else {
                this.showMessage('Failed to update user role', 'error');
            }
        } catch (error) {
            console.error('Error updating user role:', error);
            this.showMessage('Error updating user role', 'error');
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            const response = await fetch(`${this.apiBase}/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                this.showMessage('Pre-order status updated successfully!', 'success');
                this.loadOrders();
            } else {
                this.showMessage('Failed to update pre-order status', 'error');
            }
        } catch (error) {
            console.error('Error updating pre-order status:', error);
            this.showMessage('Error updating pre-order status', 'error');
        }
    }

    async deleteUser(userId) {
        return this.toggleUserDisabled(userId, true);
    }

    async deleteProduct(productId) {
        if (!await this.adminConfirm('Are you sure you want to permanently delete this product? This action cannot be undone.', { title: 'Delete Product', danger: true })) return;

        // Find the delete button and show loading state
        const btn = document.querySelector(`.product-delete-btn[data-product-id="${productId}"]`);
        const originalText = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i>';
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showMessage('Product deleted successfully!', 'success');
                this.loadProducts();
                this.loadDashboardStats();
            } else {
                const data = await response.json().catch(() => ({}));
                this.showMessage(data.message || 'Failed to delete product', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showMessage('Error deleting product', 'error');
        } finally {
            // Restore button state
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText || 'Delete';
            }
        }
    }

    async toggleProductStatus(productId, isAvailable) {
        try {
            const response = await fetch(`${this.apiBase}/admin/products/${productId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ is_admin_disabled: isAvailable })
            });

            if (response.ok) {
                this.showMessage(`Product ${isAvailable ? 'disabled' : 'enabled'} successfully!`, 'success');
                this.loadProducts();
                this.loadDashboardStats();
            } else {
                this.showMessage('Failed to update product status', 'error');
            }
        } catch (error) {
            console.error('Error toggling product status:', error);
            this.showMessage('Error updating product status', 'error');
        }
    }

    async viewOrderDetails(orderId) {
        try {
            const response = await fetch(`${this.apiBase}/admin/orders/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.openOrderDetails(data.order);
            } else {
                this.showMessage('Failed to load order details', 'error');
            }
        } catch (error) {
            console.error('Error viewing order details:', error);
            this.showMessage('Error loading order details', 'error');
        }
    }

    applyOrderFilters() {
        this.loadOrders(1);
    }

    startUnreadPolling() {
        // Unread count is driven by SSE 'chat.message' events to avoid polling.
        // Initial load only.
        const load = async () => {
            try {
                const res = await fetch(`${this.apiBase}/messages/unread-count`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (!res.ok) return;
                const data = await res.json().catch(() => ({}));
                const count = Number(data.count || 0);
                const badge = document.getElementById('admin-chat-unread');
                if (badge) {
                    badge.textContent = String(count);
                    badge.style.display = count > 0 ? 'inline-flex' : 'none';
                }
            } catch (_) {
                // ignore
            }
        };
        load();
        // Refresh on SSE chat.message events (wired in setupRealtime)
        this._refreshUnread = load;

        // Poll subscription badge count every 60s
        const loadSubBadge = () => this.loadSubscriptionBadgeCount();
        loadSubBadge();
        this._subscriptionBadgeInterval = setInterval(loadSubBadge, 60000);
    }

    initChat() {
        // Initialize chat UI for admin dashboard if chat section exists
        if (document.getElementById('chat-messages') && typeof ChatUI !== 'undefined') {
            if (!window.chatUI) {
                window.chatUI = new ChatUI();
            }
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

    formatStatus(status) {
        if (!status) return 'Pending';
        const map = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            out_for_delivery: 'Out for Delivery',
            delivered: 'Delivered',
            completed: 'Completed',
            cancelled: 'Cancelled',
            refunded: 'Refunded',
        };
        return map[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }

    getStatusColor(status) {
        const colors = {
            pending: '#f59e0b',
            confirmed: '#2563eb',
            preparing: '#f97316',
            out_for_delivery: '#8b5cf6',
            delivered: '#41bf5b',
            completed: '#41bf5b',
            cancelled: '#dc2626',
            refunded: '#dc2626',
            active: '#41bf5b',
            disabled: '#dc2626',
            admin_disabled: '#dc2626',
            farmer_disabled: '#f97316',
            verified: '#41bf5b',
            unverified: '#dc2626',
            available: '#41bf5b',
            unavailable: '#dc2626',
            approved: '#41bf5b',
            rejected: '#dc2626',
        };
        return colors[status] || '#6c757d';
    }

    renderStatus(text, statusKey) {
        const key = (statusKey || '').toString().toLowerCase();
        const cls = this.getStatusClass(key);
        const direct = ['active','disabled','admin_disabled','farmer_disabled','approved','rejected','verified','unverified','available','unavailable','pending'];
        const pillClass = direct.includes(key) ? key : cls;
        return `<span class="status-pill ${pillClass}">${text}</span>`;
    }

    toggleChatDrawer(show) {
        const drawer = document.getElementById('admin-chat-drawer');
        if (!drawer) return;
        drawer.classList.toggle('active', show);
        if (show && this.activeSection !== 'chat') {
            this.showSection('chat');
        }
    }

    closeOrderDetails() {
        const panel = document.getElementById('order-detail-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    closeProductApprovalDetails() {
        const panel = document.getElementById('product-approval-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.setAttribute('inert', '');
        }
        this.syncPanelAccessibility();
    }

    openProductApprovalDetail(productId) {
        const product = this.lastProductApprovals?.find(p => p.id === productId);
        if (!product) return;

        const panel = document.getElementById('product-approval-panel');
        const content = document.getElementById('product-approval-content');
        if (!panel || !content) return;

        panel.removeAttribute('inert');
        panel.classList.add('active');
        this.syncPanelAccessibility();

        content.innerHTML = `
            <div class="panel-header">
                <h3>Product #${product.id}</h3>
                ${this.renderStatus(this.formatStatus(product.status), product.status)}
            </div>
            <div class="panel-section">
                <h4>Product Image</h4>
                ${product.image_url
                    ? `<img src="${this.escapeHtml(product.image_url)}" style="max-width:100%;max-height:300px;border-radius:8px;object-fit:contain;" onerror="this.style.display='none'">`
                    : `<div style="color:#64748b;font-size:0.875rem;">No image uploaded</div>`
                }
            </div>
            <div class="panel-section">
                <h4>Product Information</h4>
                <table class="w-100" style="font-size:0.875rem;border-collapse:collapse;">
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap">Name:</td>
                        <td class="fw-semibold pb-1">${this.escapeHtml(product.name || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap">Category:</td>
                        <td class="pb-1">${this.escapeHtml(product.category_name || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap">Farmer:</td>
                        <td class="pb-1">
                            <div class="fw-semibold">${this.escapeHtml(product.farmer_shop_name || product.farmer_name || '—')}</div>
                            ${product.farmer_name ? `<div class="text-muted small">${this.escapeHtml(product.farmer_name)}</div>` : ''}
                            ${product.farmer_username ? `<div class="text-muted small">@${this.escapeHtml(product.farmer_username)}</div>` : ''}
                            ${product.farmer_address ? `<div class="text-muted small">${this.escapeHtml(product.farmer_address)}</div>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap">Price:</td>
                        <td class="pb-1">${this.fmtCurrency(product.price)}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap">Stock:</td>
                        <td class="pb-1">${product.stock || 0}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2" style="white-space:nowrap">Description:</td>
                        <td>${this.escapeHtml(product.description || '—')}</td>
                    </tr>
                </table>
            </div>
            ${product.status === 'rejected' && product.rejection_reason ? `
            <div class="panel-section" style="background:#fef2f2;border-left:3px solid #dc2626;padding:12px;margin-bottom:16px;">
                <h4 style="color:#dc2626;margin:0 0 8px 0;font-size:0.875rem;">Rejection Reason</h4>
                <p style="margin:0;font-size:0.875rem;color:#7f1d1d;">${this.escapeHtml(product.rejection_reason)}</p>
            </div>
            ` : ''}
            ${product.status === 'pending' ? `
            <div class="panel-section">
                <h4>Actions</h4>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-ac-red product-reject-btn" data-product-id="${product.id}">Reject</button>
                    <button class="btn btn-sm btn-ac-green product-approve-btn" data-product-id="${product.id}">Approve</button>
                </div>
            </div>
            ` : ''}
        `;
    }

    openOrderDetails(order) {
        const panel = document.getElementById('order-detail-panel');
        const content = document.getElementById('order-detail-content');
        if (!panel || !content) return;
        this.currentOrderDetail = order;

        panel.removeAttribute('inert');
        panel.classList.add('active');
        this.syncPanelAccessibility();

        content.innerHTML = `
            <div class="panel-header">
                <h3>Pre-order #${order.id}</h3>
                ${this.renderStatus(this.formatStatus(order.status), order.status)}
            </div>
            <div class="panel-section">
                <h4>Customer</h4>
                <table class="w-100" style="font-size:0.875rem;border-collapse:collapse;">
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Full Name:</td>
                        <td class="fw-semibold pb-1" style="text-align:left">${this.escapeHtml(order.customer_name || order.full_name || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Username:</td>
                        <td class="pb-1" style="text-align:left">${this.escapeHtml(order.username || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Email:</td>
                        <td class="pb-1" style="text-align:left">${this.escapeHtml(order.email || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2" style="white-space:nowrap;text-align:left">Phone:</td>
                        <td style="text-align:left">${this.escapeHtml(order.customer_phone || '—')}</td>
                    </tr>
                </table>
            </div>
            ${order.farmer_name ? `
            <div class="panel-section">
                <h4>Farmer</h4>
                <table class="w-100" style="font-size:0.875rem;border-collapse:collapse;">
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Shop Name:</td>
                        <td class="fw-semibold pb-1" style="text-align:left">${this.escapeHtml(order.farmer_shop_name || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Full Name:</td>
                        <td class="pb-1" style="text-align:left">${this.escapeHtml(order.farmer_name || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Username:</td>
                        <td class="pb-1" style="text-align:left">${this.escapeHtml(order.farmer_username || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2 pb-1" style="white-space:nowrap;text-align:left">Email:</td>
                        <td class="pb-1" style="text-align:left">${this.escapeHtml(order.farmer_email || '—')}</td>
                    </tr>
                    <tr>
                        <td class="text-muted pe-2" style="white-space:nowrap;text-align:left">Address:</td>
                        <td style="text-align:left">${this.escapeHtml(order.farmer_address || '—')}</td>
                    </tr>
                </table>
            </div>
            ` : ''}
            <div class="panel-section">
                <h4>Order Info</h4>
                <p>Total: ${this.fmtCurrency(order.total_amount)}</p>
                <p>Date: ${new Date(order.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                ${order.delivery_address ? `<p>Address: ${order.delivery_address}</p>` : ''}
            </div>
            <div class="panel-section">
                <h4>Items</h4>
                ${(order.items || []).map(item => `
                    <div class="panel-item d-flex align-items-center gap-2">
                        ${item.image_url
                            ? `<img src="${this.escapeHtml(item.image_url)}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">`
                            : `<div style="width:44px;height:44px;border-radius:6px;background:#f0f3f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-image text-muted"></i></div>`}
                        <div>
                            <div class="fw-semibold">${this.escapeHtml(item.product_name || 'N/A')}</div>
                            <div class="small text-muted">${this.fmtNumber(item.quantity)} ${this.escapeHtml(item.unit || '')} &bull; ${this.fmtCurrency(item.price)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="panel-section">
                <div>
                    ${order.status === 'delivered' || order.status === 'cancelled'
                        ? `
                        <label>Status</label>
                        <div class="mt-1">
                            ${this.renderStatus(this.formatStatus(order.status), order.status)}
                        </div>
                        `
                        : `
                        <label for="order-status-select-${order.id}">Update Status</label>
                        <select id="order-status-select-${order.id}" class="form-select form-select-sm mt-1">
                            ${this.getAllStatusOptions(order.status).map(opt => `
                                <option value="${opt.value}" ${opt.value === order.status ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''} style="color:${opt.disabled ? '#6c757d' : opt.color};font-weight:500;">${opt.label}</option>
                            `).join('')}
                        </select>
                        `
                    }
                </div>
                ${order.status !== 'delivered' && order.status !== 'cancelled' ? `
                <div class="mt-2">
                    <button id="save-order-status-${order.id}" class="btn btn-small w-100 btn-ac-green" type="button" disabled>
                        Save Status
                    </button>
                </div>
                ` : ''}
                <div class="mt-2">
                    <button id="order-disable-btn-${order.id}" data-order-id="${order.id}" data-disable="${!order.is_disabled}"
                            class="btn w-100 btn-ac-red order-disable-btn" style="padding:8px;" type="button">
                        ${order.is_disabled ? 'Enable Pre-order' : 'Disable Pre-order'}
                    </button>
                </div>
            </div>
        `;
        panel.classList.add('active');
        this.syncPanelAccessibility();

        const statusSelect = document.getElementById(`order-status-select-${order.id}`);
        const saveBtn = document.getElementById(`save-order-status-${order.id}`);
        const disableBtn = document.getElementById(`order-disable-btn-${order.id}`);
        if (statusSelect && saveBtn) {
            saveBtn.disabled = true;

            statusSelect.addEventListener('change', () => {
                const next = statusSelect.value;
                this.pendingOrderStatus.set(order.id, next);
                saveBtn.disabled = next === order.status;
            });

            saveBtn.addEventListener('click', async () => {
                const next = this.pendingOrderStatus.get(order.id) || statusSelect.value;
                if (!next || next === order.status) return;
                saveBtn.disabled = true;
                await this.updateOrderStatus(order.id, next);
                // Reload the detail view to reflect latest state
                await this.viewOrderDetails(order.id);
            });
        }

        if (disableBtn) {
            disableBtn.addEventListener('click', () => {
                const orderId = Number(disableBtn.dataset.orderId);
                const shouldDisable = disableBtn.dataset.disable === 'true';
                this.toggleOrderDisabled(orderId, shouldDisable);
            });
        }
    }

    openCreateUserModal(preferredRole) {
        const modal = document.getElementById('create-user-modal');
        if (!modal) return;
        const form = document.getElementById('create-user-form');
        if (form) form.reset();

        // Clear text inputs that reset() might not catch
        ['create-user-firstname', 'create-user-middlename', 'create-user-lastname',
         'create-user-username', 'create-user-email', 'create-user-phone',
         'create-user-password', 'create-user-shopname'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const roleSel = document.getElementById('create-user-role');
        if (roleSel) {
            const roles = [];
            if (this.currentUserRole === 'super_admin') {
                roles.push({ value: 'admin', label: 'Admin' });
            }
            roles.push({ value: 'customer', label: 'Customer' });
            roles.push({ value: 'farmer', label: 'Farmer' });
            roleSel.innerHTML = roles.map(r => `<option value="${r.value}">${r.label}</option>`).join('');
            roleSel.value = ['customer', 'farmer', 'admin'].includes(preferredRole) ? preferredRole : 'customer';
            
            // Show/hide shop_name field based on role
            const shopNameGroup = document.getElementById('create-user-shop-name-group');
            if (shopNameGroup) {
                const updateShopNameVisibility = () => {
                    shopNameGroup.style.display = roleSel.value === 'farmer' ? 'block' : 'none';
                };
                roleSel.onchange = updateShopNameVisibility;
                updateShopNameVisibility();
            }
        } else {
            this.showMessage('Role dropdown not found', 'error');
            return;
        }

        const submitBtn = document.getElementById('create-user-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }

        modal.classList.add('open');
    }

    openUserEdit(userId) {
        const modal = document.getElementById('edit-user-modal');
        if (!modal) return;

        const user = (this.lastUsers || []).find(u => u.id === userId)
            || (this.lastFarmers || []).find(f => f.id === userId)
            || (this.lastAdmin || []).find(u => u.id === userId)
            || (this.lastAllUsers || []).find(u => u.id === userId);
        if (!user) return;

        const idEl = document.getElementById('edit-user-id');
        const fullNameEl = document.getElementById('edit-user-fullname');
        const usernameEl = document.getElementById('edit-user-username');
        const emailEl = document.getElementById('edit-user-email');
        const passwordEl = document.getElementById('edit-user-password');
        const phoneEl = document.getElementById('edit-user-phone');
        const zoneEl = document.getElementById('edit-user-zone');
        const provinceEl = document.getElementById('edit-user-province');
        const cityEl = document.getElementById('edit-user-city');
        const barangayEl = document.getElementById('edit-user-barangay');
        const streetEl = document.getElementById('edit-user-street');
        const addrPreviewEl = document.getElementById('edit-user-address-preview');

        if (idEl) idEl.value = String(userId);
        if (fullNameEl) fullNameEl.value = user.full_name || '';
        const firstNameEl = document.getElementById('edit-user-firstname');
        const middleNameEl = document.getElementById('edit-user-middlename');
        const lastNameEl = document.getElementById('edit-user-lastname');
        const shopNameEl = document.getElementById('edit-user-shopname');
        const shopNameGroup = document.getElementById('edit-user-shop-name-group');
        if (firstNameEl) firstNameEl.value = user.first_name || '';
        if (middleNameEl) middleNameEl.value = user.middle_name || '';
        if (lastNameEl) lastNameEl.value = user.last_name || '';
        if (shopNameEl) shopNameEl.value = user.shop_name || '';
        if (shopNameGroup) shopNameGroup.style.display = user.role === 'farmer' ? 'block' : 'none';

        if (usernameEl) usernameEl.value = user.username || '';
        if (emailEl) emailEl.value = user.email || '';
        if (passwordEl) passwordEl.value = '';
        if (phoneEl) {
            // Format phone with spaces (9XX XXX XXXX)
            const phoneDigits = String(user.phone || '').replace(/\D/g, '');
            if (phoneDigits.length > 0) {
                let formatted = phoneDigits[0];
                if (phoneDigits.length > 1) formatted += phoneDigits.slice(1, 3);
                if (phoneDigits.length > 3) formatted += ' ' + phoneDigits.slice(3, 6);
                if (phoneDigits.length > 6) formatted += ' ' + phoneDigits.slice(6, 10);
                phoneEl.value = formatted;
            } else {
                phoneEl.value = '';
            }
            phoneEl.oninput = () => {
                phoneEl.value = phoneEl.value.replace(/\D/g, '').slice(0, 10);
                if (phoneEl.value && !phoneEl.value.startsWith('9')) {
                    phoneEl.setCustomValidity('Phone number must start with 9');
                } else if (phoneEl.value.length > 0 && phoneEl.value.length < 10) {
                    phoneEl.setCustomValidity('Phone number must be 10 digits');
                } else {
                    phoneEl.setCustomValidity('');
                }
            };
        }

        // Reset PSGC address dropdowns
        if (zoneEl && window.PSGC) {
            window.PSGC.loadZones(zoneEl);
            zoneEl.value = '';
        }
        if (provinceEl) { provinceEl.innerHTML = '<option value="">Select Province</option>'; provinceEl.disabled = true; }
        if (cityEl) { cityEl.innerHTML = '<option value="">Select City / Municipality</option>'; cityEl.disabled = true; }
        if (barangayEl) { barangayEl.innerHTML = '<option value="">Select Barangay</option>'; barangayEl.disabled = true; }
        if (streetEl) streetEl.value = '';
        if (addrPreviewEl) addrPreviewEl.value = user.address || user.location || '';

        // Wire zone/province/city/barangay/street change handlers (bind once using named fn)
        if (zoneEl) zoneEl.onchange = () => this._editUserZoneChange();
        if (provinceEl) provinceEl.onchange = () => this._editUserProvinceChange();
        if (cityEl) cityEl.onchange = () => this._editUserCityChange();
        if (barangayEl) barangayEl.onchange = () => this._editUserUpdatePreview();
        if (streetEl) streetEl.oninput = () => this._editUserUpdatePreview();

        this.modalZIndex++;
        modal.style.zIndex = this.modalZIndex;
        modal.classList.add('open');
    }

    async _editUserZoneChange() {
        if (!window.PSGC) return;
        const zone = document.getElementById('edit-user-zone')?.value || '';
        const provinceEl = document.getElementById('edit-user-province');
        const cityEl = document.getElementById('edit-user-city');
        const barangayEl = document.getElementById('edit-user-barangay');
        await window.PSGC.onZoneChange(zone, { provinceEl, cityEl, barangayEl }).catch(() => {});
        this._editUserUpdatePreview();
    }

    async _editUserProvinceChange() {
        if (!window.PSGC) return;
        const province = document.getElementById('edit-user-province')?.value || '';
        const cityEl = document.getElementById('edit-user-city');
        const barangayEl = document.getElementById('edit-user-barangay');
        await window.PSGC.onProvinceChange(province, { cityEl, barangayEl }).catch(() => {});
        this._editUserUpdatePreview();
    }

    async _editUserCityChange() {
        if (!window.PSGC) return;
        const city = document.getElementById('edit-user-city')?.value || '';
        const barangayEl = document.getElementById('edit-user-barangay');
        if (city) {
            await window.PSGC.loadBarangays(city, barangayEl).catch(() => {});
            if (barangayEl) barangayEl.disabled = false;
        } else {
            window.PSGC.setSelectOptions(barangayEl, [], 'Select Barangay');
            if (barangayEl) barangayEl.disabled = true;
        }
        this._editUserUpdatePreview();
    }

    _editUserUpdatePreview() {
        const province = document.getElementById('edit-user-province')?.value?.trim() || '';
        const city = document.getElementById('edit-user-city')?.value?.trim() || '';
        const barangay = document.getElementById('edit-user-barangay')?.value?.trim() || '';
        const street = document.getElementById('edit-user-street')?.value?.trim() || '';
        const previewEl = document.getElementById('edit-user-address-preview');
        if (!previewEl) return;
        const composed = window.PSGC
            ? window.PSGC.formatAddress({ street, barangay, city, province })
            : [street, barangay, city, province].filter(Boolean).join(', ');
        previewEl.value = composed;
    }

    async submitUserEdit(e) {
        e.preventDefault();

        const userId = document.getElementById('edit-user-id')?.value;
        const full_name = document.getElementById('edit-user-fullname')?.value || '';
        const first_name = document.getElementById('edit-user-firstname')?.value || '';
        const middle_name = document.getElementById('edit-user-middlename')?.value || '';
        const last_name = document.getElementById('edit-user-lastname')?.value || '';
        const shop_name = document.getElementById('edit-user-shopname')?.value || '';
        const username = document.getElementById('edit-user-username')?.value || '';
        const email = document.getElementById('edit-user-email')?.value || '';
        const password = document.getElementById('edit-user-password')?.value || '';
        const rawPhone = document.getElementById('edit-user-phone')?.value?.trim() || '';
        const phone = rawPhone ? ('+63' + rawPhone.replace(/^\+63/, '')) : '';

        // Get user role to determine if shop_name should be included
        const user = (this.lastUsers || []).find(u => u.id === Number(userId))
            || (this.lastFarmers || []).find(f => f.id === Number(userId))
            || (this.lastAdmin || []).find(u => u.id === Number(userId))
            || (this.lastAllUsers || []).find(u => u.id === Number(userId));
        const isFarmer = user?.role === 'farmer';

        // Build address from PSGC fields (use preview if already composed)
        const province = document.getElementById('edit-user-province')?.value?.trim() || '';
        const city = document.getElementById('edit-user-city')?.value?.trim() || '';
        const barangay = document.getElementById('edit-user-barangay')?.value?.trim() || '';
        const street = document.getElementById('edit-user-street')?.value?.trim() || '';
        const addressPreview = document.getElementById('edit-user-address-preview')?.value?.trim() || '';
        const address = (province || city || barangay || street)
            ? (window.PSGC
                ? window.PSGC.formatAddress({ street, barangay, city, province })
                : [street, barangay, city, province].filter(Boolean).join(', '))
            : addressPreview;

        const payload = {
            full_name: full_name.trim(),
            username: username.trim(),
            email: email.trim(),
            phone: phone.trim(),
        };
        if (first_name.trim()) payload.first_name = first_name.trim();
        if (middle_name.trim()) payload.middle_name = middle_name.trim();
        if (last_name.trim()) payload.last_name = last_name.trim();
        if (address) payload.address = address;
        if (password.trim()) payload.password = password;
        if (isFarmer && shop_name.trim()) payload.shop_name = shop_name.trim();

        try {
            const response = await fetch(`${this.apiBase}/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                this.showMessage('User updated successfully!', 'success');
                this.closeModal('edit-user-modal');
                await this.loadUsers();
                await this.loadAdmin();
                await this.loadAllUsers();
                await this.loadFarmers();
            } else {
                this.showMessage(data.message || 'Failed to update user', 'error');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            this.showMessage('Error updating user', 'error');
        }
    }

    async submitUserCreate(e) {
        e.preventDefault();

        const first_name = document.getElementById('create-user-firstname')?.value?.trim() || '';
        const middle_name = document.getElementById('create-user-middlename')?.value?.trim() || '';
        const last_name = document.getElementById('create-user-lastname')?.value?.trim() || '';
        const username = document.getElementById('create-user-username')?.value?.trim() || '';
        const email = document.getElementById('create-user-email')?.value?.trim() || '';
        const role = document.getElementById('create-user-role')?.value?.trim() || '';
        const shop_name = document.getElementById('create-user-shopname')?.value?.trim() || '';
        const rawPhone = document.getElementById('create-user-phone')?.value?.trim() || '';
        // Validate phone format: must be 10 digits starting with 9 if provided
        if (rawPhone && !/^9[0-9]{9}$/.test(rawPhone)) {
            this.showMessage('Phone must be 10 digits starting with 9 (e.g. 9123456789)', 'error');
            return;
        }
        const phone = rawPhone ? ('+63' + rawPhone.replace(/^\+63/, '')) : '';
        const password = document.getElementById('create-user-password')?.value || '';
        const full_name = [first_name, middle_name, last_name].filter(Boolean).join(' ').trim();
        const submitBtn = document.getElementById('create-user-submit-btn');

        if (!first_name || !last_name || !username || !email || !role || password.length < 6) {
            this.showMessage('Please complete all required fields. Password must be at least 6 characters.', 'error');
            return;
        }

        const confirmed = await this.adminConfirm(
            `Name: ${full_name}\nEmail: ${email}\nUsername: ${username}\nRole: ${role}${phone ? `\nPhone: ${phone}` : ''}`,
            { title: 'Create Account', danger: false, okLabel: 'Create' }
        );
        if (!confirmed) return;

        const payload = {
            full_name,
            first_name,
            middle_name: middle_name || null,
            last_name,
            username,
            email,
            role,
            password,
            phone: phone || null
        };
        if (role === 'farmer' && shop_name) payload.shop_name = shop_name;

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating...';
            }
            const response = await fetch(`${this.apiBase}/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to create user', 'error');
                return;
            }

            this.showMessage('User created successfully!', 'success');
            this.closeModal('create-user-modal');
            await this.loadUsers();
            await this.loadAdmin();
            await this.loadAllUsers();
            if (role === 'farmer') {
                await this.loadFarmers();
            }
        } catch (error) {
            console.error('Error creating user:', error);
            this.showMessage('Error creating user', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        }
    }

    openProductEdit(productId) {
        const panel = document.getElementById('edit-product-panel');
        const content = document.getElementById('edit-product-content');
        if (!panel || !content) return;

        const product = (this.lastProducts || []).find(p => p.id === productId);
        if (!product) return;

        // Load catalog names for the dropdown
        const catalogNames = this.lastCatalogNames || [];
        const catalogOptions = catalogNames.map(cn => 
            `<option value="${cn.id}" ${cn.id === product.catalog_name_id ? 'selected' : ''}>${this.escapeHtml(cn.name)}</option>`
        ).join('');

        // Populate panel content
        content.innerHTML = `
            <input type="hidden" id="edit-product-id" value="${productId}">

            <div class="card mb-3">
                <img id="edit-product-image-preview"
                     src="${product.image_url || ''}" alt="Product preview"
                     class="card-img-top"
                     style="height:200px;object-fit:cover;${product.image_url ? '' : 'display:none'}">
                <div class="card-body p-2">
                    <label for="edit-product-image" class="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2" style="background-color: #3b82f6; color: white; border: none;">
                        <i class="bi bi-camera"></i>
                        <span>Change Image</span>
                    </label>
                    <input id="edit-product-image" type="file" accept="image/*" class="visually-hidden">
                    <span id="edit-product-image-spinner" class="spinner-border spinner-border-sm text-primary d-none ms-1"></span>
                </div>
            </div>

            <div class="form-group mb-3">
                <label class="form-label" for="edit-product-name">Product Name</label>
                <select id="edit-product-name" class="form-select">
                    ${catalogOptions}
                </select>
            </div>

            <div class="form-row-2 mb-3">
                <div class="form-group">
                    <label class="form-label" for="edit-product-price">Price (₱)</label>
                    <input type="number" id="edit-product-price"
                           class="form-control" min="0" step="0.01" value="${product.price || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="edit-product-stock">Stock</label>
                    <input type="number" id="edit-product-stock"
                           class="form-control" min="0" value="${product.stock_quantity || ''}">
                </div>
            </div>

            <div class="form-group mb-3">
                <label class="form-label" for="edit-product-location">Location</label>
                <input type="text" id="edit-product-location" class="form-control" value="${this.escapeHtml(product.location || '')}">
            </div>

            <div class="form-group mb-2">
                <label class="form-label" for="edit-product-description">Description</label>
                <textarea id="edit-product-description"
                          class="form-control" rows="3" maxlength="500">${this.escapeHtml(product.description || '')}</textarea>
                <div class="form-hint">
                    <span id="edit-product-description-count">${(product.description || '').length}</span>/500 characters
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h6 class="card-title mb-3">Farmer Information</h6>
                    <div class="mb-2">
                        <label class="form-label text-muted small">Shop Name:</label>
                        <div class="fw-semibold">${this.escapeHtml(product.farmer_shop_name || '—')}</div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label text-muted small">Full Name:</label>
                        <div class="fw-semibold">${this.escapeHtml(product.farmer_name || '—')}</div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label text-muted small">Username:</label>
                        <div class="fw-semibold" style="color:#777171f0">${this.escapeHtml(product.farmer_username || '—')}</div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label text-muted small">Email:</label>
                        <div class="text-muted">${this.escapeHtml(product.farmer_email || '—')}</div>
                    </div>
                    <div class="mb-0">
                        <label class="form-label text-muted small">Address:</label>
                        <div class="text-muted">${this.escapeHtml(product.farmer_address || '—')}</div>
                    </div>
                </div>
            </div>
        `;

        // Set up event listeners
        const descInput = document.getElementById('edit-product-description');
        const descCount = document.getElementById('edit-product-description-count');
        if (descInput && descCount) {
            descInput.addEventListener('input', () => {
                descCount.textContent = descInput.value.length;
            });
        }

        // Image preview listener
        const imageInput = document.getElementById('edit-product-image');
        const imagePreview = document.getElementById('edit-product-image-preview');
        if (imageInput && imagePreview) {
            imageInput.addEventListener('change', () => {
                const file = imageInput.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    imagePreview.src = event.target.result;
                    imagePreview.style.display = '';
                };
                reader.readAsDataURL(file);
            });
        }

        const disableBtn = document.getElementById('edit-product-disable-btn');
        const isDisabled = !!product.is_admin_disabled;
        if (disableBtn) {
            disableBtn.textContent = isDisabled ? 'Enable' : 'Disable';
            disableBtn.className = `btn btn-sm ${isDisabled ? 'btn-ac-green' : 'btn-ac-red'} me-auto`;
            disableBtn.onclick = async () => {
                if (!await this.adminConfirm(`Are you sure you want to ${isDisabled ? 'enable' : 'disable'} this product?`, { title: `${isDisabled ? 'Enable' : 'Disable'} Product`, danger: !isDisabled })) return;
                this.toggleProductStatus(product.id, !isDisabled);
                this.closeProductEdit();
            };
        }

        // Save button
        const saveBtn = document.getElementById('edit-product-save');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const event = new Event('submit', { bubbles: true, cancelable: true });
                this.submitProductEdit(event);
            };
        }

        // Cancel button
        const cancelBtn = document.getElementById('edit-product-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeProductEdit();
        }

        // Close button
        const closeBtn = document.getElementById('edit-product-panel-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeProductEdit();
        }

        panel.classList.add('active');
        panel.removeAttribute('inert');
        this.syncPanelAccessibility();
    }

    async submitProductEdit(e) {
        e.preventDefault();
        if (!await this.adminConfirm('Are you sure you want to save these product changes?', { title: 'Save Product Changes', danger: false })) {
            return;
        }

        const productId = document.getElementById('edit-product-id').value;
        const catalogNameId = document.getElementById('edit-product-name').value;
        const price = document.getElementById('edit-product-price').value;
        const stock_quantity = document.getElementById('edit-product-stock').value;
        const location = document.getElementById('edit-product-location').value;
        const description = document.getElementById('edit-product-description').value;
        const imageInput = document.getElementById('edit-product-image');
        const formData = new FormData();
        formData.append('catalog_name_id', catalogNameId);
        formData.append('price', price);
        formData.append('stock_quantity', stock_quantity);
        formData.append('location', location);
        formData.append('description', description);
        if (imageInput && imageInput.files && imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
        }

        // Show loading state
        const saveBtn = document.getElementById('edit-product-save');
        const spinner = document.getElementById('edit-product-save-spinner');
        if (saveBtn) {
            saveBtn.disabled = true;
        }
        if (spinner) {
            spinner.classList.remove('d-none');
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.ok) {
                this.showMessage('Product updated successfully!', 'success');
                this.closeProductEdit();
                this.loadProducts();
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to update product', 'error');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showMessage('Error updating product', 'error');
        } finally {
            // Hide loading state
            if (saveBtn) {
                saveBtn.disabled = false;
            }
            if (spinner) {
                spinner.classList.add('d-none');
            }
        }
    }

    async deleteOrder(orderId) {
        return this.toggleOrderDisabled(orderId, true);
    }

    async toggleUserDisabled(userId, disable) {
        const label = disable ? 'disable' : 'enable';
        if (!await this.adminConfirm(`Are you sure you want to ${label} this user?`, { title: `${disable ? 'Disable' : 'Enable'} User`, danger: disable })) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/users/${userId}/${disable ? 'disable' : 'enable'}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                this.showMessage(`User ${disable ? 'disabled' : 'enabled'} successfully!`, 'success');
                this.loadUsers();
                this.loadAdmin();
                this.loadAllUsers();
                this.loadFarmers();
                this.loadDashboardStats();
            } else {
                this.showMessage(data.message || `Failed to ${label} user`, 'error');
            }
        } catch (error) {
            console.error(`Error trying to ${label} user:`, error);
            this.showMessage(`Error trying to ${label} user`, 'error');
        }
    }

    async toggleOrderDisabled(orderId, disable) {
        const label = disable ? 'disable' : 'enable';
        if (!await this.adminConfirm(`Are you sure you want to ${label} this order?`, { title: `${disable ? 'Disable' : 'Enable'} Order`, danger: disable })) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/orders/${orderId}${disable ? '' : '/enable'}`, {
                method: disable ? 'DELETE' : 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                this.showMessage(`Order ${disable ? 'disabled' : 'enabled'} successfully!`, 'success');
                this.loadOrders();
                this.loadDashboardStats();
            } else {
                this.showMessage(data.message || `Failed to ${label} order`, 'error');
            }
        } catch (error) {
            console.error(`Error trying to ${label} order:`, error);
            this.showMessage(`Error trying to ${label} order`, 'error');
        }
    }

    async toggleCategoryDisabled(categoryId, disable) {
        const label = disable ? 'disable' : 'enable';
        if (!await this.adminConfirm(`Are you sure you want to ${label} this category?`, { title: `${disable ? 'Disable' : 'Enable'} Category`, danger: disable })) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/categories/${categoryId}${disable ? '/disable' : '/enable'}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                this.showMessage(`Category ${disable ? 'disabled' : 'enabled'} successfully!`, 'success');
                this.loadCategories();
            } else {
                this.showMessage(data.message || `Failed to ${label} category`, 'error');
            }
        } catch (error) {
            console.error(`Error trying to ${label} category:`, error);
            this.showMessage(`Error trying to ${label} category`, 'error');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            modal.style.display = '';
            modal.style.zIndex = '';
        }
        if (modalId === 'edit-product-modal') {
            document.body.style.overflow = '';
        }
        const parentModalId = this.previousModalId;
        this.previousModalId = null;
        if (parentModalId) {
            const parentModalEl = document.getElementById(parentModalId);
            if (parentModalEl) {
                this.modalZIndex--;
                parentModalEl.style.zIndex = this.modalZIndex;
                parentModalEl.classList.add('open');
            }
        }
    }

    renderPagination(containerId, pg, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const { page, total, limit } = pg;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);

        // Always show count info; only show page buttons when needed
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

    resetPaginationPage(section) {
        if (this.pagination?.[section]) {
            this.pagination[section].page = 1;
        }
    }

    getPaginatedSlice(section, items) {
        const list = Array.isArray(items) ? items : [];
        const pg = this.pagination?.[section] || { page: 1, limit: Math.max(list.length, 1), total: list.length };
        const totalPages = Math.max(1, Math.ceil(list.length / pg.limit));
        pg.page = Math.min(Math.max(pg.page || 1, 1), totalPages);
        pg.total = list.length;

        const start = (pg.page - 1) * pg.limit;
        return {
            items: list.slice(start, start + pg.limit),
            pageState: { page: pg.page, total: pg.total, limit: pg.limit }
        };
    }

    getFilteredCategories() {
        const search = document.getElementById('category-search-input')?.value?.trim().toLowerCase() || '';
        const activeTab = document.querySelector('.categories-tabs .tab-btn.active');
        const statusFilter = activeTab ? activeTab.getAttribute('data-status') : '';
        return (this.lastCategories || []).filter((category) => {
            const nameMatch = !search || (category.name || '').toLowerCase().includes(search);
            const statusMatch = !statusFilter
                || (statusFilter === 'active' && !category.is_disabled)
                || (statusFilter === 'disabled' && !!category.is_disabled);
            return nameMatch && statusMatch;
        });
    }

    getFilteredCatalogNames() {
        const search = document.getElementById('catalog-search-input')?.value?.trim().toLowerCase() || '';
        const catId = document.getElementById('catalog-category-filter-bar')?.value || '';
        const activeTab = document.querySelector('.catalog-tabs .tab-btn.active');
        const statusFilter = activeTab ? activeTab.getAttribute('data-status') : '';
        return (this.lastCatalogNames || []).filter((item) => {
            const nameMatch = !search || (item.name || '').toLowerCase().includes(search);
            const catMatch = !catId || String(item.category_id) === catId;
            const statusMatch = !statusFilter
                || (statusFilter === 'active' && !item.is_disabled)
                || (statusFilter === 'disabled' && !!item.is_disabled);
            return nameMatch && catMatch && statusMatch;
        });
    }

    renderRecentActivityList(activity) {
        const el = document.getElementById('recent-activity-list');
        if (!el) return;

        const items = activity || [];
        if (!items.length) {
            el.innerHTML = `<div class="text-center text-muted py-3 small">No activity for this period</div>`;
            this.renderPagination('activity-pagination', this.pagination.activity, () => {});
            return;
        }

        const colorIcons = {
            success: 'bi-check-circle-fill text-success',
            primary: 'bi-pencil-fill text-primary',
            danger: 'bi-x-circle-fill text-danger',
            warning: 'bi-exclamation-circle-fill text-warning',
            info: 'bi-info-circle-fill text-info',
            secondary: 'bi-circle text-secondary',
        };

        el.innerHTML = items.map((entry) => {
            const iconClass = colorIcons[entry.color] || 'bi-circle text-secondary';
            const time = entry.created_at ? new Date(entry.created_at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
            const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }) : '';
            return `
                <div class="activity-item d-flex gap-2 py-2 border-bottom">
                    <i class="bi ${iconClass} mt-1" style="font-size:.9rem;flex-shrink:0;"></i>
                    <div class="flex-grow-1">
                        <div class="small fw-semibold" style="color:#111">${this.escapeHtml(entry.description)}</div>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted" style="font-size:.72rem">${this.escapeHtml(entry.actor)}</span>
                            <span class="text-muted" style="font-size:.72rem">${date ? date + ' · ' : ''}${time}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.renderPagination('activity-pagination', this.pagination.activity, (page) => {
            this.pagination.activity.page = page;
            this.loadRecentActivity(this._activityPeriod || 'today', page);
        });
    }

    renderTopProductsTable(products) {
        const tbody = document.getElementById('top-products-tbody');
        if (!tbody) return;

        if (!products.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3 small">No data for this period</td></tr>`;
            this.renderPagination('top-products-pagination', this.pagination['top-products'], () => {});
            return;
        }

        tbody.innerHTML = products.map((product) => `
            <tr>
                <td class="text-center">
                    ${product.image_url
                        ? `<img src="${this.escapeHtml(product.image_url)}" class="product-thumb" alt="">`
                        : `<div class="product-thumb-placeholder"><i class="bi bi-image"></i></div>`
                    }
                </td>
                <td>
                    <div class="fw-semibold small">${this.escapeHtml(product.name)}</div>
                    <div class="text-muted" style="font-size:.7rem">#${product.id}</div>
                </td>
                <td class="small">${this.fmtCurrency(product.price)}</td>
                <td class="small">${this.fmtNumber(product.sold_count)}</td>
                <td class="small text-success fw-semibold">${this.fmtCurrency(product.revenue)}</td>
            </tr>
        `).join('');

        this.renderPagination('top-products-pagination', this.pagination['top-products'], (page) => {
            this.pagination['top-products'].page = page;
            this.loadTopProducts(this._topProductsPeriod || 'today', page);
        });
    }

    renderTopFarmersTable(farmers) {
        const tbody = document.getElementById('top-farmers-tbody');
        if (!tbody) return;

        if (!farmers.length) {
            tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-3 small">No data for this period</td></tr>`;
            this.renderPagination('top-farmers-pagination', this.pagination['top-farmers'], () => {});
            return;
        }

        tbody.innerHTML = farmers.map((farmer) => `
            <tr>
                <td class="text-center">
                    <div>
                        <div class="small fw-semibold">${this.escapeHtml(farmer.shop_name || farmer.full_name || farmer.username)}</div>
                        ${farmer.full_name && farmer.shop_name ? `<div class="text-muted" style="font-size:.7rem">${this.escapeHtml(farmer.full_name)}</div>` : ''}
                        <div class="text-muted" style="font-size:.7rem">${farmer.order_count} orders</div>
                    </div>
                </td>
                <td class="small text-success fw-semibold">${this.fmtCurrency(farmer.revenue)}</td>
            </tr>
        `).join('');

        this.renderPagination('top-farmers-pagination', this.pagination['top-farmers'], (page) => {
            this.pagination['top-farmers'].page = page;
            this.loadTopFarmers(this._topFarmersPeriod || 'today', page);
        });
    }

    renderOrders(orders) {
        this.destroySortableTable('orders-table');
        const tbody = document.getElementById('orders-tbody');
        if (!tbody) return;

        let sortedOrders = orders || [];

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_orders-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                sortedOrders.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 1: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 2: // customer name
                            valA = (a.full_name || a.username || '').toLowerCase();
                            valB = (b.full_name || b.username || '').toLowerCase();
                            break;
                        case 3: // total_amount
                            valA = parseFloat(a.total_amount) || 0;
                            valB = parseFloat(b.total_amount) || 0;
                            break;
                        case 4: // status
                            valA = (a.status || '').toLowerCase();
                            valB = (b.status || '').toLowerCase();
                            break;
                        case 5: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        if (!sortedOrders.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No orders found</td></tr>`;
            this.refreshSortableTable('orders-table', { columns: [{ select: 6, sortable: false }] });
            return;
        }

        tbody.innerHTML = sortedOrders.map(order => {
            const isDisabled = !!order.is_disabled;
            const statusClass = isDisabled ? 'pending' : this.getStatusClass(order.status);
            const statusLabel = isDisabled ? 'Disabled' : this.formatStatus(order.status);
            const customerInfo = `
                <div class="fw-semibold">${this.escapeHtml(order.full_name || '—')}${order.username ? ` <span style="color:#777171f0;font-size:.75rem">(${this.escapeHtml(order.username)})</span>` : ''}</div>
                ${order.email ? `<div class="text-muted">${this.escapeHtml(order.email)}</div>` : ''}
            `;
            const productImage = order.product_image || '/images/placeholder-product.jpg';
            return `
            <tr>
                <td class="text-center"><img src="${this.escapeHtml(productImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td class="col-order">#${order.id}</td>
                <td>${customerInfo}</td>
                <td>${this.fmtCurrency(order.total_amount)}</td>
                <td style="text-align:center">${this.renderStatus(statusLabel, isDisabled ? 'disabled' : order.status)}</td>
                <td class="text-muted">${order.created_at ? new Date(order.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                <td>
                    <button class="btn btn-sm py-0 px-2 btn-ac-green order-view-btn" data-order-id="${order.id}" type="button">View</button>
                </td>
            </tr>
        `;
        }).join('');

        this.refreshSortableTable('orders-table', { columns: [{ select: 6, sortable: false }] });
    }

    renderRecentSalesTable(orders) {
        const tbody = document.getElementById('recent-sales-tbody');
        if (!tbody) return;

        if (!orders.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3 small">No recent sales</td></tr>`;
            this.renderPagination('recent-sales-pagination', this.pagination['recent-sales'], () => {});
            return;
        }

        tbody.innerHTML = orders.map((order) => {
            const customerName = order.full_name || (order.username ? `<span style="color:#777171f0">${this.escapeHtml(order.username)}</span>` : 'Customer');
            const productImage = order.product_image || '/images/placeholder-product.jpg';
            const unitPrice = order.price || 0;
            const quantity = order.quantity || 1;
            const revenue = order.total_amount || 0;
            return `
            <tr>
                <td class="text-center"><img src="${this.escapeHtml(productImage)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                <td class="small">${customerName}</td>
                <td class="small">
                    <div class="fw-semibold">${this.escapeHtml(order.product_name || '—')}</div>
                    <div class="text-muted" style="font-size:.7rem">#${order.id}</div>
                </td>
                <td class="small">${this.fmtCurrency(unitPrice)}</td>
                <td class="small text-center">${quantity}</td>
                <td class="small">${this.fmtCurrency(revenue)}</td>
                <td>${this.renderStatus(this.formatStatus(order.status), order.status)}</td>
            </tr>
            `;
        }).join('');

        this.renderPagination('recent-sales-pagination', this.pagination['recent-sales'], (page) => {
            this.pagination['recent-sales'].page = page;
            this.loadRecentSales(this._recentSalesPeriod || 'today', page);
        });
    }

    async fetchAllFarmers() {
        const farmers = [];
        const batchSize = 200;
        let page = 1;
        let total = 0;

        while (true) {
            const response = await fetch(`${this.apiBase}/admin/users?role=farmer&page=${page}&limit=${batchSize}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to load farmers page ${page}`);
            }

            const data = await response.json();
            const batch = data.users || [];
            total = Number(data.total || batch.length || 0);
            farmers.push(...batch);

            if (!batch.length || farmers.length >= total || batch.length < batchSize) {
                break;
            }

            page += 1;
        }

        return { farmers, total };
    }

    async loadFarmers(tab = 'all', page = 1) {
        try {
            const pg = this.pagination?.farmers || { page: 1, total: 0, limit: 50 };
            pg.page = page;
            const search = (document.getElementById('farmers-search-input')?.value || '').trim();
            const activeTab = document.querySelector('.farmers-tabs .tab-btn.active');
            const status = activeTab ? activeTab.getAttribute('data-status') : '';
            const verification = (document.getElementById('farmers-verification-filter')?.value || '').trim();
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pg.limit),
                role: 'farmer'
            });
            if (search) params.set('search', search);
            if (status) params.set('status', status);
            if (verification) params.set('verification', verification);

            const response = await fetch(`${this.apiBase}/admin/users?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastFarmers = data.users || [];
                pg.total = Number(data.total || 0);
                this.renderFarmers(this.lastFarmers);
                this.renderPagination('farmers-pagination', pg, (p) => this.loadFarmers(tab, p));
            } else {
                const tbody = document.getElementById('farmers-all-tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Failed to load farmers. Please try again.</td></tr>`;
                this.showMessage('Failed to load farmers', 'error');
            }
        } catch (error) {
            console.error('Error loading farmers:', error);
            const tbody = document.getElementById('farmers-all-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Failed to load farmers. Please try again.</td></tr>`;
            this.showMessage('Failed to load farmers', 'error');
        }
    }

    renderFarmers(farmers) {
        this.destroySortableTable('farmers-all-table');

        // API now handles pagination, so render directly
        let pagedFarmers = farmers;
        const pageState = this.pagination?.farmers || { page: 1, total: farmers.length, limit: 50 };

        // Apply saved sort from localStorage
        const savedSort = localStorage.getItem('adminTableSort_farmers-all-table');
        if (savedSort) {
            try {
                const [colIndex, direction] = JSON.parse(savedSort);
                const sortMultiplier = direction === 'asc' ? 1 : -1;

                pagedFarmers.sort((a, b) => {
                    let valA, valB;
                    switch (colIndex) {
                        case 0: // id
                            valA = a.id;
                            valB = b.id;
                            break;
                        case 1: // shop_name
                            valA = (a.shop_name || '').toLowerCase();
                            valB = (b.shop_name || '').toLowerCase();
                            break;
                        case 2: // owner name
                            valA = (`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.full_name || '').toLowerCase();
                            valB = (`${b.first_name || ''} ${b.last_name || ''}`.trim() || b.full_name || '').toLowerCase();
                            break;
                        case 3: // username
                            valA = (a.username || '').toLowerCase();
                            valB = (b.username || '').toLowerCase();
                            break;
                        case 4: // email
                            valA = (a.email || '').toLowerCase();
                            valB = (b.email || '').toLowerCase();
                            break;
                        case 5: // status (is_disabled)
                            valA = a.is_disabled ? 1 : 0;
                            valB = b.is_disabled ? 1 : 0;
                            break;
                        case 6: // is_verified
                            valA = a.is_verified ? 1 : 0;
                            valB = b.is_verified ? 1 : 0;
                            break;
                        case 7: // created_at
                            valA = new Date(a.created_at || 0).getTime();
                            valB = new Date(b.created_at || 0).getTime();
                            break;
                        default:
                            return 0;
                    }
                    if (valA < valB) return -1 * sortMultiplier;
                    if (valA > valB) return 1 * sortMultiplier;
                    return 0;
                });
            } catch (e) {}
        }

        // Helper: build a unified row for any farmer
        const buildRow = (f) => {
            const isDisabled = !!f.is_disabled;
            const isVerified = !!f.is_verified;
            const shopName = f.shop_name || '—';
            const ownerName = `${f.first_name || ''} ${f.last_name || ''}`.trim() || f.full_name || '—';
            return `
                <tr>
                    <td class="text-muted">${f.id}</td>
                    <td class="fw-semibold">${this.escapeHtml(shopName)}</td>
                    <td class="text-muted">${this.escapeHtml(ownerName)}</td>
                    <td style="color:#777171f0">${this.escapeHtml(f.username || '—')}</td>
                    <td>${this.escapeHtml(f.email)}</td>
                    <td style="text-align:center">${this.renderStatus(isDisabled ? 'Disabled' : 'Active', isDisabled ? 'disabled' : 'active')}</td>
                    <td style="text-align:center">${isVerified ? '<span class="badge bg-success align-middle">Verified</span><i class="bi bi-check-circle-fill text-primary ms-1 align-middle"></i>' : '<span class="badge bg-secondary align-middle">Unverified</span><i class="bi bi-x-circle-fill text-danger ms-1 align-middle"></i>'}</td>
                    <td class="text-muted">${f.created_at ? new Date(f.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>
                        <button class="btn btn-sm py-0 px-2 btn-ac-green farmer-view-btn" data-farmer-id="${f.id}">View</button>
                    </td>
                </tr>`;
        };

        // ── All farmers table ──
        const allTbody = document.getElementById('farmers-all-tbody');
        if (allTbody) {
            allTbody.innerHTML = pagedFarmers.length
                ? pagedFarmers.map(f => buildRow(f)).join('')
                : `<tr><td colspan="9" class="text-center text-muted py-4">No farmers found</td></tr>`;
        }

        this.refreshSortableTable('farmers-all-table', { columns: [{ select: 8, sortable: false }] });

        this.renderPagination('farmers-pagination', pageState, (page) => {
            this.loadFarmers('all', page);
        });
    }

    visitMainSite() {
        // Redirect super admin to main site
        window.location.href = '/';
    }

    logout() {
        localStorage.removeItem('token');
        window.location.href = '/';
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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

    adminConfirm(message, { title = 'Confirm Action', danger = true, okLabel = 'Confirm' } = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('admin-confirm-modal');
            if (!modal) {
                console.warn('[adminConfirm] Confirm modal not found — rejecting action');
                resolve(false);
                return;
            }

            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            const iconEl = document.getElementById('confirm-icon');
            if (iconEl) {
                iconEl.className = danger
                    ? 'ac-confirm-modal__icon ac-confirm-modal__icon--danger'
                    : 'ac-confirm-modal__icon ac-confirm-modal__icon--success';
                iconEl.innerHTML = danger
                    ? '<i class="bi bi-exclamation-triangle-fill"></i>'
                    : '<i class="bi bi-send-check-fill"></i>';
            }
            const okBtn = document.getElementById('confirm-ok-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            okBtn.className = danger ? 'btn btn-sm btn-ac-red' : 'btn btn-sm ac-btn-primary';
            okBtn.textContent = okLabel;
            modal.classList.add('open');

            const done = (result) => {
                modal.classList.remove('open');
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(result);
            };

            document.getElementById('confirm-ok-btn').addEventListener('click', () => done(true), { once: true });
            document.getElementById('confirm-cancel-btn').addEventListener('click', () => done(false), { once: true });
        });
    }

    openCategoryEditModal(category) {
        return new Promise((resolve) => {
            const panel = document.getElementById('category-edit-panel');
            const content = document.getElementById('category-edit-content');
            if (!panel || !content) { resolve(null); return; }
            const saveBtn = document.getElementById('category-edit-save');
            const cancelBtn = document.getElementById('category-edit-cancel');
            const closeBtn = document.getElementById('category-edit-panel-close');
            const disableBtn = document.getElementById('category-edit-toggle-disable');
            const deleteBtn = document.getElementById('category-edit-delete');

            // Populate panel content
            content.innerHTML = `
                <div class="form-group mb-3">
                    <label class="form-label">
                        Category Name <span class="required-mark">*</span>
                    </label>
                    <input type="text" id="category-edit-name"
                           class="form-control" placeholder="Category name" value="${this.escapeHtml(category.name || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">
                        Description
                        <span class="form-label-hint">(optional, max 200 characters)</span>
                    </label>
                    <input type="text" id="category-edit-description"
                           class="form-control" placeholder="Brief description"
                           maxlength="200" value="${this.escapeHtml(category.description || '')}">
                </div>
                <div class="form-group mt-4">
                    <label class="form-label fw-semibold">Linked Products (${Number(category.product_count || 0)})</label>
                    <div class="small text-muted mb-2">
                        Shows all products and farmers linked to this category.
                    </div>
                    <div id="category-linked-products" class="border rounded p-2 bg-light" style="max-height: 420px; overflow-y: auto;">
                        <span class="text-muted small">Loading linked products...</span>
                    </div>
                </div>
            `;

            const nameInput = document.getElementById('category-edit-name');
            nameInput.classList.remove('is-invalid');

            // Set Disable button label
            if (disableBtn) {
                const isDisabled = !!category.is_disabled;
                disableBtn.textContent = isDisabled ? 'Enable' : 'Disable';
                disableBtn.className = `btn btn-sm ${isDisabled ? 'btn-ac-green me-auto' : 'btn-ac-red me-auto'}`;
            }

            // Show delete button only for super_admin
            if (deleteBtn) {
                deleteBtn.style.display = this.currentUserRole === 'super_admin' ? 'inline-block' : 'none';
            }

            panel.classList.add('active');
            panel.removeAttribute('inert');
            this.syncPanelAccessibility();
            nameInput.focus();

            this.loadCategoryLinkedProducts(category.id);

            const done = (result) => {
                panel.classList.remove('active');
                panel.setAttribute('inert', '');
                this.syncPanelAccessibility();
                saveBtn.replaceWith(saveBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                closeBtn.replaceWith(closeBtn.cloneNode(true));
                if (disableBtn) disableBtn.replaceWith(disableBtn.cloneNode(true));
                if (deleteBtn) deleteBtn.replaceWith(deleteBtn.cloneNode(true));
                resolve(result);
            };

            document.getElementById('category-edit-save').addEventListener('click', async () => {
                const n = document.getElementById('category-edit-name').value.trim();
                if (!n) { document.getElementById('category-edit-name').classList.add('is-invalid'); return; }
                if (!await this.adminConfirm('Are you sure you want to save these changes?', { title: 'Save Category', danger: false })) return;
                
                // Show loading state
                const saveBtn = document.getElementById('category-edit-save');
                const spinner = document.getElementById('category-edit-save-spinner');
                if (saveBtn) saveBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                done({ action: 'save', name: n, description: document.getElementById('category-edit-description').value.trim() });
                
                // Hide loading state (after done is called, but we need to do it in the caller)
                // Actually, since this is a Promise-based modal, the loading state should be handled by the caller
                // For now, let's reset it after a short delay or let the caller handle it
                setTimeout(() => {
                    if (saveBtn) saveBtn.disabled = false;
                    if (spinner) spinner.classList.add('d-none');
                }, 100);
            }, { once: true });
            document.getElementById('category-edit-cancel').addEventListener('click', () => done(null), { once: true });
            document.getElementById('category-edit-panel-close').addEventListener('click', () => done(null), { once: true });
            document.getElementById('category-edit-toggle-disable')?.addEventListener('click', async () => {
                if (!await this.adminConfirm(`Are you sure you want to ${category.is_disabled ? 'enable' : 'disable'} this category?`, { title: `${category.is_disabled ? 'Enable' : 'Disable'} Category`, danger: !category.is_disabled })) return;
                done({ action: 'disable' });
            }, { once: true });
            document.getElementById('category-edit-delete')?.addEventListener('click', async () => {
                if (!await this.adminConfirm('Are you sure you want to delete this category? This action cannot be undone.', { title: 'Delete Category', danger: true })) return;
                done({ action: 'delete' });
            }, { once: true });
        });
    }

    openCatalogEditModal(item) {
        return new Promise((resolve) => {
            const panel = document.getElementById('catalog-edit-panel');
            const content = document.getElementById('catalog-edit-content');
            if (!panel || !content) { resolve(null); return; }
            const saveBtn = document.getElementById('catalog-edit-save');
            const cancelBtn = document.getElementById('catalog-edit-cancel');
            const closeBtn = document.getElementById('catalog-edit-panel-close');
            const disableBtn = document.getElementById('catalog-edit-toggle-disable');
            const deleteBtn = document.getElementById('catalog-edit-delete');

            // Populate categories
            const cats = this.lastCategories || [];
            const catOptions = cats.map(c => `<option value="${c.id}" ${c.id == item.category_id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');

            // Populate panel content
            content.innerHTML = `
                <div class="form-group mb-3">
                    <label class="form-label">
                        Product Name <span class="required-mark">*</span>
                    </label>
                    <input type="text" id="catalog-edit-name"
                           class="form-control" placeholder="Product name" value="${this.escapeHtml(item.name || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">
                        Category <span class="required-mark">*</span>
                    </label>
                    <select id="catalog-edit-category" class="form-select">${catOptions}</select>
                </div>
                <div class="form-group mt-3">
                    <label class="form-label fw-semibold">Linked Products (${Number(item.product_count || 0)})</label>
                    <div id="catalog-linked-products" class="border rounded p-2 bg-light" style="max-height: 200px; overflow-y: auto;">
                        <span class="text-muted small">Loading linked products...</span>
                    </div>
                </div>
            `;

            const nameInput = document.getElementById('catalog-edit-name');
            nameInput.classList.remove('is-invalid');

            // Set Disable button
            if (disableBtn) {
                const isDisabled = !!item.is_disabled;
                disableBtn.textContent = isDisabled ? 'Enable' : 'Disable';
                disableBtn.className = `btn btn-sm ${isDisabled ? 'btn-ac-green' : 'btn-ac-red'} me-auto`;
            }

            // Show delete button only for super_admin
            if (deleteBtn) {
                deleteBtn.style.display = this.currentUserRole === 'super_admin' ? 'inline-block' : 'none';
            }

            panel.classList.add('active');
            panel.removeAttribute('inert');
            this.syncPanelAccessibility();
            nameInput.focus();

            // Load linked products
            this.loadCatalogLinkedProducts(item.name);

            const done = (result) => {
                panel.classList.remove('active');
                panel.setAttribute('inert', '');
                this.syncPanelAccessibility();
                saveBtn.replaceWith(saveBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                closeBtn.replaceWith(closeBtn.cloneNode(true));
                if (disableBtn) disableBtn.replaceWith(disableBtn.cloneNode(true));
                if (deleteBtn) deleteBtn.replaceWith(deleteBtn.cloneNode(true));
                resolve(result);
            };

            document.getElementById('catalog-edit-save').addEventListener('click', async () => {
                const n = document.getElementById('catalog-edit-name').value.trim();
                if (!n) { document.getElementById('catalog-edit-name').classList.add('is-invalid'); return; }
                const cid = Number(document.getElementById('catalog-edit-category').value || 0);
                if (!cid) return;
                if (!await this.adminConfirm('Are you sure you want to save these changes?', { title: 'Save Product Name', danger: false })) return;
                
                // Show loading state
                const saveBtn = document.getElementById('catalog-edit-save');
                const spinner = document.getElementById('catalog-edit-save-spinner');
                if (saveBtn) saveBtn.disabled = true;
                if (spinner) spinner.classList.remove('d-none');
                
                done({ action: 'save', name: n, category_id: cid });
                
                // Hide loading state after short delay
                setTimeout(() => {
                    if (saveBtn) saveBtn.disabled = false;
                    if (spinner) spinner.classList.add('d-none');
                }, 100);
            }, { once: true });
            document.getElementById('catalog-edit-cancel').addEventListener('click', () => done(null), { once: true });
            document.getElementById('catalog-edit-panel-close').addEventListener('click', () => done(null), { once: true });
            document.getElementById('catalog-edit-toggle-disable')?.addEventListener('click', async () => {
                if (!await this.adminConfirm(`Are you sure you want to ${item.is_disabled ? 'enable' : 'disable'} this product?`, { title: `${item.is_disabled ? 'Enable' : 'Disable'} Product`, danger: !item.is_disabled })) return;
                done({ action: 'disable' });
            }, { once: true });
            document.getElementById('catalog-edit-delete')?.addEventListener('click', async () => {
                if (!await this.adminConfirm('Are you sure you want to delete this product name? This action cannot be undone.', { title: 'Delete Product Name', danger: true })) return;
                done({ action: 'delete' });
            }, { once: true });
        });
    }

    async loadCategoryLinkedProducts(categoryId) {
        const container = document.getElementById('category-linked-products');
        if (!container) return;
        container.innerHTML = '<span class="text-muted small">Loading linked products...</span>';
        try {
            const response = await fetch(`${this.apiBase}/admin/categories/${categoryId}/products`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to load');
            const products = data.products || [];
            if (!products.length) {
                container.innerHTML = '<span class="text-muted small">No linked products.</span>';
                return;
            }
            container.innerHTML = products.map((product) => {
                const farmerLabel = product.farmer_name || product.farmer_username || product.farmer_email || 'Unknown farmer';
                const availability = product.is_admin_disabled ? 'Admin disabled' : (product.is_available ? 'Available' : 'Unavailable');
                return `
                    <div class="border rounded bg-white p-2 mb-2">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div>
                                <div class="small fw-semibold">#${product.id} ${this.escapeHtml(product.name || '')}</div>
                                <div class="small text-muted">Farmer: ${this.escapeHtml(farmerLabel)}</div>
                                ${product.farmer_email ? `<div class="small text-muted">${this.escapeHtml(product.farmer_email)}</div>` : ''}
                            </div>
                            <span class="badge bg-secondary small">${this.escapeHtml(product.status || availability)}</span>
                        </div>
                        <div class="small text-muted mt-1">
                            ₱${Number(product.price || 0).toFixed(2)}
                            · Stock: ${Number(product.stock_quantity || 0)} ${this.escapeHtml(product.unit || '')}
                            · ${availability}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load linked products:', error);
            container.innerHTML = `<span class="text-danger small">Failed to load: ${this.escapeHtml(error.message || 'Unknown error')}</span>`;
        }
    }

    async loadCatalogLinkedProducts(catalogName) {
        const container = document.getElementById('catalog-linked-products');
        if (!container) return;
        container.innerHTML = '<span class="text-muted small">Loading linked products...</span>';
        try {
            const response = await fetch(`${this.apiBase}/admin/products?search=${encodeURIComponent(catalogName)}&limit=20`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to load');
            const products = data.products || [];
            // Filter products that match the catalog name exactly
            const matchingProducts = products.filter(p => p.name === catalogName);
            if (!matchingProducts.length) {
                container.innerHTML = '<span class="text-muted small">No linked products.</span>';
                return;
            }
            container.innerHTML = matchingProducts.map((product) => {
                const farmerLabel = product.farmer_name || product.farmer_username || product.farmer_email || 'Unknown farmer';
                const availability = product.is_admin_disabled ? 'Admin disabled' : (product.is_available ? 'Available' : 'Unavailable');
                return `
                    <div class="border rounded bg-white p-2 mb-2">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div>
                                <div class="small fw-semibold">#${product.id} ${this.escapeHtml(product.name || '')}</div>
                                <div class="small text-muted">Farmer: ${this.escapeHtml(farmerLabel)}</div>
                                ${product.farmer_email ? `<div class="small text-muted">${this.escapeHtml(product.farmer_email)}</div>` : ''}
                            </div>
                            <span class="badge bg-secondary small">${this.escapeHtml(product.status || availability)}</span>
                        </div>
                        <div class="small text-muted mt-1">
                            ₱${Number(product.price || 0).toFixed(2)}
                            · Stock: ${Number(product.stock_quantity || 0)} ${this.escapeHtml(product.unit || '')}
                            · ${availability}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load linked products:', error);
            container.innerHTML = `<span class="text-danger small">Failed to load: ${this.escapeHtml(error.message || 'Unknown error')}</span>`;
        }
    }

    // Verification requests functions
    async loadVerificationRequests(page = 1, status = 'all') {
        try {
            const limit = this.pagination['verification-requests']?.limit || 50;
            const searchInput = document.getElementById('verification-requests-search-input');
            const searchQuery = searchInput ? searchInput.value.trim() : '';
            const url = new URL(`${this.apiBase}/admin/verification-requests`, window.location.origin);
            url.searchParams.set('page', page);
            url.searchParams.set('status', status);
            url.searchParams.set('limit', limit);
            if (searchQuery) {
                url.searchParams.set('search', searchQuery);
            }
            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const data = await response.json();

            if (response.ok) {
                this.verificationRequests = data.requests || [];
                this.verificationCurrentPage = page;
                this.verificationCurrentStatus = status;
                this.renderVerificationRequestsTable();
                this.renderVerificationPagination(data.total, data.limit);
                
                // Load all requests for stats (to show total counts regardless of current tab)
                await this.loadVerificationStats();
            } else {
                this.showToast('Failed to load verification requests', 'error');
            }
        } catch (error) {
            console.error('Failed to load verification requests:', error);
            this.showToast('Failed to load verification requests', 'error');
        }
    }

    async loadVerificationStats() {
        try {
            const response = await fetch(`${this.apiBase}/admin/verification-requests?status=all&page=1&limit=10000`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const data = await response.json();

            if (response.ok) {
                const allRequests = data.requests || [];
                this.updateVerificationStats(allRequests);
            }
        } catch (error) {
            console.error('Failed to load verification stats:', error);
        }
    }

    updateVerificationStats(requests) {
        const pending = requests.filter(r => r.status === 'pending').length;
        const approved = requests.filter(r => r.status === 'approved').length;
        const rejected = requests.filter(r => r.status === 'rejected').length;
        const unverified = requests.filter(r => r.status === 'unverified').length;

        document.getElementById('verification-pending-count').textContent = pending;
        document.getElementById('verification-approved-count').textContent = approved;
        document.getElementById('verification-rejected-count').textContent = rejected;
        document.getElementById('verification-unverified-count').textContent = unverified;
    }

    async loadSubscriptionStats() {
        try {
            const response = await fetch(`${this.apiBase}/admin/subscriptions`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const data = await response.json();

            if (response.ok) {
                const allSubscriptions = data.subscriptions || [];
                this.updateSubscriptionStats(allSubscriptions);
            }
        } catch (error) {
            console.error('Failed to load subscription stats:', error);
        }
    }

    updateSubscriptionStats(subscriptions) {
        const pending = subscriptions.filter(s => s.status === 'pending').length;
        const active = subscriptions.filter(s => s.status === 'active').length;
        const rejected = subscriptions.filter(s => s.status === 'rejected').length;
        const expired = subscriptions.filter(s => s.status === 'expired').length;

        document.getElementById('subscription-pending-count').textContent = pending;
        document.getElementById('subscription-active-count').textContent = active;
        document.getElementById('subscription-rejected-count').textContent = rejected;
        document.getElementById('subscription-expired-count').textContent = expired;
    }

    renderVerificationRequestsTable() {
        const tbody = document.getElementById('verification-requests-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!this.verificationRequests || this.verificationRequests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No verification requests found</td></tr>';
            return;
        }

        this.verificationRequests.forEach(request => {
            const row = document.createElement('tr');

            const statusBadge = {
                'pending': '<span class="badge bg-warning align-middle">Pending</span><i class="bi bi-hourglass text-warning ms-1 align-middle"></i>',
                'approved': '<span class="badge bg-success align-middle">Approved</span><i class="bi bi-check-circle-fill text-primary ms-1 align-middle"></i>',
                'rejected': '<span class="badge bg-danger align-middle">Rejected</span><i class="bi bi-x-circle-fill text-danger ms-1 align-middle"></i>',
                'unverified': '<span class="badge bg-secondary align-middle">Unverified</span><i class="bi bi-x-circle-fill text-danger ms-1 align-middle"></i>'
            }[request.status] || request.status;

            const docIndicator = request.document_url
                ? `<img src="${this.escapeHtml(request.document_url)}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; cursor:pointer;" class="verification-doc-thumb" data-doc-url="${this.escapeHtml(request.document_url)}" data-farmer-name="${this.escapeHtml(request.full_name || request.username)}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';" /><i class="bi bi-image-slash text-danger" style="display:none;font-size:1.2rem;"></i>`
                : '<i class="bi bi-dash text-muted"></i>';

            row.innerHTML = `
                <td>${this.escapeHtml(request.full_name || request.username)}</td>
                <td>${this.escapeHtml(request.shop_name || '—')}</td>
                <td>${docIndicator}</td>
                <td>${new Date(request.created_at).toLocaleDateString()}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-ac-green view-verification-details-btn" data-request-id="${request.id}" data-farmer-id="${request.farmer_id}">View</button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    renderVerificationPagination(total, limit) {
        const nav = document.getElementById('verification-pagination');
        if (!nav) return;
        const totalPages = Math.ceil(total / limit);

        if (totalPages <= 1) {
            nav.innerHTML = '';
            return;
        }

        let html = '<ul class="pagination">';

        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === this.verificationCurrentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadVerificationRequests(${i}, '${this.verificationCurrentStatus}'); return false;">${i}</a>
            </li>`;
        }

        html += '</ul>';
        nav.innerHTML = html;
    }

    async openReviewModal(requestId, action) {
        this.currentReviewRequestId = requestId;
        let request = this.verificationRequests.find(r => r.id === requestId);

        // If not in local cache, fetch from API
        if (!request) {
            try {
                const response = await fetch(`${this.apiBase}/admin/verification-requests`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                const data = await response.json();
                if (response.ok && data.requests) {
                    request = data.requests.find(r => r.id === parseInt(requestId));
                }
            } catch (error) {
                console.error('Failed to fetch request for review:', error);
            }
        }

        if (!request) {
            console.error('Request not found for review:', requestId);
            this.showToast('Request not found. Please refresh the page.', 'error');
            return;
        }

        document.getElementById('review-modal-title').textContent =
            action === 'approve' ? 'Approve Verification Request' : 'Reject Verification Request';

        document.getElementById('review-farmer-details').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Farmer:</strong> ${this.escapeHtml(request.full_name || request.username)}</p>
                    <p><strong>Email:</strong> ${this.escapeHtml(request.email)}</p>
                    <p><strong>Phone:</strong> ${request.phone ? '+63' + request.phone : '—'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Shop:</strong> ${this.escapeHtml(request.shop_name || '—')}</p>
                    <p><strong>Products:</strong> ${request.product_count || 0}</p>
                    <p><strong>Delivered Orders:</strong> ${request.delivered_orders || 0}</p>
                </div>
            </div>
            ${request.notes ? `<p><strong>Notes:</strong> ${this.escapeHtml(request.notes)}</p>` : ''}
        `;

        const docSection = document.getElementById('review-document-section');
        const docImg = document.getElementById('review-document-img');

        if (request.document_url) {
            docSection.style.display = 'block';
            docImg.src = request.document_url;
        } else {
            docSection.style.display = 'none';
        }

        const rejectionSection = document.getElementById('rejection-reason-section');
        const approveBtn = document.getElementById('approve-btn');
        const rejectBtn = document.getElementById('reject-btn');

        if (action === 'reject') {
            rejectionSection.style.display = 'block';
            approveBtn.style.display = 'none';
            rejectBtn.style.display = 'inline-block';
        } else {
            rejectionSection.style.display = 'none';
            approveBtn.style.display = 'inline-block';
            rejectBtn.style.display = 'none';
        }

        // Ensure event listeners are attached to approve/reject buttons
        approveBtn.removeEventListener('click', this.boundHandleApprove);
        rejectBtn.removeEventListener('click', this.boundHandleReject);
        this.boundHandleApprove = (e) => {
            console.log('[DEBUG] Approve button in review modal clicked', e);
            e.preventDefault();
            e.stopPropagation();
            this.handleReviewAction('approved');
        };
        this.boundHandleReject = (e) => {
            console.log('[DEBUG] Reject button in review modal clicked', e);
            e.preventDefault();
            e.stopPropagation();
            this.handleReviewAction('rejected');
        };
        approveBtn.addEventListener('click', this.boundHandleApprove);
        rejectBtn.addEventListener('click', this.boundHandleReject);

        const reviewModal = document.getElementById('admin-review-modal');
        this.modalZIndex++;
        reviewModal.style.zIndex = this.modalZIndex;
        reviewModal.classList.add('open');
    }

    closeReviewModal() {
        document.getElementById('admin-review-modal').classList.remove('open');
        this.currentReviewRequestId = null;
        document.getElementById('rejection-reason-input').value = '';
    }

    openVerificationDocModal(docUrl, farmerName) {
        const modal = document.getElementById('verification-doc-modal');
        const title = document.getElementById('verification-doc-modal-title');
        const img = document.getElementById('verification-doc-img');

        title.textContent = `Verification Document - ${farmerName}`;
        img.src = docUrl;
        this.modalZIndex++;
        modal.style.zIndex = this.modalZIndex;
        modal.classList.add('open');
    }

    closeVerificationDocModal() {
        document.getElementById('verification-doc-modal').classList.remove('open');
    }

    async openVerificationDetailsModal(requestId, farmerId) {
        const modal = document.getElementById('verification-details-modal');
        const title = document.getElementById('verification-details-modal-title');
        const content = document.getElementById('verification-details-content');
        const unverifyBtn = document.getElementById('unverify-from-details-btn');
        const approveBtn = document.getElementById('approve-from-details-btn');
        const rejectBtn = document.getElementById('reject-from-details-btn');

        title.textContent = 'Verification Details';
        content.innerHTML = '<div class="text-center py-5"><span class="spinner-border"></span></div>';
        this.modalZIndex++;
        modal.style.zIndex = this.modalZIndex;
        modal.classList.add('open');
        unverifyBtn.style.display = 'none';
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'none';

        try {
            // Fetch verification request details
            const response = await fetch(`${this.apiBase}/admin/verification-requests`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json();

            if (response.ok) {
                const request = data.requests.find(r => r.id === parseInt(requestId));
                if (request) {
                    // Show unverify button if status is approved
                    if (request.status === 'approved') {
                        unverifyBtn.style.display = 'inline-block';
                        unverifyBtn.dataset.requestId = request.id;
                    }
                    // Show approve/reject buttons if status is pending
                    if (request.status === 'pending') {
                        approveBtn.style.display = 'inline-block';
                        approveBtn.dataset.requestId = request.id;
                        rejectBtn.style.display = 'inline-block';
                        rejectBtn.dataset.requestId = request.id;
                    }

                    content.innerHTML = `
                        <div class="row">
                            <div class="col-md-6">
                                <h5>Farmer Information</h5>
                                <table class="table table-sm">
                                    <tr><td><strong>Name:</strong></td><td>${this.escapeHtml(request.full_name || request.username)}</td></tr>
                                    <tr><td><strong>Email:</strong></td><td>${this.escapeHtml(request.email)}</td></tr>
                                    <tr><td><strong>Phone:</strong></td><td>${this.escapeHtml(request.phone || '—')}</td></tr>
                                    <tr><td><strong>Shop Name:</strong></td><td>${this.escapeHtml(request.shop_name || '—')}</td></tr>
                                    <tr><td><strong>Address:</strong></td><td>${this.escapeHtml(request.address || '—')}</td></tr>
                                    <tr><td><strong>Products:</strong></td><td>${request.product_count || 0}</td></tr>
                                    <tr><td><strong>Delivered Orders:</strong></td><td>${request.delivered_orders || 0}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h5>Verification Information</h5>
                                <table class="table table-sm">
                                    <tr><td><strong>Status:</strong></td><td>${request.status}</td></tr>
                                    <tr><td><strong>Submitted:</strong></td><td>${new Date(request.created_at).toLocaleString()}</td></tr>
                                    <tr><td><strong>Reviewed:</strong></td><td>${request.reviewed_at ? new Date(request.reviewed_at).toLocaleString() : '—'}</td></tr>
                                    <tr><td><strong>Notes:</strong></td><td>${this.escapeHtml(request.notes || '—')}</td></tr>
                                    <tr><td><strong>Rejection Reason:</strong></td><td>${this.escapeHtml(request.rejection_reason || '—')}</td></tr>
                                </table>
                                ${request.document_url ? `
                                    <h5 class="mt-3">Document</h5>
                                    <div>
                                        <img src="${this.escapeHtml(request.document_url)}" style="max-width:100%; max-height:300px; border-radius:8px; cursor:pointer; position:relative; z-index:9999;" onclick="adminDashboard.openVerificationDocModal('${this.escapeHtml(request.document_url)}', '${this.escapeHtml(request.full_name || request.username)}')" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                                        <div style="display:none;padding:20px;text-align:center;background:#f8f9fa;border-radius:8px;">
                                            <i class="bi bi-image-slash text-danger" style="font-size:2rem;"></i>
                                            <p class="text-muted mt-2 mb-0">Document image not available (may have been deleted)</p>
                                        </div>
                                    </div>
                                ` : '<p class="text-muted mt-3">No document uploaded</p>'}
                            </div>
                        </div>
                    `;
                } else {
                    content.innerHTML = '<p class="text-danger">Verification request not found</p>';
                }
            } else {
                content.innerHTML = '<p class="text-danger">Failed to load verification details</p>';
            }
        } catch (error) {
            console.error('Failed to load verification details:', error);
            content.innerHTML = '<p class="text-danger">Failed to load verification details</p>';
        }
    }

    closeVerificationDetailsModal() {
        document.getElementById('verification-details-modal').classList.remove('open');
    }

    openUnverifyModal(requestId) {
        this.currentUnverifyRequestId = requestId;
        const modal = document.getElementById('unverify-modal');
        this.modalZIndex++;
        modal.style.zIndex = this.modalZIndex;
        modal.classList.add('open');
    }

    closeUnverifyModal() {
        document.getElementById('unverify-modal').classList.remove('open');
        this.currentUnverifyRequestId = null;
    }

    async handleUnverifyAction() {
        const reason = document.getElementById('unverify-reason').value.trim();

        if (!reason) {
            this.showToast('Reason is required', 'error');
            return;
        }

        // Handle farmer details modal unverify
        if (this.currentUnverifyFarmerId) {
            try {
                const response = await fetch(`${this.apiBase}/admin/users/${this.currentUnverifyFarmerId}/verify`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ is_verified: false, reason })
                });

                if (response.ok) {
                    this.showToast('Farmer unverified successfully', 'success');
                    this.closeUnverifyModal();
                    // Update UI
                    const unverifyBtn = document.getElementById('fdt-unverify-btn');
                    const verifyBtn = document.getElementById('fdt-verify-btn');
                    const infoEl = document.getElementById('fdt-info-content');
                    if (unverifyBtn) unverifyBtn.classList.add('d-none');
                    if (verifyBtn) verifyBtn.classList.remove('d-none');
                    if (infoEl) infoEl.innerHTML = infoEl.innerHTML.replace(/<span style="color:#41bf5b;background:transparent;border:none;padding:0;font-size:\.85rem;font-weight:500;">Yes<\/span>/, '<span style="color:#dc2626;background:transparent;border:none;padding:0;font-size:.85rem;font-weight:500;">No</span>');
                    this.loadFarmers();
                    this.currentUnverifyFarmerId = null;
                } else {
                    const data = await response.json().catch(() => ({}));
                    this.showToast(data.message || 'Failed to unverify farmer', 'error');
                }
            } catch (error) {
                console.error('Failed to unverify farmer:', error);
                this.showToast('Failed to unverify farmer', 'error');
            }
            return;
        }

        // Handle verification request unverify (original logic)
        if (!this.currentUnverifyRequestId) return;

        try {
            const response = await fetch(`${this.apiBase}/admin/verification-requests/${this.currentUnverifyRequestId}/review`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'unverified',
                    rejection_reason: reason
                })
            });

            if (response.ok) {
                this.showToast('Verification request unverifed successfully', 'success');
                this.closeUnverifyModal();
                this.closeVerificationDetailsModal();
                this.loadVerificationRequests(this.verificationCurrentPage, this.verificationCurrentStatus);
            } else {
                const data = await response.json().catch(() => ({}));
                this.showToast(data.message || 'Failed to unverify request', 'error');
            }
        } catch (error) {
            console.error('Failed to unverify request:', error);
            this.showToast('Failed to unverify request', 'error');
        }
    }

    async handleReviewAction(action) {
        console.log('[DEBUG] handleReviewAction called with action:', action);
        console.log('[DEBUG] currentReviewRequestId:', this.currentReviewRequestId);

        if (!this.currentReviewRequestId) return;

        const rejectionReason = document.getElementById('rejection-reason-input').value;
        console.log('[DEBUG] rejectionReason:', rejectionReason);

        if (action === 'rejected' && !rejectionReason.trim()) {
            this.showToast('Rejection reason is required', 'error');
            return;
        }

        const payload = {
            status: action,
            rejection_reason: action === 'rejected' ? rejectionReason : null
        };
        console.log('[DEBUG] Sending payload:', payload);

        try {
            const response = await fetch(`${this.apiBase}/admin/verification-requests/${this.currentReviewRequestId}/review`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('[DEBUG] Response status:', response.status);
            console.log('[DEBUG] Response data:', data);

            if (response.ok) {
                this.closeReviewModal();
                this.showToast(`Verification request ${action}ed successfully`, 'success');
                this.loadVerificationRequests(this.verificationCurrentPage, this.verificationCurrentStatus);
            } else {
                this.showToast(data.message || `Failed to ${action} request`, 'error');
            }
        } catch (error) {
            console.error('Review action error:', error);
            this.showToast(`Failed to ${action} request`, 'error');
        }
    }

    // ── Subscription Request Methods ─────────────────────────────────────
    async loadSubscriptionRequests(status = 'pending') {
        try {
            // For 'all' status, don't send status parameter to get all subscriptions
            const url = status === 'all'
                ? `${this.apiBase}/admin/subscriptions`
                : `${this.apiBase}/admin/subscriptions?status=${status}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            
            this.subscriptionCurrentStatus = status;
            
            // Load all subscriptions for stats (to show total counts regardless of current tab)
            await this.loadSubscriptionStats();
            
            const tbody = document.querySelector('#subscriptions-table tbody');
            if (!tbody) return;
            
            // Show no data message if no subscriptions
            if (!data.subscriptions || data.subscriptions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-5">
                            <i class="bi bi-inbox text-muted" style="font-size: 2rem;"></i>
                            <p class="text-muted mt-3 mb-0">No ${status === 'all' ? '' : status} subscriptions found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = data.subscriptions.map(s => {
                const status = s.status || 'unknown';
                const statusClass = status === 'active' ? 'success' : status === 'pending' ? 'warning' : status === 'rejected' ? 'danger' : 'secondary';
                
                return `
                <tr>
                    <td>${this.escapeHtml(s.full_name || s.shop_name || '—')}</td>
                    <td>${s.plan_duration_months} month${s.plan_duration_months > 1 ? 's' : ''}</td>
                    <td>₱${Number(s.amount_paid || 0).toLocaleString()}</td>
                    <td>${s.payment_account_name ? `<span class="badge bg-${s.payment_account_type === 'gcash' ? 'success' : 'info'}">${s.payment_account_type === 'gcash' ? 'GCash' : 'Bank'}</span> ${this.escapeHtml(s.payment_account_name)}` : '—'}</td>
                    <td>${new Date(s.created_at).toLocaleDateString('en-PH')}</td>
                    <td><span class="badge bg-${statusClass}">${status}</span></td>
                    <td>${s.payment_proof_url ? `<button class="btn btn-sm btn-outline-success view-proof-btn" data-url="${s.payment_proof_url}"><i class="bi bi-image"></i> View</button>` : '—'}</td>
                    <td>
                        <button class="btn btn-sm py-0 px-2 btn-ac-green subscription-view-btn" data-id="${s.id}">View</button>
                    </td>
                </tr>
            `}).join('');
            // Wire buttons
            tbody.querySelectorAll('.view-proof-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('sub-proof-img').src = btn.dataset.url;
                    new bootstrap.Modal(document.getElementById('subscription-proof-modal')).show();
                });
            });
            tbody.querySelectorAll('.subscription-view-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    this.showSubscriptionDetails(id);
                });
            });
        } catch (e) { console.error('Load subscriptions error:', e); }
    }

    async showSubscriptionDetails(id) {
        try {
            const res = await fetch(`${this.apiBase}/admin/subscriptions`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();
            const subscription = data.subscriptions.find(s => s.id === id);
            
            if (!subscription) {
                this.showToast('Subscription not found', 'error');
                return;
            }

            // Populate modal fields
            document.getElementById('sub-detail-farmer-name').textContent = subscription.full_name || '—';
            document.getElementById('sub-detail-email').textContent = subscription.email || '—';
            document.getElementById('sub-detail-shop-name').textContent = subscription.shop_name || '—';
            document.getElementById('sub-detail-plan').textContent = subscription.tier || '—';
            document.getElementById('sub-detail-amount').textContent = `₱${Number(subscription.amount_paid || 0).toLocaleString()}`;
            document.getElementById('sub-detail-duration').textContent = `${subscription.plan_duration_months} month${subscription.plan_duration_months > 1 ? 's' : ''}`;
            document.getElementById('sub-detail-payment-to').textContent = subscription.payment_account_name || '—';
            document.getElementById('sub-detail-account-number').textContent = subscription.payment_account_number || '—';
            
            // Status badge
            const statusElement = document.getElementById('sub-detail-status');
            const statusClass = subscription.status === 'active' ? 'success' :
                               subscription.status === 'pending' ? 'warning' :
                               subscription.status === 'rejected' ? 'danger' : 'secondary';
            statusElement.innerHTML = `<span class="badge bg-${statusClass}">${subscription.status}</span>`;

            // Reason field for rejected/expired subscriptions
            const reasonContainer = document.getElementById('sub-detail-reason-container');
            const reasonElement = document.getElementById('sub-detail-reason');
            if (subscription.status === 'rejected' && subscription.rejection_reason) {
                reasonContainer.style.display = 'block';
                reasonElement.textContent = subscription.rejection_reason;
            } else if (subscription.status === 'expired' && subscription.expiry_reason) {
                reasonContainer.style.display = 'block';
                reasonElement.textContent = subscription.expiry_reason;
            } else {
                reasonContainer.style.display = 'none';
            }

            // Dates
            document.getElementById('sub-detail-created-at').textContent = new Date(subscription.created_at).toLocaleDateString('en-PH');
            
            // Show start/expiry dates for active subscriptions
            if (subscription.status === 'active') {
                document.getElementById('sub-detail-starts-at-container').style.display = 'block';
                document.getElementById('sub-detail-expires-at-container').style.display = 'block';
                document.getElementById('sub-detail-starts-at').textContent = subscription.starts_at ? new Date(subscription.starts_at).toLocaleDateString('en-PH') : '—';
                document.getElementById('sub-detail-expires-at').textContent = subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString('en-PH') : '—';
                // Show expire button for active subscriptions
                document.getElementById('sub-detail-expire-btn').style.display = 'block';
                document.getElementById('sub-detail-expire-btn').dataset.id = subscription.id;
                // Hide approve/reject buttons for active subscriptions
                document.getElementById('sub-detail-approve-btn').style.display = 'none';
                document.getElementById('sub-detail-reject-btn').style.display = 'none';
            } else if (subscription.status === 'pending') {
                document.getElementById('sub-detail-starts-at-container').style.display = 'none';
                document.getElementById('sub-detail-expires-at-container').style.display = 'none';
                // Show approve/reject buttons for pending subscriptions
                document.getElementById('sub-detail-approve-btn').style.display = 'block';
                document.getElementById('sub-detail-approve-btn').dataset.id = subscription.id;
                document.getElementById('sub-detail-reject-btn').style.display = 'block';
                document.getElementById('sub-detail-reject-btn').dataset.id = subscription.id;
                // Hide expire button for pending subscriptions
                document.getElementById('sub-detail-expire-btn').style.display = 'none';
            } else {
                document.getElementById('sub-detail-starts-at-container').style.display = 'none';
                document.getElementById('sub-detail-expires-at-container').style.display = 'none';
                // Hide all action buttons for non-active, non-pending subscriptions
                document.getElementById('sub-detail-approve-btn').style.display = 'none';
                document.getElementById('sub-detail-reject-btn').style.display = 'none';
                document.getElementById('sub-detail-expire-btn').style.display = 'none';
            }
            
            // Payment proof
            const proofImg = document.getElementById('sub-detail-proof-img');
            if (subscription.payment_proof_url) {
                document.getElementById('sub-detail-proof-container').style.display = 'block';
                proofImg.src = subscription.payment_proof_url;
            } else {
                document.getElementById('sub-detail-proof-container').style.display = 'none';
            }

            // Show modal
            new bootstrap.Modal(document.getElementById('subscription-details-modal')).show();
        } catch (e) {
            console.error('Error loading subscription details:', e);
            this.showToast('Error loading subscription details', 'error');
        }
    }

    async handleSubscriptionAction(id, action, data = {}) {
        const method = action === 'delete' ? 'DELETE' : 'PUT';
        const body = action === 'toggle' ? JSON.stringify(data) : undefined;
        try {
            const res = await fetch(`${this.apiBase}/admin/payment-accounts/${id}`, {
                method, headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                body
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                this.showToast(json.message || 'Updated', 'success');
                this.loadPaymentAccounts();
            } else { this.showToast(json.message || 'Failed', 'error'); }
        } catch (e) { this.showToast('Error', 'error'); }
    }

    async loadPaymentAccounts() {
        try {
            const res = await fetch(`${this.apiBase}/admin/payment-accounts`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const list = document.getElementById('payment-accounts-list');
            if (!list) return;
            list.innerHTML = data.accounts.map(acc => `
                <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
                    <div>
                        <strong>${this.escapeHtml(acc.name)}</strong><br>
                        <small class="text-muted">${acc.type === 'gcash' ? 'GCash' : 'Bank'} — ${acc.account_number}</small>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-secondary toggle-pay-btn" data-id="${acc.id}" data-active="${acc.is_active}">${acc.is_active ? 'Deactivate' : 'Activate'}</button>
                        <button class="btn btn-sm btn-outline-danger delete-pay-btn" data-id="${acc.id}"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            `).join('');
            list.querySelectorAll('.toggle-pay-btn').forEach(btn => {
                btn.addEventListener('click', () => this.handleSubscriptionAction(btn.dataset.id, 'toggle', { is_active: btn.dataset.active !== 'true' }));
            });
            list.querySelectorAll('.delete-pay-btn').forEach(btn => {
                btn.addEventListener('click', () => { if (confirm('Delete this payment account?')) this.handleSubscriptionAction(btn.dataset.id, 'delete'); });
            });
        } catch (e) { console.error('Load payment accounts error:', e); }
    }

    async addPaymentAccount() {
        const name = document.getElementById('new-pay-name')?.value?.trim();
        const number = document.getElementById('new-pay-number')?.value?.trim();
        const type = document.getElementById('new-pay-type')?.value;
        const order = document.getElementById('new-pay-order')?.value || '0';
        if (!name || !number) { this.showToast('Name and number are required', 'error'); return; }
        try {
            const res = await fetch(`${this.apiBase}/admin/payment-accounts`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, account_number: number, type, sort_order: Number(order) })
            });
            const data = await res.json();
            if (res.ok) {
                this.showToast('Payment account added', 'success');
                this.loadPaymentAccounts();
                document.getElementById('new-pay-name').value = '';
                document.getElementById('new-pay-number').value = '';
            } else { this.showToast(data.message || 'Failed to add', 'error'); }
        } catch (e) { this.showToast('Error adding payment account', 'error'); }
    }

    async loadSubscriptionSettings() {
        try {
            const res = await fetch(`${this.apiBase}/subscriptions/settings`);
            if (!res.ok) return;
            const data = await res.json();
            const monthlyEl = document.getElementById('setting-premium-monthly-price');
            const d3El = document.getElementById('setting-discount-3m');
            const d6El = document.getElementById('setting-discount-6m');
            if (monthlyEl) monthlyEl.value = data.monthly_price;
            if (d3El) d3El.value = data.durations[3]?.discount_pct || 10;
            if (d6El) d6El.value = data.durations[6]?.discount_pct || 20;
        } catch (e) { console.error('Load subscription settings error:', e); }
    }

    async saveSubscriptionSettings() {
        const updates = {
            premium_monthly_price: document.getElementById('setting-premium-monthly-price')?.value,
            premium_3month_discount_pct: document.getElementById('setting-discount-3m')?.value,
            premium_6month_discount_pct: document.getElementById('setting-discount-6m')?.value
        };
        try {
            const res = await fetch(`${this.apiBase}/superadmin/settings`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (res.ok) { this.showToast('Pricing saved', 'success'); }
            else { this.showToast(data.message || 'Failed to save', 'error'); }
        } catch (e) { this.showToast('Error saving pricing', 'error'); }
    }

}

// Global function to open payment proof modal
window.openPaymentProofModal = function() {
    const proofImg = document.getElementById('sub-detail-proof-img');
    const modalImg = document.getElementById('payment-proof-modal-img');
    if (proofImg && modalImg && proofImg.src) {
        modalImg.src = proofImg.src;
        new bootstrap.Modal(document.getElementById('payment-proof-modal')).show();
    }
};

// Initialize admin dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();

    // Verification request search (event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.matches('#verification-requests-search-btn') || e.target.closest('#verification-requests-search-btn')) {
            adminDashboard.loadVerificationRequests(1, adminDashboard.verificationCurrentStatus || 'all');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('#verification-requests-search-input') && e.key === 'Enter') {
            adminDashboard.loadVerificationRequests(1, adminDashboard.verificationCurrentStatus || 'all');
        }
    });

    // Verification request refresh (event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.matches('#verification-requests-refresh-btn') || e.target.closest('#verification-requests-refresh-btn')) {
            const searchInput = document.getElementById('verification-requests-search-input');
            if (searchInput) searchInput.value = '';
            adminDashboard.loadVerificationRequests(1, 'all');
            adminDashboard.showToast('Verification requests refreshed', 'success');
        }
    });

    // Subscription request tabs (event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.matches('.subscription-tabs .tab-btn')) {
            document.querySelectorAll('.subscription-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            adminDashboard.loadSubscriptionRequests(e.target.dataset.status);
        }
    });

    // Approve subscription button (event delegation)
    document.addEventListener('click', async (e) => {
        if (e.target.matches('#sub-detail-approve-btn') || e.target.closest('#sub-detail-approve-btn')) {
            const btn = e.target.matches('#sub-detail-approve-btn') ? e.target : e.target.closest('#sub-detail-approve-btn');
            const id = btn.dataset.id;
            if (!id) return;
            const confirmed = await adminDashboard.adminConfirm(
                'Are you sure you want to approve this subscription?',
                { title: 'Approve Subscription', okLabel: 'Approve', danger: false }
            );
            if (!confirmed) return;
            try {
                const res = await fetch(`${adminDashboard.apiBase}/admin/subscriptions/${id}/approve`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${adminDashboard.token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    adminDashboard.showToast('Subscription approved successfully', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('subscription-details-modal'));
                    if (modal) modal.hide();
                    adminDashboard.loadSubscriptionRequests('all');
                } else {
                    adminDashboard.showToast(data.message || 'Failed to approve subscription', 'error');
                }
            } catch (err) {
                console.error('Error approving subscription:', err);
                adminDashboard.showToast('Error approving subscription', 'error');
            }
        }
    });

    // Reject subscription button (event delegation)
    document.addEventListener('click', async (e) => {
        if (e.target.matches('#sub-detail-reject-btn') || e.target.closest('#sub-detail-reject-btn')) {
            const btn = e.target.matches('#sub-detail-reject-btn') ? e.target : e.target.closest('#sub-detail-reject-btn');
            const id = btn.dataset.id;
            if (!id) return;
            // Store the subscription ID for the confirm button
            document.getElementById('confirm-reject-subscription-btn').dataset.id = id;
            // Clear previous reason
            document.getElementById('reject-subscription-reason').value = '';
            document.getElementById('reject-subscription-reason-count').textContent = '0';
            // Open the reason modal
            new bootstrap.Modal(document.getElementById('reject-subscription-modal')).show();
        }
    });

    // Confirm reject subscription button
    document.getElementById('confirm-reject-subscription-btn').addEventListener('click', async () => {
        const id = document.getElementById('confirm-reject-subscription-btn').dataset.id;
        const reason = document.getElementById('reject-subscription-reason').value.trim();

        if (!reason) {
            adminDashboard.showToast('Please provide a reason for rejection', 'error');
            return;
        }

        try {
            const res = await fetch(`${adminDashboard.apiBase}/admin/subscriptions/${id}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminDashboard.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            if (res.ok) {
                adminDashboard.showToast('Subscription rejected successfully', 'success');
                // Close both modals
                bootstrap.Modal.getInstance(document.getElementById('reject-subscription-modal')).hide();
                const detailsModal = bootstrap.Modal.getInstance(document.getElementById('subscription-details-modal'));
                if (detailsModal) detailsModal.hide();
                adminDashboard.loadSubscriptionRequests('all');
            } else {
                adminDashboard.showToast(data.message || 'Failed to reject subscription', 'error');
            }
        } catch (err) {
            console.error('Error rejecting subscription:', err);
            adminDashboard.showToast('Error rejecting subscription', 'error');
        }
    });

    // Expire subscription button (event delegation)
    document.addEventListener('click', async (e) => {
        if (e.target.matches('#sub-detail-expire-btn') || e.target.closest('#sub-detail-expire-btn')) {
            const btn = e.target.matches('#sub-detail-expire-btn') ? e.target : e.target.closest('#sub-detail-expire-btn');
            const id = btn.dataset.id;
            if (!id) return;
            // Store the subscription ID for the confirm button
            document.getElementById('confirm-expire-subscription-btn').dataset.id = id;
            // Clear previous reason
            document.getElementById('expire-subscription-reason').value = '';
            document.getElementById('expire-subscription-reason-count').textContent = '0';
            // Open the reason modal
            new bootstrap.Modal(document.getElementById('expire-subscription-modal')).show();
        }
    });

    // Character counter for reject subscription reason
    document.getElementById('reject-subscription-reason').addEventListener('input', (e) => {
        const count = e.target.value.length;
        document.getElementById('reject-subscription-reason-count').textContent = count;
        document.getElementById('reject-subscription-reason-count').style.color = count > 450 ? 'red' : '';
    });

    // Character counter for expire subscription reason
    document.getElementById('expire-subscription-reason').addEventListener('input', (e) => {
        const count = e.target.value.length;
        document.getElementById('expire-subscription-reason-count').textContent = count;
        document.getElementById('expire-subscription-reason-count').style.color = count > 450 ? 'red' : '';
    });

    // Confirm expire subscription button
    document.getElementById('confirm-expire-subscription-btn').addEventListener('click', async () => {
        const id = document.getElementById('confirm-expire-subscription-btn').dataset.id;
        const reason = document.getElementById('expire-subscription-reason').value.trim();

        if (!reason) {
            adminDashboard.showToast('Please provide a reason for expiry', 'error');
            return;
        }

        try {
            const res = await fetch(`${adminDashboard.apiBase}/admin/subscriptions/${id}/expire`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminDashboard.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            if (res.ok) {
                adminDashboard.showToast('Subscription expired successfully', 'success');
                // Close both modals
                bootstrap.Modal.getInstance(document.getElementById('expire-subscription-modal')).hide();
                const detailsModal = bootstrap.Modal.getInstance(document.getElementById('subscription-details-modal'));
                if (detailsModal) detailsModal.hide();
                adminDashboard.loadSubscriptionRequests('all');
            } else {
                adminDashboard.showToast(data.message || 'Failed to expire subscription', 'error');
            }
        } catch (err) {
            console.error('Error expiring subscription:', err);
            adminDashboard.showToast('Error expiring subscription', 'error');
        }
    });

    // Payment accounts buttons
    document.addEventListener('click', (e) => {
        if (e.target.matches('#btn-add-payment-account') || e.target.closest('#btn-add-payment-account')) {
            adminDashboard.addPaymentAccount();
        }
    });

    // Save pricing settings
    document.addEventListener('click', (e) => {
        if (e.target.matches('#btn-save-subscription-settings') || e.target.closest('#btn-save-subscription-settings')) {
            adminDashboard.saveSubscriptionSettings();
        }
    });
});

// Global functions for onclick handlers (kept for backward compatibility)
async function openReviewModal(requestId, action) {
    if (adminDashboard) {
        await adminDashboard.openReviewModal(requestId, action);
    }
}

function closeReviewModal() {
    if (adminDashboard) {
        adminDashboard.closeReviewModal();
    }
}

function closeVerificationDocModal() {
    if (adminDashboard) {
        adminDashboard.closeVerificationDocModal();
    }
}

function closeVerificationDetailsModal() {
    if (adminDashboard) {
        adminDashboard.closeVerificationDetailsModal();
    }
}

function loadVerificationRequests(page, status) {
    if (adminDashboard) {
        adminDashboard.loadVerificationRequests(page, status);
    }
}

