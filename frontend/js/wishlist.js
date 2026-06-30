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
                const isPreorder = item.is_preorder === true || item.listing_type === 'preorder';
                const qty = Number(item.stock_quantity ?? 0);
                const unit = String(item.unit || 'item');

                // Badge — same as landing page
                const preorderBadge = isPreorder
                    ? '<span class="badge harvest-soon-badge mb-2">HARVEST SOON</span>'
                    : '<span class="badge bg-success mb-2">Available Now</span>';

                // Image URL — same logic as app.js
                let productImageUrl = item.image_url || '';
                if (productImageUrl && !productImageUrl.startsWith('http') && !productImageUrl.startsWith('/')) {
                    productImageUrl = '/' + productImageUrl;
                }
                if (!productImageUrl || productImageUrl === 'null' || productImageUrl === 'undefined') {
                    productImageUrl = window.__PLACEHOLDER_IMAGE__;
                }

                // Rating — same as landing page
                const totalReviews = Number(item.total_reviews ?? item.review_count ?? 0);
                const averageRatingValue = Number(item.average_rating || 0);
                const averageRating = this.fmtNumber(averageRatingValue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

                // Ship from — same as landing page
                const shipFrom = item.province
                    ? (item.city ? `${item.city}, ${item.province}` : item.province)
                    : 'your local area';

                // Sold count — same as landing page
                const soldCount = Number(item.sold_qty ?? item.sales_count ?? 0) || 0;

                // Stock display — same as landing page
                const stockDisplay = isPreorder
                    ? (() => {
                        const reserved = Number(item.reserved_quantity ?? 0);
                        const max = Number(item.max_preorder_quantity ?? 0);
                        const remaining = max > 0 ? max - reserved : 'Unlimited';
                        return `<span style="color: #9333ea;">${remaining} ${unit} remaining</span>`;
                    })()
                    : isAvailable
                    ? `<span style="color:#374151;">${qty} ${unit} available</span>`
                    : `<span style="color:#9ca3af;">Out of stock</span>`;

                // Card classes & click — same as landing page, with unavailable override
                const cardClass = isAvailable ? 'product-card' : 'product-card product-card-unavailable';
                const cardClick = isAvailable
                    ? `onclick="wishlistPage.openProduct(${item.id})"`
                    : '';
                const cardStyle = isAvailable ? 'cursor: pointer;' : 'cursor: default; opacity: 0.7;';
                const imgStyle = isAvailable ? '' : 'opacity:0.45;filter:grayscale(1);';

                // Cart button — same logic as landing page
                const cartBtnAttr = isAvailable
                    ? `onclick="event.stopPropagation(); wishlistPage.addToCart(${item.id})"`
                    : 'disabled style="opacity: 0.5; cursor: not-allowed;"';
                const cartBtnText = isAvailable
                    ? (isPreorder ? 'Reserve' : 'Add to Cart')
                    : 'Unavailable';
                const cartBtnTitle = isAvailable ? '' : 'Product unavailable';

                // Unavailable overlay badge
                const unavailableOverlay = !isAvailable
                    ? `<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.7rem;font-weight:600;padding:3px 8px;border-radius:6px;z-index:1;">Unavailable</div>`
                    : '';

                return `
                <div class="${cardClass}" ${cardClick} style="${cardStyle}" data-product-id="${item.id}">
                    <div style="position:relative;">
                        ${unavailableOverlay}
                        <img src="${this.escapeHtml(productImageUrl)}"
                             alt="${this.escapeHtml(item.name)}" class="product-image" onerror="this.src=window.__PLACEHOLDER_IMAGE__" draggable="false" ondragstart="event.preventDefault()" style="${imgStyle}">
                    </div>
                    <div class="product-info">
                        ${preorderBadge}
                        <h3 class="product-name" style="${!isAvailable ? 'color:#9ca3af;' : ''}">${this.escapeHtml(item.name)}</h3>
                        <div class="product-price" style="${!isAvailable ? 'color:#9ca3af;' : ''}">${this.fmtCurrency(item.price)} per ${this.escapeHtml(unit)}</div>
                        ${priceDropBadge ? `<div style="margin:4px 0;">${priceDropBadge}</div>` : ''}
                        <div class="product-meta product-card-summary">
                            <div class="product-stock" aria-label="${isPreorder ? 'Preorder capacity' : 'Stock available'}">
                                ${stockDisplay}
                            </div>
                            <div class="product-rating-wrap" aria-hidden="false">
                                <div class="product-rating-text" aria-label="${totalReviews} reviews, average ${averageRating} out of 5">
                                    <i class="fas fa-star product-rating-icon" aria-hidden="true"></i>
                                    <span class="product-rating-value">${averageRating}</span>
                                </div>
                            </div>
                            <div class="product-ship-from" aria-label="Shipping origin">
                                Ships from ${this.escapeHtml(shipFrom)}
                            </div>
                            <div class="product-sold-left">
                                <span class="sold-count">Sold ${this.fmtNumber(soldCount)}</span>
                            </div>
                        </div>
                        <div class="product-actions" style="display:flex;gap:8px;align-items:center;">
                            <button type="button" class="add-to-cart-btn ${isPreorder && isAvailable ? 'btn-warning' : ''}"
                                ${cartBtnAttr}
                                ${!isAvailable ? 'disabled' : ''}
                                title="${cartBtnTitle}">
                                ${cartBtnText}
                            </button>
                            <button type="button" class="wishlist-toggle-btn"
                                onclick="event.stopPropagation(); wishlistPage.removeFromWishlist(${item.id})"
                                title="Remove from wishlist"
                                aria-label="Remove from wishlist"
                                style="background:none;border:none;padding:8px;cursor:pointer;color:#ef4444;transition:color 0.2s;">
                                <i class="fas fa-heart" style="font-size:1.2rem;" aria-hidden="true"></i>
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
