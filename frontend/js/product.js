class ProductPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.productId = new URLSearchParams(window.location.search).get('id');
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

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    init() {
        if (!this.productId) {
            return;
        }
        this.loadProduct();
        this.loadSimilarSellers();
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

        // Prefer full image URL (Cloudinary). If missing, render an empty image element
        // so the layout doesn't break. Avoid loading heavy placeholder images.
        const imgSrc = product.image_url && product.image_url.trim() !== '' ? product.image_url : '';
        const safeName = this.escapeHtml(product.name || '');
        const safeDesc = this.escapeHtml(product.description || '');
        const safeFarmer = this.escapeHtml(product.farmer_name || 'Local Farmer');
        const safeUnit = this.escapeHtml(product.unit || 'unit');
        const safeLocation = this.escapeHtml(product.farm_location || product.location || 'Unknown location');
        const productRating = this.fmtNumber(product.average_rating || product.avg_rating || product.rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const shopRating = this.fmtNumber(product.farmer_average_rating || product.farmer_avg_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        container.innerHTML = `
            <div class="product-card">
                <img src="${imgSrc}"
                     alt="${safeName}" class="product-image">
                <div class="product-info">
                    <h2 class="product-name">${safeName}</h2>
                    <div class="product-price">${this.fmtCurrency(product.price)} per ${safeUnit}</div>
                    <p>${safeDesc}</p>
                    <div class="product-meta">
                        <div class="seller-line">
                            <span class="seller-name">By ${safeFarmer}</span>
                            ${product.farmer_verified ? '<span class="verified-badge" title="Verified seller" aria-label="Verified seller"><i class="fas fa-check-circle"></i></span>' : ''}
                        </div>
                        <div class="seller-location"><i class="fas fa-location-dot"></i> <span class="seller-location-text">Ships from ${safeLocation}</span></div>
                        <span>Stock: ${this.fmtNumber(product.stock_quantity ?? 0)}</span>
                        <span>
                            ${productRating}
                                <i class="fas fa-star rating-icon" aria-hidden="true"></i>
                                (${this.fmtNumber(product.total_reviews || product.reviews_count || product.review_count || (product.reviews && product.reviews.length) || 0)} reviews)
                        </span>
                        <span>
                            Shop: ${shopRating}
                            <i class="fas fa-star rating-icon" aria-hidden="true"></i>
                            (${this.fmtNumber(product.farmer_total_reviews || 0)} reviews)
                        </span>
                        <span class="sales-count">${this.fmtNumber(product.sales_count || 0)} sold</span>
                    </div>
                </div>
            </div>
        `;
    }

    async loadSimilarSellers() {
        const list = document.getElementById('similar-sellers-list');
        if (!list || !this.productId) return;

        try {
            list.innerHTML = '<div class="empty-state">Loading similar offers...</div>';
            const response = await fetch(`${this.apiBase}/products/${this.productId}/similar-sellers`);
            if (!response.ok) throw new Error('Failed to load similar sellers');

            const data = await response.json();
            const similar = Array.isArray(data.similar) ? data.similar : [];
            if (!similar.length) {
                list.innerHTML = '<div class="empty-state">No similar sellers found yet.</div>';
                return;
            }

            list.innerHTML = similar.map((item) => `
                <div class="review-card">
                    <div class="review-header">
                        <strong>${this.escapeHtml(item.farmer_name || 'Farmer Shop')}</strong>
                        <span>${this.fmtCurrency(item.price)} / ${this.escapeHtml(item.unit || 'item')}</span>
                    </div>
                    <p>
                        Sold: ${this.fmtNumber(item.sales_count || 0)}
                        • Product ${this.fmtNumber(item.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        <i class="fas fa-star rating-icon" aria-hidden="true"></i>
                        • Shop ${this.fmtNumber(item.farmer_average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        <i class="fas fa-star rating-icon" aria-hidden="true"></i>
                    </p>
                    <p>${this.escapeHtml((item.badges || []).join(' • '))}</p>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading similar sellers:', error);
            list.innerHTML = '<div class="empty-state">Unable to load similar offers right now.</div>';
        }
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
                    <strong>${this.escapeHtml(review.full_name || review.username)}</strong>
                    <span>
                        ${this.fmtNumber(review.rating)}
                        <i class="fas fa-star rating-icon" aria-hidden="true"></i>
                    </span>
                </div>
                <p>${this.escapeHtml(review.comment || '')}</p>
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
