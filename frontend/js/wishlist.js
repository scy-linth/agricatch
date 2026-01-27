class WishlistPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.init();
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
<<<<<<< HEAD
                 <img src="${item.image_url || window.__PLACEHOLDER_IMAGE__}"
                     alt="${item.name}" class="product-image" onerror="this.src=window.__PLACEHOLDER_IMAGE__">
=======
                <img src="${item.image_url || 'https://via.placeholder.com/280x200?text=No+Image'}"
                     alt="${item.name}" class="product-image" onerror="this.src='https://via.placeholder.com/280x200?text=No+Image'">
>>>>>>> f2c98e8770f5bb361ad93161b06facf0f4a2fcff
                <div class="product-info">
                    <h3 class="product-name">${item.name}</h3>
                    <div class="product-price">₱${parseFloat(item.price).toFixed(2)} per ${item.unit || ''}</div>
                    <div class="product-details">${item.description ? item.description.substring(0, 100) + '...' : ''}</div>
                    <div class="product-meta">
                        <span>Stock: ${item.stock_quantity}</span>
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
