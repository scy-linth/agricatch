class OrdersPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.userId = this.getUserId();
        this.currentStatus = 'pending';
        this.ordersByStatus = { pending: [], confirmed: [], preparing: [], out_for_delivery: [], delivered: [], cancelled: [] };
        this.init();
    }

    init() {
        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }
        this.setupEventListeners();
        this.loadOrders();
        this.setupRealtime();
    }

    setupEventListeners() {
        // Setup tab click handlers
        document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
        document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
        document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
        document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));
    }

    switchOrderTab(status) {
        this.currentStatus = status;
        
        // Hide all tabs and sections
        document.querySelectorAll('.order-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Show selected tab and section
        const tab = document.getElementById(`${status}-orders-tab`);
        const section = document.getElementById(`${status}-orders-section`);
        
        if (tab) tab.classList.add('active');
        if (section) section.classList.add('active');
        
        // Render orders for this status
        this.renderOrdersByStatus(status);
    }

    setupRealtime() {
        try {
            if (!this.token || !this.userId) return;
            const url = `/api/events?token=${encodeURIComponent(this.token)}`;
            const es = new EventSource(url);
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
            const response = await fetch(`${this.apiBase}/orders?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                this.groupOrdersByStatus(data.orders || []);
                this.renderAllOrders();
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    groupOrdersByStatus(orders) {
        // Reset all status arrays
        this.ordersByStatus = { pending: [], confirmed: [], preparing: [], out_for_delivery: [], delivered: [], cancelled: [] };
        
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
    }

    renderOrdersByStatus(status) {
        const orders = this.ordersByStatus[status] || [];
        const container = document.getElementById(`${status}-orders-list`);
        if (!container) return;

        if (orders.length === 0) {
            const statusLabel = this.formatStatusLabel(status);
            container.innerHTML = `<div class="empty-state">No ${statusLabel} orders found.</div>`;
            return;
        }

        container.innerHTML = orders.map(order => {
            const item = (order.items && order.items[0]) || order;
            const canCancel = (item.status || order.status || 'pending') === 'pending';
            
            return `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id">Order #${order.id}</div>
                    <div class="order-date">${new Date(order.created_at).toLocaleDateString()}</div>
                </div>
                <div class="order-details">
                    <div class="order-item-meta">
                        <strong>Order Status:</strong> <span style="font-weight: 600; color: ${this.getStatusColor(item.status || order.status || 'pending')};">${this.formatStatusLabel(item.status || order.status || 'pending')}</span>
                    </div>
                </div>
                <div class="order-details">
                    <div class="order-item">
<<<<<<< HEAD
                        <img src="${item.image_url || window.__PLACEHOLDER_IMAGE__}" alt="${item.product_name || 'Product'}">
=======
                        <img src="${item.image_url || 'https://via.placeholder.com/60x60?text=No+Image'}" alt="${item.product_name || 'Product'}">
>>>>>>> f2c98e8770f5bb361ad93161b06facf0f4a2fcff
                        <div class="order-item-info">
                            <div class="order-item-name">${item.product_name || 'Product'}</div>
                            <div class="order-item-meta">${item.quantity || order.quantity || 1} x ₱${parseFloat(item.price || order.price || 0).toFixed(2)} ${item.unit || ''}</div>
                            <div class="order-item-meta"><strong>Status:</strong> <span style="font-weight: 600; color: ${this.getStatusColor(item.status || order.status || 'pending')};">${this.formatStatusLabel(item.status || order.status || 'pending')}</span></div>
                            <div class="order-actions">
                                ${item.farmer_id ? `
                                    <button class="btn btn-small btn-primary" onclick="ordersPage.openChat(${order.id}, ${item.farmer_id})">
                                        <i class="fas fa-comments"></i> Chat Vendor
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="order-actions">
                    <span class="order-total">₱${parseFloat(order.total_amount).toFixed(2)}</span>
                    ${canCancel ? `
                        <button class="btn btn-small btn-danger" onclick="ordersPage.cancelOrder(${order.id})">Cancel</button>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    }

    clearOrders() {
        // Clear all order containers
        const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        statuses.forEach(status => {
            const container = document.getElementById(`${status}-orders-list`);
            if (container) {
                container.innerHTML = '<div class="empty-state">No orders found.</div>';
            }
        });
        // Reset orders by status
        this.ordersByStatus = { pending: [], confirmed: [], preparing: [], out_for_delivery: [], delivered: [], cancelled: [] };
        // Force reload from server
        this.loadOrders();
    }

    async cancelOrder(orderId) {
        const reason = prompt('Reason for cancellation (optional):') || '';
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
                this.loadOrders();
            }
        } catch (error) {
            console.error('Cancel order error:', error);
        }
    }


    async openChat(orderId, farmerId) {
        if (!farmerId) {
            alert('Farmer information not available');
            return;
        }
        // Open chat page with farmer ID
        window.location.href = `/chat.html?farmerId=${farmerId}&orderId=${orderId}`;
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
}

const ordersPage = new OrdersPage();
