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

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this.init();
    }

    init() {
        this.showDeniedBanner();
        this.checkFarmerAuth();
        this.setupEventListeners();
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
                            <div style="font-size:13px;">You tried to open the Admin Panel. Only admins can access it.</div>
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
                // If an admin opens farmer page, send them back to admin panel
                if (data.user.role === 'admin') {
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
                            <div style="font-size:13px;">Admins cannot access the Farmer Dashboard. Redirecting to Admin Panel...</div>
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

        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('add-product-form').addEventListener('submit', (e) => this.handleAddProduct(e));
        document.getElementById('edit-product-form').addEventListener('submit', (e) => this.handleEditProduct(e));
        document.getElementById('save-shop-profile-btn').addEventListener('click', (e) => this.handleShopProfileUpdate(e));

        const editShopBtn = document.getElementById('edit-shop-profile-btn');
        if (editShopBtn) {
            editShopBtn.addEventListener('click', () => this.setShopProfileEditMode(true));
        }
        const cancelShopBtn = document.getElementById('cancel-shop-profile-btn');
        if (cancelShopBtn) {
            cancelShopBtn.addEventListener('click', () => this.cancelShopProfileEdit());
        }
        
        // Back to Top button
        const backToTopBtn = document.getElementById('back-to-top-btn');
        if (backToTopBtn) {
            backToTopBtn.addEventListener('click', (e) => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Topbar search focus
        const searchToggle = document.getElementById('farmer-search-toggle');
        const searchInput = document.getElementById('farmer-search-input');
        if (searchToggle && searchInput) {
            searchToggle.addEventListener('click', () => searchInput.focus());
        }
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyTopSearch());
        }

        // Tab switching
        document.getElementById('list-products-tab').addEventListener('click', () => this.switchTab('list-products'));
        document.getElementById('add-product-tab').addEventListener('click', () => this.switchTab('add-product'));

        // Order status tabs - all 6 statuses
        document.getElementById('pending-orders-tab')?.addEventListener('click', () => this.switchOrderTab('pending'));
        document.getElementById('confirmed-orders-tab')?.addEventListener('click', () => this.switchOrderTab('confirmed'));
        document.getElementById('preparing-orders-tab')?.addEventListener('click', () => this.switchOrderTab('preparing'));
        document.getElementById('out_for_delivery-orders-tab')?.addEventListener('click', () => this.switchOrderTab('out_for_delivery'));
        document.getElementById('delivered-orders-tab')?.addEventListener('click', () => this.switchOrderTab('delivered'));
        document.getElementById('cancelled-orders-tab')?.addEventListener('click', () => this.switchOrderTab('cancelled'));

        // Product filters
        document.getElementById('product-search').addEventListener('input', () => this.filterProducts());
        document.getElementById('product-status-filter').addEventListener('change', () => this.filterProducts());
        
        // Optional refresh buttons (check if they exist)
        const refreshProductsBtn = document.getElementById('refresh-products-btn');
        if (refreshProductsBtn) {
            refreshProductsBtn.addEventListener('click', () => this.loadMyProducts());
        }
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
        const savedSection = localStorage.getItem('farmerActiveSection');
        const hash = (window.location.hash || '').replace('#', '');
        const initialSection = savedSection || hash || 'dashboard';
        this.showSection(initialSection);
    }

    showSection(section) {
        this.activeSection = section;
        // Save current section to localStorage
        localStorage.setItem('farmerActiveSection', section);

        document.querySelectorAll('.admin-sidebar .sidebar-link[data-section]').forEach(a => {
            a.classList.toggle('active', a.getAttribute('data-section') === section);
        });
        document.querySelectorAll('main.admin-main .admin-section-card').forEach(sec => {
            sec.classList.toggle('active', sec.id === section);
        });

        const titles = {
            overview: 'Overview',
            products: 'Products',
            orders: 'Orders',
            chat: 'Chat'
        };
        const titleEl = document.getElementById('farmer-page-title');
        if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';

        // Load data when switching to specific sections
        if (section === 'orders') {
            this.loadMyOrders();
        } else if (section === 'products') {
            this.loadMyProducts();
        }

        // Update hash (non-destructive)
        try {
            window.history.replaceState({}, '', `#${section}`);
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

    async loadFarmerStats() {
        try {
            // Load my products count
            const productsResponse = await fetch(`${this.apiBase}/products/farmer/${this.farmerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (productsResponse.ok) {
                const productsData = await productsResponse.json();
                document.getElementById('my-products').textContent = productsData.products.length;
                const shopTotalProducts = document.getElementById('shop-total-products');
                if (shopTotalProducts) {
                    shopTotalProducts.textContent = productsData.products.length;
                }
            }

            // Load farmer stats
            const statsResponse = await fetch(`${this.apiBase}/farmers/me/stats`, {
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

                if (totalOrdersEl) totalOrdersEl.textContent = stats.total_orders ?? 0;
                if (totalSoldEl) totalSoldEl.textContent = stats.total_sold ?? 0;
                if (totalRevenueEl) totalRevenueEl.textContent = `₱${parseFloat(stats.total_revenue || 0).toFixed(2)}`;
                if (unreadMessagesEl) unreadMessagesEl.textContent = stats.unread_customers ?? 0;
            }

        } catch (error) {
            console.error('Error loading farmer stats:', error);
        }
    }

    async loadShopProfile() {
        try {
            const response = await fetch(`${this.apiBase}/farmers/${this.farmerId}/profile`);
            if (response.ok) {
                const data = await response.json();
                const profile = data.profile;
                this.currentShopProfile = profile;
                
                // Populate read-only display fields
                const shopNameDisplay = document.getElementById('shop-name-display');
                if (shopNameDisplay) {
                    shopNameDisplay.textContent = profile.full_name || profile.username || '—';
                }
                const shopLocationDisplay = document.getElementById('shop-location-display');
                if (shopLocationDisplay) {
                    const loc = profile.location || 'Farm location not set';
                    shopLocationDisplay.innerHTML = `<i class="fas fa-location-dot"></i> <span>${this.escapeHtml(loc)}</span>`;
                }
                const shopDescDisplay = document.getElementById('shop-description-display');
                if (shopDescDisplay) {
                    shopDescDisplay.textContent = profile.shop_description || 'No description yet.';
                }

                // Populate editable fields
                const shopNameInput = document.getElementById('shop-name-input');
                const shopLocationInput = document.getElementById('shop-location-input');
                const shopDescriptionInput = document.getElementById('shop-description-input');
                
                if (shopNameInput) {
                    shopNameInput.value = profile.full_name || profile.username || '';
                }
                if (shopLocationInput) {
                    shopLocationInput.value = profile.location || '';
                }
                if (shopDescriptionInput) {
                    shopDescriptionInput.value = profile.shop_description || '';
                }

                // Always default to view mode after loading
                this.setShopProfileEditMode(false);
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
    }

    cancelShopProfileEdit() {
        try {
            // Reset inputs to last loaded profile
            const profile = this.currentShopProfile || {};
            const shopNameInput = document.getElementById('shop-name-input');
            const shopLocationInput = document.getElementById('shop-location-input');
            const shopDescriptionInput = document.getElementById('shop-description-input');

            if (shopNameInput) shopNameInput.value = profile.full_name || profile.username || '';
            if (shopLocationInput) shopLocationInput.value = profile.location || '';
            if (shopDescriptionInput) shopDescriptionInput.value = profile.shop_description || '';
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
                this.renderMyProducts(data.products);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    renderMyProducts(products) {
        const container = document.getElementById('my-products-grid');

        if (products.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>You haven\'t added any products yet.</p><p>Add your first product in the "Add Product" tab!</p></div>';
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="product-card">
                <img src="${product.image_url || '/images/logo.png'}"
                     alt="${product.name}" class="product-image" onerror="this.src='/images/logo.png'">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price">₱${parseFloat(product.price).toFixed(2)} per ${product.unit}</div>
                    <div class="product-details">
                        <span class="product-status">${product.is_available ? 'Available' : 'Unavailable'}</span> |
                        Stock: ${product.stock_quantity}
                    </div>
                    <div class="product-actions">
                        <button onclick="farmerDashboard.editProduct(${product.id})" class="btn btn-small">Edit</button>
                        <button onclick="farmerDashboard.toggleProductStatus(${product.id}, ${!product.is_available})" class="btn btn-small">
                            ${product.is_available ? 'Disable' : 'Enable'}
                        </button>
                        <button onclick="farmerDashboard.deleteProduct(${product.id})" class="btn btn-small btn-danger">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
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
        if (harvestDate) formData.append('harvest_date', harvestDate);
        if (expiryDate) formData.append('expiry_date', expiryDate);
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
        if (harvestDate) formData.append('harvest_date', harvestDate);
        if (expiryDate) formData.append('expiry_date', expiryDate);

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
        const searchTerm = document.getElementById('product-search').value.toLowerCase();
        const statusFilter = document.getElementById('product-status-filter').value;

        const productCards = document.querySelectorAll('.product-card');

        productCards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            const status = card.querySelector('.product-status').textContent.toLowerCase();

            const matchesSearch = name.includes(searchTerm);
            const matchesStatus = statusFilter === 'all' ||
                                (statusFilter === 'available' && status.includes('available')) ||
                                (statusFilter === 'unavailable' && status.includes('unavailable'));

            if (matchesSearch && matchesStatus) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
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
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Quantity:</strong> ${quantity} x ₱${parseFloat(price).toFixed(2)} ${item.unit || order.unit || ''}</div>
                        <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;"><strong>Total:</strong> ₱${parseFloat(totalAmount).toFixed(2)}</div>
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
        if (!q) {
            // reset simple visibility for common lists
            document.querySelectorAll('#my-products-grid .product-card').forEach(el => (el.style.display = ''));
            document.querySelectorAll('.orders-list .order-card').forEach(el => (el.style.display = ''));
            document.querySelectorAll('#conversation-list .conversation-item').forEach(el => (el.style.display = ''));
            return;
        }

        if (this.activeSection === 'products') {
            document.querySelectorAll('#my-products-grid .product-card').forEach(card => {
                const name = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
                card.style.display = name.includes(q) ? '' : 'none';
            });
        } else if (this.activeSection === 'orders') {
            document.querySelectorAll('.orders-list .order-card').forEach(card => {
                const text = (card.textContent || '').toLowerCase();
                card.style.display = text.includes(q) ? '' : 'none';
            });
        } else if (this.activeSection === 'chat') {
            document.querySelectorAll('#conversation-list .conversation-item').forEach(item => {
                const text = (item.textContent || '').toLowerCase();
                item.style.display = text.includes(q) ? '' : 'none';
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
        window.location.href = `/chat.html?customerId=${customerId}&orderId=${orderId}`;
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