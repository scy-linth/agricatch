// Ensure placeholder image is defined on pages that don't load app.js
window.__PLACEHOLDER_IMAGE__ = window.__PLACEHOLDER_IMAGE__ || '/images/resendlogo.png';

class WishlistPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        const host = String(window.location.hostname || '').toLowerCase();
        if (host === 'agricatch.store' || host === 'www.agricatch.store') {
            this.apiBase = 'https://agricatch.onrender.com/api';
        }
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        this._items = [];
        this._savedPrices = this._loadSavedPrices();
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

    _loadSavedPrices() {
        try {
            return JSON.parse(localStorage.getItem('wishlist_saved_prices') || '{}');
        } catch (_) { return {}; }
    }

    _savePrices(items) {
        const map = {};
        items.forEach((item) => {
            if (!this._savedPrices[item.id]) {
                map[item.id] = Number(item.price || 0);
            } else {
                map[item.id] = this._savedPrices[item.id];
            }
        });
        localStorage.setItem('wishlist_saved_prices', JSON.stringify(map));
        this._savedPrices = map;
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

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    init() {
        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }
        this.setupListeners();
        this.loadWishlist();
    }

    setupListeners() {
        document.getElementById('wishlist-sort')?.addEventListener('change', () => this.renderWishlist(this._items));
        document.getElementById('wishlist-filter-category')?.addEventListener('change', () => this.renderWishlist(this._items));
        document.getElementById('wishlist-add-all-btn')?.addEventListener('click', () => this.addAllToCart());
    }

    async loadWishlist() {
        try {
            const response = await fetch(`${this.apiBase}/wishlist`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const items = data.items || [];
                this._savePrices(items);
                this._items = items;
                this._populateCategoryFilter(items);
                this.renderWishlist(items);
            }
        } catch (error) {
            console.error('Error loading wishlist:', error);
        }
    }

    _populateCategoryFilter(items) {
        const select = document.getElementById('wishlist-filter-category');
        if (!select) return;
        const categories = [...new Set(items.map((i) => i.category_name || '').filter(Boolean))];
        const current = select.value;
        select.innerHTML = '<option value="">All Categories</option>' +
            categories.map((c) => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
        select.value = current;
    }

    _getSortedFiltered(items) {
        const sortVal = document.getElementById('wishlist-sort')?.value || 'date_desc';
        const catFilter = document.getElementById('wishlist-filter-category')?.value || '';
        let list = catFilter ? items.filter((i) => (i.category_name || '') === catFilter) : [...items];
        if (sortVal === 'date_asc') list.sort((a, b) => new Date(a.added_at || 0) - new Date(b.added_at || 0));
        else if (sortVal === 'date_desc') list.sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0));
        else if (sortVal === 'price_asc') list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        else if (sortVal === 'price_desc') list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        return list;
    }

    renderWishlist(items) {
        const grid = document.getElementById('wishlist-grid');
        const addAllBtn = document.getElementById('wishlist-add-all-btn');
        const countBadge = document.getElementById('wishlist-count-badge');
        if (!grid) return;

        const list = this._getSortedFiltered(items);

        if (countBadge) countBadge.textContent = items.length > 0 ? `(${items.length} item${items.length !== 1 ? 's' : ''})` : '';
        if (addAllBtn) addAllBtn.style.display = list.length > 0 ? 'inline-flex' : 'none';

        if (!list.length) {
            grid.innerHTML = (window.renderEmptyState || function() { return ''; })({
                icon: 'fas fa-heart-broken',
                title: 'Your wishlist is empty',
                description: 'Save products you love by tapping the heart icon.',
                actionText: 'Browse Products',
                actionHref: '/#products'
            });
            return;
        }

        // Group items by farmer (like Cart)
        const groupedByFarmer = list.reduce((acc, item) => {
            const farmerName = item.farmer_name || 'Unknown Farmer';
            if (!acc[farmerName]) {
                acc[farmerName] = [];
            }
            acc[farmerName].push(item);
            return acc;
        }, {});

        // Render grouped items
        grid.innerHTML = Object.entries(groupedByFarmer).map(([farmerName, farmerItems]) => {
            const farmerSection = farmerItems.map(item => {
                const savedPrice = this._savedPrices[item.id];
                const currentPrice = Number(item.price || 0);
                const priceDrop = savedPrice && currentPrice < savedPrice;
                const priceIncrease = savedPrice && currentPrice > savedPrice;
                const priceDropBadge = priceDrop
                    ? `<span style="background:#dcfce7;color:#166534;font-size:0.78rem;padding:2px 6px;border-radius:4px;font-weight:600;"><i class="fas fa-arrow-down"></i> Price dropped from ${this.fmtCurrency(savedPrice)}</span>`
                    : priceIncrease
                    ? `<span style="background:#fff7ed;color:#9a3412;font-size:0.78rem;padding:2px 6px;border-radius:4px;font-weight:600;"><i class="fas fa-arrow-up"></i> Price updated</span>`
                    : '';

                const isAvailable = item.status !== 'disabled' && Number(item.stock_quantity ?? 0) > 0;

                return `
                <div class="product-card" style="cursor:pointer;" onclick="wishlistPage.openProduct(${item.id})">
                    <img src="${this.escapeHtml(item.image_url || window.__PLACEHOLDER_IMAGE__)}"
                         alt="${this.escapeHtml(item.name)}" class="product-image" onerror="this.src=window.__PLACEHOLDER_IMAGE__">
                    <div class="product-info">
                        <h3 class="product-name">${this.escapeHtml(item.name)}</h3>
                        <div class="product-price">${this.fmtCurrency(item.price)} per ${this.escapeHtml(item.unit || '')}</div>
                        ${priceDropBadge ? `<div style="margin:4px 0;">${priceDropBadge}</div>` : ''}
                        <div class="product-details">${item.description ? this.escapeHtml(item.description.substring(0, 100)) + '...' : ''}</div>
                        <div class="product-meta">
                            <span>Stock: ${this.fmtNumber(item.stock_quantity ?? 0)}</span>
                            ${item.category_name ? `<span>${this.escapeHtml(item.category_name)}</span>` : ''}
                        </div>
                        <div class="wishlist-actions" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                            <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); wishlistPage.addToCart(${item.id})" ${!isAvailable ? 'disabled title="Out of stock"' : ''}>
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
                            <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); wishlistPage.removeFromWishlist(${item.id})">
                                <i class="fas fa-heart-broken"></i> Remove
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            return `
                <div class="farmer-group-section" style="margin-bottom: 32px;">
                    <div class="farmer-group-header" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;">
                        <i class="fas fa-store" style="color:#0d6efd;font-size:1.2rem;"></i>
                        <h3 style="margin:0;font-size:1.25rem;font-weight:600;color:#1f2937;">${this.escapeHtml(farmerName)}</h3>
                        <span style="background:#e5e7eb;color:#4b5563;font-size:0.75rem;padding:2px 8px;border-radius:12px;font-weight:500;">${farmerItems.length} item${farmerItems.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="products-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;">
                        ${farmerSection}
                    </div>
                </div>
            `;
        }).join('');
    }

    async addToCart(productId) {
        try {
            const response = await fetch(`${this.apiBase}/cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ productId: productId, quantity: 1 })
            });
            if (response.ok) {
                const item = this._items.find((i) => i.id === productId);
                showToast(`${item?.name || 'Item'} added to cart!`, 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                showToast(data.message || 'Unable to add to cart.', 'error');
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            showToast('Unable to add to cart right now.', 'error');
        }
    }

    async addAllToCart() {
        const list = this._getSortedFiltered(this._items).filter(
            (i) => i.status !== 'disabled' && Number(i.stock_quantity ?? 0) > 0
        );
        if (!list.length) { showToast('No available items to add.', 'warning'); return; }

        let successCount = 0;
        for (const item of list) {
            try {
                const response = await fetch(`${this.apiBase}/cart`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ productId: item.id, quantity: 1 })
                });
                if (response.ok) successCount++;
            } catch (_) {}
        }
        showToast(`${successCount} item${successCount !== 1 ? 's' : ''} added to cart.`, successCount > 0 ? 'success' : 'warning');
    }

    async removeFromWishlist(productId) {
        try {
            const response = await fetch(`${this.apiBase}/wishlist/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this._items = this._items.filter((i) => i.id !== productId);
                this.renderWishlist(this._items);
            }
        } catch (error) {
            console.error('Error removing wishlist item:', error);
        }
    }

    async openProduct(productId) {
        try {
            // Use current-active endpoint to get the active product ID
            const response = await fetch(`${this.apiBase}/products/${productId}/current-active`);
            const data = await response.json();

            if (response.ok && data.currentProductId) {
                // Active listing exists - open product details
                if (window.app && typeof window.app.showProductDetails === 'function') {
                    window.app.showProductDetails(data.currentProductId);
                } else {
                    // Fallback: navigate to product page
                    window.location.href = `/product.html?id=${data.currentProductId}`;
                }
            } else {
                // No active listing - show friendly dialog
                this.showUnavailableDialog();
            }
        } catch (error) {
            console.error('Error checking product availability:', error);
            this.showUnavailableDialog();
        }
    }

    showUnavailableDialog() {
        // Create and show a friendly "Product Currently Unavailable" dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        dialog.innerHTML = `
            <div style="background: white; padding: 32px; border-radius: 12px; max-width: 400px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <i class="fas fa-box-open" style="font-size: 3rem; color: #9ca3af; margin-bottom: 16px;"></i>
                <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 1.25rem;">Product Currently Unavailable</h3>
                <p style="margin: 0 0 24px 0; color: #6b7280; line-height: 1.5;">This product is no longer available. The farmer may have harvested it or it may be temporarily out of stock.</p>
                <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="background: #0d6efd; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 0.95rem; font-weight: 500;">Close</button>
            </div>
        `;
        document.body.appendChild(dialog);
    }
}

const wishlistPage = new WishlistPage();
