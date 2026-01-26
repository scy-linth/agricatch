// Admin Dashboard JavaScript

class AdminDashboard {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.currentUserId = null;
        this.lastUsers = [];
        this.pendingOrderStatus = new Map();
        this.searchQuery = '';
        this.activeSection = 'orders';

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();
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
                    <input id="admin-recover-secret" type="password" placeholder="Admin secret (default: admin123)" style="flex:1; min-width: 220px; padding:10px 12px; border-radius:10px; border:1px solid #cbd5e1;" />
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
        this.checkAdminAuth();
        this.setupNavigation();
        this.loadDashboardStats();
        this.loadUsers();
        this.loadOrders();
        this.loadProducts();
        this.setupEventListeners();
        this.setupRealtime();
        this.startUnreadPolling();
    }

    setupRealtime() {
        try {
            if (!this.token) return;
            const url = `/api/events?token=${encodeURIComponent(this.token)}`;
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

            es.addEventListener('admin.audit', () => {
                // If logs tab is open, refresh it
                const logsSection = document.getElementById('logs');
                if (logsSection && logsSection.classList.contains('active')) {
                    this.loadAuditLogs();
                }
            });
        } catch (e) {
            // ignore
        }
    }

    setupNavigation() {
        // Load saved section or default to orders
        const savedSection = localStorage.getItem('adminActiveSection') || 'orders';
        this.showSection(savedSection);

        // Add click handlers to sidebar links
        document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (section) {
                    this.showSection(section);

                    // Update active state
                    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });
    }

    showSection(sectionId) {
        this.activeSection = sectionId;
        // Save current section to localStorage
        localStorage.setItem('adminActiveSection', sectionId);

        // Hide all sections
        document.querySelectorAll('.admin-section-card').forEach(section => {
            section.classList.remove('active');
        });

        // Show requested section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Update page title
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            const titles = {
                'orders': 'Orders Management',
                'users': 'Customer Management',
                'products': 'Product Management',
                'logs': 'Audit Logs',
                'reports': 'Reports',
                'stats': 'Dashboard Statistics',
                'notifications': 'Notifications',
                'settings': 'Settings'
            };
            pageTitle.textContent = titles[sectionId] || 'Dashboard';
        }

        // Show/hide order filters based on section
        const orderFilters = document.getElementById('order-filters');
        if (orderFilters) {
            orderFilters.style.display = sectionId === 'orders' ? 'flex' : 'none';
        }

        // Update search placeholder per section
        const searchInput = document.getElementById('admin-search-input');
        if (searchInput) {
            const placeholders = {
                orders: 'Search order id, customer name/email...',
                users: 'Search id, name, username, email...',
                products: 'Search id, product name, farmer name/email...',
                logs: 'Search is in log filters above',
            };
            searchInput.placeholder = placeholders[sectionId] || 'Search...';
        }

        if (sectionId === 'logs') {
            this.loadAuditLogs();
        }
    }

    async checkAdminAuth() {
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

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
                const userNameEl = document.getElementById('user-name');
                const userEmailEl = document.getElementById('user-email');
                if (userNameEl) {
                    userNameEl.textContent = data.user.full_name || data.user.username || 'Admin';
                }
                if (userEmailEl) {
                    userEmailEl.textContent = data.user.email || '';
                }
                // Update welcome banner after auth check
                this.updateWelcomeBanner();
            } else {
                // Invalid/expired session
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/';
        }
    }

    setupEventListeners() {
        // Mobile sidebar toggle
        const mobileMenuToggle = document.getElementById('admin-mobile-menu-toggle');
        const adminSidebar = document.getElementById('admin-sidebar');
        const sidebarOverlay = document.getElementById('admin-sidebar-overlay');
        const closeSidebar = () => {
            if (adminSidebar) adminSidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            const icon = mobileMenuToggle?.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        };
        if (mobileMenuToggle && adminSidebar) {
            mobileMenuToggle.addEventListener('click', () => {
                adminSidebar.classList.toggle('open');
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

        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        const visitSiteBtn = document.getElementById('visit-site-btn');
        if (visitSiteBtn) {
            visitSiteBtn.addEventListener('click', () => this.visitMainSite());
        }
        const statusFilter = document.getElementById('order-status-filter');
        const priceFilter = document.getElementById('order-price-filter');
        const sortFilter = document.getElementById('order-sort-filter');
        const closePanel = document.getElementById('close-order-panel');
        const chatClose = document.getElementById('close-chat-drawer');
        const floatChatBtn = document.getElementById('admin-float-chat-btn');
        const searchToggle = document.getElementById('admin-search-toggle');
        const searchInput = document.getElementById('admin-search-input');

        if (statusFilter) statusFilter.addEventListener('change', () => this.applyOrderFilters());
        if (priceFilter) priceFilter.addEventListener('change', () => this.applyOrderFilters());
        if (sortFilter) sortFilter.addEventListener('change', () => this.applyOrderFilters());
        if (closePanel) closePanel.addEventListener('click', () => this.closeOrderDetails());
        if (chatClose) chatClose.addEventListener('click', () => this.toggleChatDrawer(false));
        if (floatChatBtn) floatChatBtn.addEventListener('click', () => this.toggleChatDrawer(true));

        if (searchToggle && searchInput) {
            // Search input is always visible; button just focuses it
            searchToggle.addEventListener('click', () => searchInput.focus());
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value || '';
                this.applySearch();
            });
        }

        document.querySelectorAll('[data-close-modal]').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-close-modal');
                if (target) this.closeModal(target);
            });
        });

        const editUserForm = document.getElementById('edit-user-form');
        if (editUserForm) {
            editUserForm.addEventListener('submit', (e) => this.submitUserEdit(e));
        }

        const editProductForm = document.getElementById('edit-product-form');
        if (editProductForm) {
            editProductForm.addEventListener('submit', (e) => this.submitProductEdit(e));
        }

        const logsRefreshBtn = document.getElementById('logs-refresh-btn');
        if (logsRefreshBtn) {
            logsRefreshBtn.addEventListener('click', () => this.loadAuditLogs());
        }
    }

    async loadAuditLogs() {
        try {
            const actor_admin_id = document.getElementById('logs-actor-filter')?.value?.trim();
            const action = document.getElementById('logs-action-filter')?.value?.trim();
            const entity = document.getElementById('logs-entity-filter')?.value?.trim();

            const params = new URLSearchParams();
            params.set('limit', '25');
            if (actor_admin_id) params.set('actor_admin_id', actor_admin_id);
            if (action) params.set('action', action);
            if (entity) params.set('entity', entity);

            const response = await fetch(`${this.apiBase}/admin/logs?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) return;
            const data = await response.json();
            this.renderAuditLogs(data.logs || []);
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    }

    renderAuditLogs(logs) {
        const tbody = document.getElementById('logs-tbody');
        if (!tbody) return;

        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="color:#64748b;">No logs found.</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const time = log.created_at ? new Date(log.created_at).toLocaleString() : '';
            const adminLabel = `${log.actor_admin_name || 'Admin'} (#${log.actor_admin_id})`;
            const email = log.actor_admin_email ? `<div style="color:#64748b;font-size:0.85rem;">${log.actor_admin_email}</div>` : '';
            const details = `
                <details>
                    <summary style="cursor:pointer;">View</summary>
                    <pre style="white-space:pre-wrap;max-width:520px;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;padding:8px;border-radius:8px;margin-top:8px;">${this.escapeHtml(JSON.stringify({ before: log.before, after: log.after }, null, 2))}</pre>
                </details>
            `;
            return `
                <tr>
                    <td>${time}</td>
                    <td><div>${adminLabel}</div>${email}</td>
                    <td>${log.action || ''}</td>
                    <td>${log.entity || ''}</td>
                    <td>${log.entity_id ?? ''}</td>
                    <td>${details}</td>
                </tr>
            `;
        }).join('');
    }

    async loadDashboardStats() {
        try {
            const response = await fetch(`${this.apiBase}/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('total-users').textContent = data.stats.totalUsers;
                document.getElementById('total-products').textContent = data.stats.totalProducts;
                document.getElementById('total-orders').textContent = data.stats.totalOrders;
                document.getElementById('total-revenue').textContent = `₱${data.stats.totalRevenue.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(`${this.apiBase}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastUsers = data.users || [];
                this.renderUsers(data.users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = users.map(user => {
            // Handle super admin (virtual user with id -1)
            const isSuperAdmin = user.id === -1 && user.role === 'super_admin';
            const canEditThisUser = this.currentUserRole === 'super_admin' || user.role !== 'admin';
            const canDeleteThisUser = this.currentUserRole === 'super_admin' && user.id !== this.currentUserId && !['admin', 'super_admin'].includes(user.role);

            return `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.username || '—'}</td>
                    <td>${user.full_name || '—'}</td>
                    <td>${user.email}</td>
                    <td>${isSuperAdmin ? '••••••••' : (user.password ?? '')}</td>
                    <td>
                        ${isSuperAdmin ? 
                            '<span class="status-pill" style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Super Admin</span>' :
                            `<select onchange="adminDashboard.updateUserRole(${user.id}, this.value)" ${user.id === this.currentUserId ? 'disabled' : ''}>
                                <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Customer</option>
                                <option value="farmer" ${user.role === 'farmer' ? 'selected' : ''}>Farmer</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>`
                        }
                    </td>
                    <td>
                        ${user.role === 'farmer' ? `
                            <label class="toggle-switch">
                                <input type="checkbox" ${user.is_verified ? 'checked' : ''} onchange="adminDashboard.toggleFarmerVerification(${user.id}, this.checked)" ${isSuperAdmin ? 'disabled' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        ` : '—'}
                    </td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        ${canEditThisUser ? `<button onclick="adminDashboard.openUserEdit(${user.id})" class="btn btn-small">Edit User</button>` : ''}
                        <button onclick="adminDashboard.deleteUser(${user.id})" class="btn btn-small btn-danger" ${!canDeleteThisUser ? 'disabled' : ''}>Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadOrders() {
        try {
            const response = await fetch(`${this.apiBase}/admin/orders?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                cache: 'no-store'
            });

            if (response.ok) {
                const data = await response.json();
                this.lastOrders = data.orders || [];
                this.applyOrderFilters();
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    clearOrdersFromUI() {
        // Clear in-memory cache
        this.lastOrders = [];
        // Clear UI
        this.renderOrders([]);
        // Force reload from server
        this.loadOrders();
    }

    applySearch() {
        const q = (this.searchQuery || '').trim().toLowerCase();
        if (this.activeSection === 'orders') {
            this.applyOrderFilters();
            return;
        }
        if (this.activeSection === 'users') {
            const users = [...(this.lastUsers || [])];
            if (!q) {
                this.renderUsers(users);
                return;
            }
            const filtered = users.filter(u => {
                const id = String(u.id || '');
                const name = String(u.full_name || '').toLowerCase();
                const username = String(u.username || '').toLowerCase();
                const email = String(u.email || '').toLowerCase();
                return id.includes(q) || name.includes(q) || username.includes(q) || email.includes(q);
            });
            this.renderUsers(filtered);
            return;
        }
        if (this.activeSection === 'products') {
            const products = [...(this.lastProducts || [])];
            if (!q) {
                this.renderProducts(products);
                return;
            }
            const filtered = products.filter(p => {
                const id = String(p.id || '');
                const name = String(p.name || '').toLowerCase();
                const farmer = String(p.farmer_name || '').toLowerCase();
                const farmerEmail = String(p.farmer_email || '').toLowerCase();
                return id.includes(q) || name.includes(q) || farmer.includes(q) || farmerEmail.includes(q);
            });
            this.renderProducts(filtered);
        }
    }

    renderOrders(orders) {
        const tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><input type="checkbox" aria-label="Select order ${order.id}"></td>
                <td>#${order.id}</td>
                <td>${order.username || order.email}</td>
                <td><span class="status-pill ${this.getStatusClass(order.status)}">${this.formatStatus(order.status)}</span></td>
                <td>₱${parseFloat(order.total_amount).toFixed(2)}</td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>
                    <button onclick="adminDashboard.viewOrderDetails(${order.id})" class="btn btn-small">View</button>
                    <button onclick="adminDashboard.deleteOrder(${order.id})" class="btn btn-small btn-danger">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async loadProducts() {
        try {
            const response = await fetch(`${this.apiBase}/admin/products`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.lastProducts = data.products || [];
                this.renderProducts(this.lastProducts);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    renderProducts(products) {
        const tbody = document.getElementById('products-tbody');
        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>₱${parseFloat(product.price).toFixed(2)}</td>
                <td>${product.stock_quantity}</td>
                <td>
                    <div>${product.farmer_name || 'Unassigned'}</div>
                    ${product.farmer_email ? `<div style="color:#64748b;font-size:0.85rem;">${product.farmer_email}</div>` : ''}
                </td>
                <td><span class="status-pill ${product.is_available ? 'completed' : 'pending'}">${product.is_available ? 'Available' : 'Unavailable'}</span></td>
                <td>
                    <button onclick="adminDashboard.openProductEdit(${product.id})" class="btn btn-small">Edit</button>
                    <button onclick="adminDashboard.toggleProductStatus(${product.id}, ${!product.is_available})" class="btn btn-small">
                        ${product.is_available ? 'Disable' : 'Enable'}
                    </button>
                    <button onclick="adminDashboard.deleteProduct(${product.id})" class="btn btn-small btn-danger">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async toggleFarmerVerification(userId, isVerified) {
        try {
            const response = await fetch(`${this.apiBase}/admin/users/${userId}/verify`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ is_verified: isVerified })
            });

            if (response.ok) {
                this.showMessage('Farmer verification updated!', 'success');
            } else {
                this.showMessage('Failed to update verification', 'error');
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
                this.showMessage('Order status updated successfully!', 'success');
                this.loadOrders();
            } else {
                this.showMessage('Failed to update order status', 'error');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            this.showMessage('Error updating order status', 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm(`Are you sure you want to delete this user? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showMessage('User deleted successfully!', 'success');
                this.loadUsers();
                this.loadDashboardStats();
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showMessage('Error deleting user', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm(`Are you sure you want to delete this product? This action cannot be undone.`)) {
            return;
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
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to delete product', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showMessage('Error deleting product', 'error');
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
                body: JSON.stringify({ is_available: isAvailable })
            });

            if (response.ok) {
                this.showMessage(`Product ${isAvailable ? 'enabled' : 'disabled'} successfully!`, 'success');
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
        const statusFilter = document.getElementById('order-status-filter');
        const priceFilter = document.getElementById('order-price-filter');
        const sortFilter = document.getElementById('order-sort-filter');

        let filtered = [...(this.lastOrders || [])];

        if (statusFilter && statusFilter.value) {
            filtered = filtered.filter(order => order.status === statusFilter.value);
        }

        if (priceFilter && priceFilter.value) {
            const [min, max] = priceFilter.value.split('-').map(Number);
            filtered = filtered.filter(order => {
                const total = parseFloat(order.total_amount || 0);
                return total >= min && total <= max;
            });
        }

        if (sortFilter && sortFilter.value) {
            if (sortFilter.value === 'date_asc') {
                filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            } else if (sortFilter.value === 'date_desc') {
                filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            } else if (sortFilter.value === 'total_desc') {
                filtered.sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount));
            } else if (sortFilter.value === 'total_asc') {
                filtered.sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
            }
        }

        const q = (this.searchQuery || '').trim().toLowerCase();
        if (q) {
            filtered = filtered.filter(order => {
                const id = String(order.id || '');
                const user = String(order.full_name || order.username || '').toLowerCase();
                const email = String(order.email || '').toLowerCase();
                return id.includes(q) || user.includes(q) || email.includes(q);
            });
        }

        this.renderOrders(filtered);
    }

    startUnreadPolling() {
        const badge = document.getElementById('admin-chat-unread');
        if (!badge) return;

        const load = async () => {
            try {
                const res = await fetch(`${this.apiBase}/messages/unread-count`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (!res.ok) return;
                const data = await res.json().catch(() => ({}));
                const count = Number(data.count || 0);
                badge.textContent = String(count);
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            } catch (_) {
                // ignore
            }
        };

        load();
        setInterval(load, 5000);
    }

    getStatusClass(status) {
        if (['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(status)) return 'preparing';
        if (status === 'delivered') return 'delivered';
        if (status === 'cancelled') return 'pending';
        return 'completed';
    }

    formatStatus(status) {
        if (!status) return 'Pending';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    toggleChatDrawer(show) {
        const drawer = document.getElementById('admin-chat-drawer');
        if (!drawer) return;
        drawer.classList.toggle('active', show);
    }

    closeOrderDetails() {
        const panel = document.getElementById('order-detail-panel');
        if (panel) {
            panel.classList.remove('active');
        }
    }

    openOrderDetails(order) {
        const panel = document.getElementById('order-detail-panel');
        const content = document.getElementById('order-detail-content');
        if (!panel || !content) return;
        this.currentOrderDetail = order;

        content.innerHTML = `
            <div class="panel-header">
                <h3>Order #${order.id}</h3>
                <span class="status-pill ${this.getStatusClass(order.status)}">${this.formatStatus(order.status)}</span>
            </div>
            <div class="panel-section">
                <label for="order-status-select-${order.id}">Update Status</label>
                <select id="order-status-select-${order.id}" class="filter-select">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <button id="save-order-status-${order.id}" class="btn btn-primary btn-small" type="button" style="margin-top:10px;" disabled>
                    Save
                </button>
            </div>
            <div class="panel-section">
                <h4>Customer</h4>
                <p>${order.customer_name || order.username || 'N/A'}</p>
                <p>${order.email || ''}</p>
                <p>${order.customer_phone || ''}</p>
            </div>
            <div class="panel-section">
                <h4>Chat Farmers</h4>
                <div id="order-farmers-list" class="panel-item"></div>
                <p style="color:#64748b;font-size:0.9rem;margin-top:8px;">Select a farmer to open chat in the bottom-right drawer.</p>
            </div>
            <div class="panel-section">
                <h4>Order Info</h4>
                <p>Total: ₱${parseFloat(order.total_amount).toFixed(2)}</p>
                <p>Date: ${new Date(order.created_at).toLocaleString()}</p>
                ${order.delivery_address ? `<p>Address: ${order.delivery_address}</p>` : ''}
            </div>
            <div class="panel-section">
                <h4>Items</h4>
                ${(order.items || []).map(item => `
                    <div class="panel-item">
                        <div>${item.product_name || 'N/A'}</div>
                        <div>${item.quantity} ${item.unit || ''} • ₱${parseFloat(item.price).toFixed(2)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        panel.classList.add('active');

        const statusSelect = document.getElementById(`order-status-select-${order.id}`);
        const saveBtn = document.getElementById(`save-order-status-${order.id}`);
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

        // Build farmer chat list (one farmer at a time)
        const list = document.getElementById('order-farmers-list');
        if (list) {
            const items = Array.isArray(order.items) ? order.items : [];
            const unique = new Map();
            for (const it of items) {
                if (!it?.farmer_id) continue;
                if (!unique.has(it.farmer_id)) {
                    unique.set(it.farmer_id, {
                        id: it.farmer_id,
                        name: it.farmer_name || 'Farmer',
                        email: it.farmer_email || ''
                    });
                }
            }

            if (unique.size === 0) {
                list.innerHTML = `<div style="color:#64748b;">No farmer information found for this order.</div>`;
            } else {
                list.innerHTML = Array.from(unique.values()).map(f => `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #e2e8f0;">
                        <div style="min-width:0;">
                            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(f.name)}</div>
                            <div style="color:#64748b;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(f.email)}</div>
                        </div>
                        <button class="btn btn-primary btn-small" type="button" onclick="adminDashboard.openChatForFarmer(${f.id})">
                            Chat
                        </button>
                    </div>
                `).join('');
            }
        }
    }

    openChatForFarmer(farmerId) {
        const order = this.currentOrderDetail;
        if (!order || !farmerId) return;
        const items = Array.isArray(order.items) ? order.items : [];
        const item = items.find(i => Number(i.farmer_id) === Number(farmerId));
        const farmerName = item?.farmer_name || 'Farmer';

        window.__chatContext = {
            subtitle: `Order #${order.id} • Customer: ${order.customer_name || order.username || 'N/A'}`
        };

        this.toggleChatDrawer(true);

        if (window.chatUI && typeof window.chatUI.openConversationWithFarmer === 'function') {
            window.chatUI.openConversationWithFarmer(farmerId, farmerName);
        }
    }

    openUserEdit(userId) {
        const modal = document.getElementById('edit-user-modal');
        if (!modal) return;

        const user = (this.lastUsers || []).find(u => u.id === userId);
        if (!user) return;

        const idEl = document.getElementById('edit-user-id');
        const fullNameEl = document.getElementById('edit-user-fullname');
        const usernameEl = document.getElementById('edit-user-username');
        const emailEl = document.getElementById('edit-user-email');
        const passwordEl = document.getElementById('edit-user-password');
        const phoneEl = document.getElementById('edit-user-phone');
        const locationEl = document.getElementById('edit-user-location');

        if (idEl) idEl.value = String(userId);
        if (fullNameEl) fullNameEl.value = user.full_name || '';
        if (usernameEl) usernameEl.value = user.username || '';
        if (emailEl) emailEl.value = user.email || '';
        if (passwordEl) passwordEl.value = user.password || '';
        if (phoneEl) phoneEl.value = user.phone || '';
        if (locationEl) locationEl.value = user.address || user.location || '';

        // Show preview of registered values
        phoneEl && (phoneEl.placeholder = user.phone ? `Registered: ${user.phone}` : 'No phone registered');
        locationEl && (locationEl.placeholder = user.address ? `Registered: ${user.address}` : (user.location ? `Registered: ${user.location}` : 'No location registered'));

        modal.style.display = 'block';
    }

    async submitUserEdit(e) {
        e.preventDefault();

        const userId = document.getElementById('edit-user-id')?.value;
        const full_name = document.getElementById('edit-user-fullname')?.value || '';
        const username = document.getElementById('edit-user-username')?.value || '';
        const email = document.getElementById('edit-user-email')?.value || '';
        const password = document.getElementById('edit-user-password')?.value || '';
        const phone = document.getElementById('edit-user-phone')?.value || '';
        const location = document.getElementById('edit-user-location')?.value || '';

        const payload = {
            full_name: full_name.trim(),
            username: username.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address: location.trim(),
        };
        if (password.trim()) payload.password = password;

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
            } else {
                this.showMessage(data.message || 'Failed to update user', 'error');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            this.showMessage('Error updating user', 'error');
        }
    }

    openProductEdit(productId) {
        const modal = document.getElementById('edit-product-modal');
        if (!modal) return;
        document.getElementById('edit-product-id').value = productId;
        const product = (this.lastProducts || []).find(p => p.id === productId);
        if (product) {
            document.getElementById('edit-product-name').value = product.name || '';
            document.getElementById('edit-product-price').value = product.price || '';
            document.getElementById('edit-product-stock').value = product.stock_quantity || '';
            document.getElementById('edit-product-location').value = product.location || '';
        }
        modal.style.display = 'block';
    }

    async submitProductEdit(e) {
        e.preventDefault();
        const productId = document.getElementById('edit-product-id').value;
        const payload = {
            name: document.getElementById('edit-product-name').value,
            price: document.getElementById('edit-product-price').value,
            stock_quantity: document.getElementById('edit-product-stock').value,
            location: document.getElementById('edit-product-location').value
        };

        try {
            const response = await fetch(`${this.apiBase}/admin/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.showMessage('Product updated successfully!', 'success');
                this.closeModal('edit-product-modal');
                this.loadProducts();
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to update product', 'error');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            this.showMessage('Error updating product', 'error');
        }
    }

    async deleteOrder(orderId) {
        if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/admin/orders/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showMessage('Order deleted successfully!', 'success');
                this.loadOrders();
                this.loadDashboardStats();
            } else {
                const errorData = await response.json();
                this.showMessage(errorData.message || 'Failed to delete order', 'error');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            this.showMessage('Error deleting order', 'error');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
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

    updateWelcomeBanner() {
        const banner = document.querySelector('.admin-welcome-banner');
        const titleEl = document.querySelector('.welcome-title');
        const sidebar = document.querySelector('.admin-sidebar');
        const visitSiteBtn = document.getElementById('visit-site-btn');
        const usersLink = document.getElementById('users-link');

        if (banner && titleEl && sidebar) {
            // Update banner class and title based on role
            if (this.currentUserRole === 'super_admin') {
                banner.classList.add('super-admin');
                sidebar.classList.add('super-admin-sidebar');
                titleEl.innerHTML = '<i class="fas fa-crown"></i> SUPER ADMIN';
                // Show visit site button for super admin
                if (visitSiteBtn) {
                    visitSiteBtn.style.display = 'block';
                }
                // Change "Customers" to "Users" for super admin
                if (usersLink) {
                    usersLink.innerHTML = '<i class="fas fa-users"></i> Users';
                }
            } else {
                banner.classList.remove('super-admin');
                sidebar.classList.remove('super-admin-sidebar');
                titleEl.innerHTML = '<i class="fas fa-crown"></i> Admin Dashboard';
                // Hide visit site button for regular admin
                if (visitSiteBtn) {
                    visitSiteBtn.style.display = 'none';
                }
                // Keep "Customers" for regular admin
                if (usersLink) {
                    usersLink.innerHTML = '<i class="fas fa-users"></i> Customers';
                }
            }
        }
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

// Initialize admin dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});