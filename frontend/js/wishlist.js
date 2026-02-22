// Ensure placeholder image is defined on pages that don't load app.js
window.__PLACEHOLDER_IMAGE__ = window.__PLACEHOLDER_IMAGE__ || '/images/resendlogo.png';

class WishlistPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.init();
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
            window.location.href = '/?login=1';
            return;
        }
        this.loadWishlist();
    }

    async loadWishlist() {
        try {
            const response = await fetch(`${this.apiBase}/wishlist`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.renderWishlist(data.items || []);
            }
        } catch (error) {
            console.error('Error loading wishlist:', error);
        }
    }

    renderWishlist(items) {
        const grid = document.getElementById('wishlist-grid');
        if (!grid) return;

        if (!items.length) {
            grid.innerHTML = '<div class="empty-state">Your wishlist is empty.</div>';
            return;
        }

        grid.innerHTML = items.map(item => `
            <div class="product-card">
                 <img src="${item.image_url || window.__PLACEHOLDER_IMAGE__}"
                     alt="${item.name}" class="product-image" onerror="this.src=window.__PLACEHOLDER_IMAGE__">
                <div class="product-info">
                    <h3 class="product-name">${item.name}</h3>
                    <div class="product-price">${this.fmtCurrency(item.price)} per ${item.unit || ''}</div>
                    <div class="product-details">${item.description ? item.description.substring(0, 100) + '...' : ''}</div>
                    <div class="product-meta">
                        <span>Stock: ${this.fmtNumber(item.stock_quantity ?? 0)}</span>
                    </div>
                    <div class="wishlist-actions">
                        <button class="btn btn-primary btn-small" onclick="wishlistPage.removeFromWishlist(${item.id})">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async removeFromWishlist(productId) {
        try {
            const response = await fetch(`${this.apiBase}/wishlist/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.loadWishlist();
            }
        } catch (error) {
            console.error('Error removing wishlist item:', error);
        }
    }
}

const wishlistPage = new WishlistPage();
