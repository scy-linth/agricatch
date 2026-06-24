// Ensure placeholder image is defined on pages that don't load app.js
window.__PLACEHOLDER_IMAGE__ = window.__PLACEHOLDER_IMAGE__ || '/images/resendlogo.png';

class OrdersPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.apiFallbackBase = 'https://agricatch.onrender.com/api';
        if (typeof window !== 'undefined') {
            const host = String(window.location.hostname || '').toLowerCase();
            if (host === 'agricatch.store' || host === 'www.agricatch.store') {
                this.apiBase = this.apiFallbackBase;
            }
        }
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        this.userId = this.getUserId();
        this.currentStatus = 'pending';
        const params = new URLSearchParams(window.location.search);
        this.highlightOrderId = Number(params.get('highlightOrderId') || 0);
        this.returnTo = '#home';
        this.returnPath = '/';
        this.resumeScrollY = Number(
            params.get('resumeScrollY') ||
            sessionStorage.getItem('ordersReturnScrollY') ||
            NaN
        );
        this.ordersByStatus = { pending: [], preorder_reserved: [], confirmed: [], preparing: [], scheduled: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.currentTab = 'all';
        this.ratingDraft = {
            productId: null,
            reviewId: null,
            rating: 0,
            productName: ''
        };
        this.cancelDraftOrderId = null;
        this.searchQuery = '';
        this.dateFrom = '';
        this.dateTo = '';
        this.init();
    }

    normalizeAuthToken(token) {
        if (!token) return null;
        try {
            return token.replace(/^["']|["']$/g, '').trim();
        } catch (e) {
            return token;
        }
    }

    getApiBases() {
        const bases = [this.apiBase];
        if (this.apiFallbackBase && this.apiFallbackBase !== this.apiBase) {
            bases.push(this.apiFallbackBase);
        }
        return bases;
    }

    async fetchWithApiFallback(path, options = {}) {
        let lastResponse = null;
        let lastError = null;

        for (const base of this.getApiBases()) {
            try {
                const response = await fetch(`${base}${path}`, options);
                lastResponse = response;

                // Retry on alternate base when a proxy is missing routes.
                if (response.status === 404) continue;

                if (base !== this.apiBase) {
                    this.apiBase = base;
                }
                return response;
            } catch (error) {
                lastError = error;
            }
        }

        if (lastResponse) return lastResponse;
        if (lastError) throw lastError;
        throw new Error('API request failed');
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    init() {
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }
        localStorage.setItem('ordersReturnTo', this.returnTo);
        this.setupEventListeners();
        this.configureBackButton();
        this.loadOrders();
        this.setupRealtime();
    }

    showGuestLoginPrompt() {
        // Show toast message
        this.showToast('Please log in to view your orders', 'info');
        
        // Store return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        
        // Redirect to home with login prompt
        setTimeout(() => {
            window.location.href = `/?login=1&returnUrl=${returnUrl}`;
        }, 1500);
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 12px 20px;
            border-radius: 8px;
            background: ${type === 'info' ? '#0ea5e9' : '#ef4444'};
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        // Add animation keyframes if not exists
        if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    normalizeReturnTo(value) {
        const fallback = '#products';
        const allowed = new Set(['#home', '#featured', '#products', '#about', '#contact']);
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        const hash = raw.startsWith('#') ? raw : `#${raw.replace(/^\/+/, '')}`;
        return allowed.has(hash) ? hash : fallback;
    }

    normalizeReturnPath(value) {
        const raw = String(value || '').trim();
        if (raw === '/index.html') return '/index.html';
        return '/';
    }

    configureBackButton() {
        const backBtn = document.getElementById('back-to-origin-btn');
        if (!backBtn) return;
        backBtn.setAttribute('href', '/#home');
    }

    setupEventListeners() {
        // Setup tab click handlers - simplified tabs: All, Active, Delivered, Cancelled
        document.getElementById('all-orders-tab')?.addEventListener('click', () => this.switchOrderTab('all'));
        document.getElementById('active-orders-tab')?.addEventListener('click', () => this.switchOrderTab('active'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));

        document.getElementById('close-order-rating-modal')?.addEventListener('click', () => this.closeRatingModal());
        document.getElementById('cancel-order-rating-btn')?.addEventListener('click', () => this.closeRatingModal());
        document.getElementById('order-rating-form')?.addEventListener('submit', (e) => this.submitRatingForm(e));
        document.getElementById('order-rating-modal')?.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'order-rating-modal') {
                this.closeRatingModal();
            }
        });

        document.getElementById('close-order-cancel-modal')?.addEventListener('click', () => this.closeCancelReasonModal());
        document.getElementById('cancel-order-cancel-btn')?.addEventListener('click', () => this.closeCancelReasonModal());
        document.getElementById('order-cancel-form')?.addEventListener('submit', (e) => this.submitCancelReason(e));
        document.getElementById('order-cancel-modal')?.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'order-cancel-modal') {
                this.closeCancelReasonModal();
            }
        });

        document.getElementById('close-order-reason-view-modal')?.addEventListener('click', () => this.closeReasonViewer());
        document.getElementById('close-order-reason-view-btn')?.addEventListener('click', () => this.closeReasonViewer());
        document.getElementById('order-reason-view-modal')?.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'order-reason-view-modal') {
                this.closeReasonViewer();
            }
        });

        // Search and date filter listeners
        const searchInput = document.getElementById('orders-search-input');
        const dateFrom = document.getElementById('orders-date-from');
        const dateTo = document.getElementById('orders-date-to');
        const clearBtn = document.getElementById('orders-search-clear');
        if (searchInput) searchInput.addEventListener('input', () => {
            this.searchQuery = searchInput.value.trim().toLowerCase();
            this.renderOrdersByStatus(this.currentStatus);
        });
        if (dateFrom) dateFrom.addEventListener('change', () => {
            this.dateFrom = dateFrom.value;
            this.renderOrdersByStatus(this.currentStatus);
        });
        if (dateTo) dateTo.addEventListener('change', () => {
            this.dateTo = dateTo.value;
            this.renderOrdersByStatus(this.currentStatus);
        });
        if (clearBtn) clearBtn.addEventListener('click', () => {
            this.searchQuery = '';
            this.dateFrom = '';
            this.dateTo = '';
            if (searchInput) searchInput.value = '';
            if (dateFrom) dateFrom.value = '';
            if (dateTo) dateTo.value = '';
            this.renderOrdersByStatus(this.currentStatus);
        });

        document.querySelectorAll('.order-rating-star-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const value = Number(button.getAttribute('data-rating') || 0);
                this.setRatingValue(value);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeRatingModal();
                this.closeCancelReasonModal();
                this.closeReasonViewer();
            }
        });
    }

    switchOrderTab(tab) {
        this.currentTab = tab;
        
        // Hide all tabs and sections
        document.querySelectorAll('.order-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Show selected tab and section
        const tabBtn = document.getElementById(`${tab}-orders-tab`);
        const section = document.getElementById(`${tab}-orders-section`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (section) section.classList.add('active');
        
        // Map simplified tabs to actual order statuses
        const statusMap = {
            'all': ['pending', 'preorder_reserved', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery', 'delivered', 'cancelled'],
            'active': ['pending', 'preorder_reserved', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery'],
            'delivered': ['delivered'],
            'cancelled': ['cancelled']
        };
        
        const statuses = statusMap[tab] || statusMap['all'];
        this.renderOrdersByStatus(statuses);
    }

    setupRealtime() {
        try {
            if (!this.token || !this.userId) return;
            const eventBases = this.getApiBases();
            let es = null;
            for (const base of eventBases) {
                try {
                    const normalized = String(base || '').replace(/\/+$/, '');
                    const url = `${normalized}/events?token=${encodeURIComponent(this.token)}`;
                    es = new EventSource(url);
                    break;
                } catch (_) {
                    // Try next base.
                }
            }
            if (!es) return;
            es.addEventListener('order.updated', (evt) => {
                try {
                    const data = JSON.parse(evt.data || '{}');
                    if (data.customer_id && Number(data.customer_id) === Number(this.userId)) {
                        const newStatus = data.new_status;
                        // Reload orders to show updated status in real-time
                        this.loadOrders().then(() => {
                            // Switch to the tab showing the new status if available
                            if (newStatus) {
                                setTimeout(() => {
                                    this.switchOrderTab(newStatus);
                                }, 100);
                            }
                        });
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

    async loadOrders() {
        try {
            const response = await this.fetchWithApiFallback(`/orders?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                this.groupOrdersByStatus(data.orders || []);
                this.renderAllOrders();
                this.applyHighlightFromQuery();
            } else {
                console.error('Failed to load orders:', response.status, response.statusText);
                this.showErrorState();
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showErrorState();
        }
    }

    showErrorState() {
        const ordersContainer = document.getElementById('orders');
        if (ordersContainer) {
            const cardBody = ordersContainer.querySelector('.card-body');
            if (cardBody) {
                cardBody.innerHTML = `
                    <div class="text-center py-5">
                        <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                        <p class="text-muted mt-3">Unable to load orders</p>
                        <p class="text-muted small">Please check your connection and try again</p>
                        <button class="btn btn-sm btn-primary mt-2" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    applyHighlightFromQuery() {
        if (!this.highlightOrderId || Number.isNaN(this.highlightOrderId)) return;

        let foundStatus = null;
        for (const [status, orders] of Object.entries(this.ordersByStatus)) {
            if ((orders || []).some((order) => Number(order.id) === this.highlightOrderId)) {
                foundStatus = status;
                break;
            }
        }

        if (!foundStatus) return;

        this.switchOrderTab(foundStatus);
        setTimeout(() => {
            const target = document.querySelector(`.order-card[data-order-id="${this.highlightOrderId}"]`);
            if (target) {
                target.classList.add('order-card-highlight');
                target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                setTimeout(() => target.classList.remove('order-card-highlight'), 2200);
            }
        }, 120);

        const params = new URLSearchParams(window.location.search);
        params.delete('highlightOrderId');
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, '', next);
        this.highlightOrderId = 0;
    }

    groupOrdersByStatus(orders) {
        // Reset all status arrays
        this.ordersByStatus = { pending: [], preorder_reserved: [], confirmed: [], preparing: [], scheduled: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.currentTab = 'all';
        
        // Group orders by status
        orders.forEach(order => {
            const item = (order.items && order.items[0]) || order;
            const status = (item.status || order.status || 'pending').toLowerCase();
            
            if (this.ordersByStatus.hasOwnProperty(status)) {
                this.ordersByStatus[status].push(order);
            } else {
                // If status doesn't match, put in pending
                this.ordersByStatus.pending.push(order);
            }
        });
    }

    renderAllOrders() {
        // Render orders for all statuses
        Object.keys(this.ordersByStatus).forEach(status => {
            this.renderOrdersByStatus(status);
        });
        // Update tab counters after rendering
        this.updateTabCounts();
    }

    updateTabCounts() {
        try {
            Object.keys(this.ordersByStatus).forEach(status => {
                const count = (this.ordersByStatus[status] || []).length || 0;
                const tab = document.getElementById(`${status}-orders-tab`);
                if (!tab) return;
                const label = this.formatStatusLabel(status);
                if (count > 0) {
                    tab.innerHTML = `${label} <span class="tab-count" style="background:#ef4444;color:#fff;border-radius:12px;padding:2px 6px;margin-left:8px;font-size:0.85rem;vertical-align:middle;">${count}</span>`;
                } else {
                    tab.textContent = label;
                }
            });
        } catch (e) {
            // ignore DOM errors
        }
    }

    renderOrdersByStatus(statuses) {
        // Handle both single status string and array of statuses
        const statusArray = Array.isArray(statuses) ? statuses : [statuses];
        const container = document.getElementById(`${this.currentTab}-orders-list`);
        if (!container) return;

        // Collect orders from all relevant statuses
        let allOrders = [];
        statusArray.forEach(status => {
            const orders = this.ordersByStatus[status] || [];
            allOrders = allOrders.concat(orders);
        });

        // Apply search + date filters
        const q = this.searchQuery || '';
        const fromMs = this.dateFrom ? new Date(this.dateFrom).getTime() : 0;
        const toMs = this.dateTo ? new Date(this.dateTo + 'T23:59:59').getTime() : Infinity;
        const filtered = allOrders.filter((order) => {
            const item = (order.items && order.items[0]) || order;
            const matchesSearch = !q
                || String(order.id || '').includes(q)
                || String(item.product_name || '').toLowerCase().includes(q);
            const orderDate = new Date(order.created_at).getTime();
            const matchesDate = (!fromMs || orderDate >= fromMs) && orderDate <= toMs;
            return matchesSearch && matchesDate;
        });

        if (filtered.length === 0) {
            const tabLabel = this.formatTabLabel(this.currentTab);
            container.innerHTML = `<div class="empty-state">No ${tabLabel} orders found${q ? ' matching your search' : ''}.</div>`;
            return;
        }

        container.innerHTML = filtered.map(order => {
            const item = (order.items && order.items[0]) || order;
            const isPreorder = order.is_preorder || item.is_preorder || false;
            const canCancel = (item.status || order.status || 'pending') === 'pending';
            const deliveredAtRaw = item.delivered_at || order.delivered_at || null;
            const isDelivered = (item.status || order.status || 'pending') === 'delivered';
            const deliveredAt = deliveredAtRaw ? new Date(deliveredAtRaw) : null;
            const ratingDeadline = deliveredAt && !Number.isNaN(deliveredAt.getTime()) ? new Date(deliveredAt.getTime()) : null;
            if (ratingDeadline) ratingDeadline.setMonth(ratingDeadline.getMonth() + 1);
            const canRateNow = isDelivered && ratingDeadline && new Date() <= ratingDeadline;
            const canRateExpired = isDelivered && (!ratingDeadline || new Date() > ratingDeadline);

            const currentStatus = item.status || order.status || 'pending';
            const createdAt = new Date(order.created_at);
            const displayDate = Number.isNaN(createdAt.getTime()) ? '—' : createdAt.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
            const displayTime = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
            const cancellationReason = item.cancellation_reason || order.cancellation_reason || 'No reason provided.';
            const encodedReason = encodeURIComponent(cancellationReason);
            const encodedProductName = encodeURIComponent(item.product_name || 'Product');
            const quantity = Number(item.quantity || order.quantity || 1) || 1;

            // Delivery tracking timeline
            const steps = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
            const currentStepIdx = steps.indexOf(currentStatus);
            const isCancelled = currentStatus === 'cancelled';
            const timelineHtml = !isCancelled ? `
                <div class="order-timeline" style="display:flex;align-items:center;gap:0;margin:12px 0 4px;overflow-x:auto;padding-bottom:2px;">
                    ${steps.map((step, i) => {
                        const done = i <= currentStepIdx;
                        const active = i === currentStepIdx;
                        const labels = { pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', out_for_delivery: 'On the Way', delivered: 'Delivered' };
                        const color = done ? '#10b981' : '#d1d5db';
                        const textColor = active ? '#059669' : done ? '#10b981' : '#9ca3af';
                        return `
                            <div style="display:flex;flex-direction:column;align-items:center;min-width:72px;">
                                <div style="width:24px;height:24px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;${active ? 'box-shadow:0 0 0 3px #d1fae5;' : ''}">
                                    ${done ? '<i class="fas fa-check" style="color:#fff;font-size:11px;"></i>' : `<span style="width:8px;height:8px;border-radius:50%;background:#fff;display:block;"></span>`}
                                </div>
                                <span style="font-size:10px;color:${textColor};margin-top:3px;text-align:center;font-weight:${active ? '600' : '400'};white-space:nowrap;">${labels[step]}</span>
                            </div>
                            ${i < steps.length - 1 ? `<div style="flex:1;height:2px;background:${i < currentStepIdx ? '#10b981' : '#e5e7eb'};min-width:20px;margin-bottom:18px;"></div>` : ''}
                        `;
                    }).join('')}
                </div>` : '';

            return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <div class="order-head-left">
                        <div class="order-date">
                            <div>${displayDate}</div>
                            <small>${displayTime}</small>
                        </div>
                        <div class="order-id">${isPreorder ? 'Pre-order' : 'Order'} #${order.id}</div>
                    </div>
                    <div class="order-status-line">
                        <strong>${isPreorder ? 'Pre-order' : 'Order'} Status:</strong>
                        <span style="font-weight: 600; color: ${this.getStatusColor(currentStatus)};">${this.formatStatusLabel(currentStatus)}</span>
                        ${isPreorder ? '<span class="badge bg-warning text-dark ms-2">Pre-order</span>' : ''}
                    </div>
                </div>
                ${timelineHtml}
                <div class="order-item">
                    <img src="${item.image_url || window.__PLACEHOLDER_IMAGE__}" alt="${item.product_name || 'Product'}">
                    <div class="order-item-info">
                        <div class="order-item-name">${item.product_name || 'Product'}</div>
                        <div class="order-item-meta">${this.fmtNumber(quantity)} x ${this.fmtCurrency(item.price || order.price || 0)} ${item.unit || ''}</div>
                        <div class="order-item-meta"><strong>From:</strong> ${item.farmer_name || 'Local Farmer'}${item.farmer_verified ? ' <i class="fas fa-check-circle" style="color: #0d6efd; margin-left: 4px;" title="Verified Farmer"></i>' : ''}</div>
                        ${isPreorder && item.preorder_availability_date ? `<div class="order-item-meta"><strong>Available:</strong> ${item.preorder_availability_date}</div>` : ''}
                        ${(currentStatus === 'cancelled') ? `
                            <div class="order-item-meta">
                                <button class="btn btn-small btn-secondary" onclick="ordersPage.openReasonViewer('${encodedReason}')">
                                    <i class="fas fa-circle-info"></i> View Reason
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="order-item-side">
                        <span class="order-total">${this.fmtCurrency(order.total_amount)}</span>
                        <div class="order-actions">
                            ${item.farmer_id ? `
                                <button class="btn btn-small btn-primary" onclick="ordersPage.openChat(${order.id}, ${item.farmer_id}, '${encodedProductName}', ${quantity})">
                                    <i class="fas fa-comments"></i> Chat Vendor
                                </button>
                            ` : ''}
                            ${isDelivered ? `
                                <button class="btn btn-small btn-secondary" onclick="ordersPage.reorder(${order.id})" title="Add items back to cart">
                                    <i class="fas fa-redo"></i> Reorder
                                </button>
                            ` : ''}
                            ${canRateNow ? `
                                <button class="btn btn-small btn-secondary" onclick="ordersPage.rateOrderProduct(${item.product_id})">
                                    <i class="fas fa-star"></i> Rate Product
                                </button>
                            ` : ''}
                            ${canRateExpired ? `
                                <button class="btn btn-small" disabled title="Rating is available only for 1 month after delivery.">
                                    <i class="fas fa-clock"></i> Rating Closed
                                </button>
                            ` : ''}
                            ${canCancel ? `
                                <button class="btn btn-small btn-danger" onclick="ordersPage.openCancelReasonModal(${order.id})">Cancel</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    openCancelReasonModal(orderId) {
        this.cancelDraftOrderId = Number(orderId || 0);
        if (!this.cancelDraftOrderId) return;

        const modal = document.getElementById('order-cancel-modal');
        const reasonInput = document.getElementById('order-cancel-reason-input');
        if (reasonInput) reasonInput.value = '';

        if (modal) {
            modal.classList.add('open');
            this.setModalLock(true);
            setTimeout(() => reasonInput?.focus(), 0);
        }
    }

    closeCancelReasonModal() {
        const modal = document.getElementById('order-cancel-modal');
        if (modal && modal.classList.contains('open')) {
            modal.classList.remove('open');
        }
        this.cancelDraftOrderId = null;
        this.syncModalLockState();
    }

    openReasonViewer(encodedReason = '') {
        const reason = decodeURIComponent(String(encodedReason || '')).trim() || 'No reason provided.';
        const textEl = document.getElementById('order-reason-view-text');
        const modal = document.getElementById('order-reason-view-modal');

        if (textEl) textEl.textContent = reason;
        if (modal) {
            modal.classList.add('open');
            this.setModalLock(true);
        }
    }

    closeReasonViewer() {
        const modal = document.getElementById('order-reason-view-modal');
        if (modal && modal.classList.contains('open')) {
            modal.classList.remove('open');
        }
        this.syncModalLockState();
    }

    syncModalLockState() {
        const hasOpenModal = ['order-rating-modal', 'order-cancel-modal', 'order-reason-view-modal']
            .some((id) => document.getElementById(id)?.classList.contains('open'));
        this.setModalLock(hasOpenModal);
    }

    async submitCancelReason(e) {
        e.preventDefault();
        const orderId = Number(this.cancelDraftOrderId || 0);
        if (!orderId) return;

        const reasonInput = document.getElementById('order-cancel-reason-input');
        const submitBtn = document.getElementById('submit-order-cancel-btn');
        const reason = String(reasonInput?.value || '').trim();

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Cancelling...';
            }

            const ok = await this.cancelOrder(orderId, reason);
            if (ok) {
                this.closeCancelReasonModal();
                this.loadOrders();
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm Cancel';
            }
        }
    }

    getOrderItemByProductId(productId) {
        const statuses = Object.keys(this.ordersByStatus);
        for (const status of statuses) {
            const orders = this.ordersByStatus[status] || [];
            for (const order of orders) {
                const item = (order.items && order.items[0]) || order;
                if (Number(item.product_id) === Number(productId)) {
                    return item;
                }
            }
        }
        return null;
    }

    setModalLock(locked) {
        const html = document.documentElement;
        const body = document.body;
        if (!html || !body) return;

        if (locked) {
            html.classList.add('modal-open');
            body.classList.add('modal-open');
        } else {
            html.classList.remove('modal-open');
            body.classList.remove('modal-open');
        }
    }

    setRatingValue(value) {
        this.ratingDraft.rating = Number(value || 0);
        const normalized = Math.max(0, Math.min(5, this.ratingDraft.rating));

        document.querySelectorAll('.order-rating-star-btn').forEach((button) => {
            const starValue = Number(button.getAttribute('data-rating') || 0);
            button.classList.toggle('active', starValue <= normalized);
        });

        const textEl = document.getElementById('order-rating-value');
        if (textEl) {
            textEl.textContent = normalized > 0 ? `${normalized} star${normalized > 1 ? 's' : ''}` : 'Select a rating';
        }
    }

    openRatingModal({ productId, productName, reviewId, currentRating, currentComment }) {
        this.ratingDraft.productId = Number(productId);
        this.ratingDraft.reviewId = reviewId ? Number(reviewId) : null;
        this.ratingDraft.productName = productName || 'Product';

        const modal = document.getElementById('order-rating-modal');
        const nameEl = document.getElementById('order-rating-product-name');
        const commentEl = document.getElementById('order-rating-comment');
        const submitBtn = document.getElementById('submit-order-rating-btn');

        if (nameEl) nameEl.textContent = this.ratingDraft.productName;
        if (commentEl) commentEl.value = String(currentComment || '');
        if (submitBtn) submitBtn.textContent = this.ratingDraft.reviewId ? 'Update Rating' : 'Save Rating';

        this.setRatingValue(Number(currentRating || 0));

        if (modal) {
            modal.classList.add('open');
            this.setModalLock(true);
        }
    }

    closeRatingModal() {
        const modal = document.getElementById('order-rating-modal');
        if (modal && modal.classList.contains('open')) {
            modal.classList.remove('open');
            this.setModalLock(false);
        }

        this.ratingDraft = {
            productId: null,
            reviewId: null,
            rating: 0,
            productName: ''
        };
    }

    async rateOrderProduct(productId) {
        if (!productId) return;

        try {
            const eligibilityRes = await fetch(`${this.apiBase}/products/${productId}/reviews/eligibility`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            let eligibility = null;
            if (eligibilityRes.ok) {
                eligibility = await eligibilityRes.json();
            }

            if (!eligibilityRes.ok || !eligibility?.can_rate) {
                showToast((eligibility && eligibility.reason) || 'You can rate only delivered items within 1 month of delivery.', 'warning');
                return;
            }

            const item = this.getOrderItemByProductId(productId);
            this.openRatingModal({
                productId,
                productName: item?.product_name || 'Product',
                reviewId: eligibility?.my_review?.id || null,
                currentRating: eligibility?.my_review?.rating || 0,
                currentComment: eligibility?.my_review?.comment || ''
            });
        } catch (error) {
            console.error('Rate product error:', error);
            showToast('Unable to submit rating right now.', 'error');
        }
    }

    async submitRatingForm(e) {
        e.preventDefault();

        const productId = Number(this.ratingDraft.productId || 0);
        const rating = Number(this.ratingDraft.rating || 0);
        const reviewId = Number(this.ratingDraft.reviewId || 0) || null;
        const comment = String(document.getElementById('order-rating-comment')?.value || '').trim();

        if (!productId) {
            showToast('Unable to submit rating right now.', 'error');
            return;
        }

        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            showToast('Please select a rating from 1 to 5 stars.', 'warning');
            return;
        }

        const submitBtn = document.getElementById('submit-order-rating-btn');
        const originalText = submitBtn ? submitBtn.textContent : '';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            let response;
            if (reviewId) {
                response = await fetch(`${this.apiBase}/reviews/${reviewId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ rating, comment })
                });
            } else {
                response = await fetch(`${this.apiBase}/products/${productId}/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ rating, comment })
                });
            }

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(payload?.message || 'Unable to submit rating right now.', 'error');
                return;
            }

            showToast('Your rating was saved successfully.', 'success');
            this.closeRatingModal();
            this.loadOrders();
        } catch (error) {
            console.error('Submit rating error:', error);
            showToast('Unable to submit rating right now.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText || 'Save Rating';
            }
        }
    }

    clearOrders() {
        // Clear all order containers using simplified tab structure
        const tabs = ['all', 'active', 'delivered', 'cancelled'];
        tabs.forEach(tab => {
            const container = document.getElementById(`${tab}-orders-list`);
            if (container) {
                container.innerHTML = '<div class="empty-state">No orders found.</div>';
            }
        });
        // Reset orders by status
        this.ordersByStatus = { pending: [], preorder_reserved: [], confirmed: [], preparing: [], scheduled: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.currentTab = 'all';
        // Force reload from server
        this.loadOrders();
    }

    async cancelOrder(orderId, reason = '') {
        try {
            const response = await fetch(`${this.apiBase}/orders/${orderId}/cancel`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ reason })
            });
            if (response.ok) {
                return true;
            }
            const payload = await response.json().catch(() => ({}));
            showToast(payload?.message || 'Unable to cancel order.', 'error');
            return false;
        } catch (error) {
            console.error('Cancel order error:', error);
            showToast('Unable to cancel order right now.', 'error');
            return false;
        }
    }


    async openChat(orderId, farmerId, encodedProductName = '', quantity = 1) {
        if (!farmerId) {
            showToast('Farmer information not available.', 'error');
            return;
        }
        const params = new URLSearchParams(window.location.search);
        const returnTo = this.normalizeReturnTo(params.get('returnTo') || this.returnTo);
        const returnUrl = `${window.location.pathname}?highlightOrderId=${orderId}&returnTo=${encodeURIComponent(returnTo)}`;
        const productName = decodeURIComponent(String(encodedProductName || 'Product'));
        const safeQty = Number(quantity || 1) || 1;
        window.location.href = `/chat.html?farmerId=${farmerId}&orderId=${orderId}&productName=${encodeURIComponent(productName)}&quantity=${safeQty}&returnUrl=${encodeURIComponent(returnUrl)}`;
    }

    async reorder(orderId) {
        const allOrders = Object.values(this.ordersByStatus).flat();
        const order = allOrders.find((o) => Number(o.id) === Number(orderId));
        if (!order) { showToast('Order not found.', 'error'); return; }
        const item = (order.items && order.items[0]) || order;
        const productId = item.product_id;
        const quantity = Number(item.quantity || 1) || 1;
        if (!productId) { showToast('Product information not available.', 'error'); return; }

        try {
            const response = await this.fetchWithApiFallback('/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ product_id: productId, quantity })
            });
            if (response.ok) {
                showToast(`${item.product_name || 'Item'} added to your cart!`, 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                showToast(data.message || 'Unable to add item to cart.', 'error');
            }
        } catch (err) {
            console.error('Reorder error:', err);
            showToast('Unable to add item to cart right now.', 'error');
        }
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
            'preorder_reserved': 'Pre-order Reserved',
            'confirmed': 'Confirmed',
            'preparing': 'Preparing',
            'scheduled': 'Scheduled',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return labels[status] || status;
    }

    formatTabLabel(tab) {
        const labels = {
            'all': 'All',
            'active': 'Active',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return labels[tab] || tab;
    }
}

const ordersPage = new OrdersPage();
