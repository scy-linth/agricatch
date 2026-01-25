class ProductPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.productId = new URLSearchParams(window.location.search).get('id');
        this.init();
    }

    init() {
        if (!this.productId) {
            return;
        }
        this.loadProduct();
        this.loadReviews();
        this.setupReviewForm();
    }

    async loadProduct() {
        try {
            const response = await fetch(`${this.apiBase}/products/${this.productId}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });
            if (response.ok) {
                const data = await response.json();
                this.renderProduct(data.product);
            }
        } catch (error) {
            console.error('Error loading product:', error);
        }
    }

    renderProduct(product) {
        const container = document.getElementById('product-detail');
        if (!container) return;

        container.innerHTML = `
            <div class="product-card">
                <img src="${product.image_url || 'https://via.placeholder.com/600x400?text=No+Image'}"
                     alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
                <div class="product-info">
                    <h2 class="product-name">${product.name}</h2>
                    <div class="product-price">₱${parseFloat(product.price).toFixed(2)} per ${product.unit}</div>
                    <p>${product.description || ''}</p>
                    <div class="product-meta">
                        <div class="seller-line">
                            <span class="seller-name">By ${product.farmer_name || 'Local Farmer'}</span>
                            ${product.farmer_verified ? '<span class="verified-badge" title="Verified seller" aria-label="Verified seller"><i class="fas fa-check-circle"></i></span>' : ''}
                        </div>
                        <div class="seller-location"><i class="fas fa-location-dot"></i> <span class="seller-location-text">Ships from ${product.farm_location || product.location || 'Unknown location'}</span></div>
                        <span>Stock: ${product.stock_quantity}</span>
                        <span>${parseFloat(product.average_rating || 0).toFixed(1)} ★ (${product.total_reviews || 0} reviews)</span>
                        <span class="sales-count">${product.sales_count || 0} sold</span>
                    </div>
                </div>
            </div>
        `;
    }

    async loadReviews() {
        try {
            const response = await fetch(`${this.apiBase}/products/${this.productId}/reviews`);
            if (response.ok) {
                const data = await response.json();
                this.renderReviews(data.reviews || []);
            }
        } catch (error) {
            console.error('Error loading reviews:', error);
        }
    }

    renderReviews(reviews) {
        const list = document.getElementById('reviews-list');
        if (!list) return;

        if (!reviews.length) {
            list.innerHTML = '<div class="empty-state">No reviews yet.</div>';
            return;
        }

        list.innerHTML = reviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <strong>${review.full_name || review.username}</strong>
                    <span>${review.rating} ★</span>
                </div>
                <p>${review.comment || ''}</p>
            </div>
        `).join('');
    }

    setupReviewForm() {
        const form = document.getElementById('review-form');
        if (!form) return;
        form.addEventListener('submit', (e) => this.submitReview(e));
    }

    async submitReview(e) {
        e.preventDefault();
        const rating = parseInt(document.getElementById('review-rating').value, 10);
        const comment = document.getElementById('review-comment').value;

        try {
            const response = await fetch(`${this.apiBase}/products/${this.productId}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                },
                body: JSON.stringify({ rating, comment })
            });
            if (response.ok) {
                document.getElementById('review-rating').value = '';
                document.getElementById('review-comment').value = '';
                this.loadReviews();
            }
        } catch (error) {
            console.error('Error submitting review:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProductPage();
});
