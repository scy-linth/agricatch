class FarmersPage {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.farmers = [];
        this.selectedFarmerId = null;
        this.init();
    }

    init() {
        try {
            this.selectedFarmerId = Number(sessionStorage.getItem('selectedFarmerId') || 0) || null;
        } catch (_) {
            this.selectedFarmerId = null;
        }
        this.loadFarmers();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('farmer-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                this.renderFarmers(this.filterFarmers(term));
            });
        }
    }

    async loadFarmers() {
        try {
            const response = await fetch(`${this.apiBase}/farmers`);
            if (response.ok) {
                const data = await response.json();
                this.farmers = data.farmers || [];
                this.renderFarmers(this.farmers);
            }
        } catch (error) {
            console.error('Error loading farmers:', error);
        }
    }

    filterFarmers(term) {
        if (!term) return this.farmers;
        return this.farmers.filter((farmer) => {
            const name = (farmer.full_name || farmer.username || '').toLowerCase();
            const location = (farmer.location || '').toLowerCase();
            return name.includes(term) || location.includes(term);
        });
    }

    renderFarmers(farmers) {
        const grid = document.getElementById('farmers-grid');
        if (!grid) return;

        if (!farmers.length) {
            grid.innerHTML = '<p class="empty-state">No farmers found.</p>';
            return;
        }

        grid.innerHTML = farmers.map((farmer) => `
            <div class="farmer-card ${Number(farmer.id) === Number(this.selectedFarmerId) ? 'selected' : ''}" id="farmer-card-${farmer.id}">
                <div class="farmer-card-header">
                    <div class="farmer-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="farmer-info">
                        <h3>${farmer.full_name || farmer.username}</h3>
                        <p class="farmer-location"><i class="fas fa-location-dot"></i> ${farmer.location || 'Unknown location'}</p>
                    </div>
                </div>
                <div class="farmer-card-body">
                    <div class="farmer-stats">
                        <span><strong>${farmer.product_count || 0}</strong> products</span>
                        <span>${new Date(farmer.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                </div>
                <div class="farmer-card-footer">
                    <a class="btn btn-primary btn-small" href="/#products" data-farmer-id="${farmer.id}">View Shop</a>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('[data-farmer-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const farmerId = button.getAttribute('data-farmer-id');
                sessionStorage.setItem('selectedFarmerId', farmerId);
            });
        });

        if (this.selectedFarmerId) {
            const selectedCard = document.getElementById(`farmer-card-${this.selectedFarmerId}`);
            if (selectedCard) {
                setTimeout(() => {
                    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 120);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FarmersPage();
});
