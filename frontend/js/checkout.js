// Checkout Page Logic
class CheckoutPage {
    constructor() {
        const hostname = String(window.location.hostname || '').toLowerCase();
        this.apiBase = (hostname === 'localhost' || hostname === '127.0.0.1')
            ? 'http://localhost:3000/api'
            : 'https://agricatch.onrender.com/api';
        this.token = localStorage.getItem('token');
        this.sessionId = localStorage.getItem('sessionId');
        this.deliveryFee = 35;
        this.useDefaultDeliveryAddress = true;
        this.selectedAddress = null;
        this.checkoutStorageKey = this.getCheckoutStorageKey();
    }

    getCheckoutStorageKey() {
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const userId = payload.user_id || payload.id || payload.sub;
            return userId ? `checkout_draft_${userId}` : null;
        } catch (error) {
            console.error('Error getting user ID from token:', error);
            return null;
        }
    }

    init() {
        // Check if user is logged in
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }

        // Clear any stale cart data
        this.clearStaleCartData();

        // Initialize user profile in topbar
        this.initUserProfile();

        // Load delivery address setting
        this.loadDeliveryAddressSetting();

        // Load cart and render checkout
        this.loadCheckout();

        // Setup event listeners
        this.setupEventListeners();

        // Setup visibility change listener to refresh cart when tab becomes visible
        this.setupVisibilityListener();
    }

    async fetchProductStock(productId) {
        if (!productId) return null;
        try {
            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });
            if (!response.ok) return null;
            const data = await response.json();
            const product = data.product || data;
            const isPreorder = product.is_preorder === true;
            if (isPreorder) {
                const reserved = Number(product.reserved_quantity ?? 0);
                const max = Number(product.max_preorder_quantity ?? 0);
                return { stock: max > 0 ? max - reserved : null, isPreorder: true };
            }
            return { stock: Number(product?.stock_quantity || 0), isPreorder: false };
        } catch (_) {
            return null;
        }
    }

    clearStaleCartData() {
        // Clear any cached cart data from localStorage
        localStorage.removeItem('cachedCart');
        localStorage.removeItem('cachedCartTimestamp');
    }

    setupVisibilityListener() {
        // Refresh cart when tab becomes visible (user switches back to it)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Refresh cart and check for changes
                this.loadCheckout(true);
            }
        });
    }

    detectCartChanges(oldData, newData) {
        const changes = [];
        
        // Create a map of old items by ID for easy lookup
        const oldItemsMap = new Map(oldData.cartItems.map(item => [item.id, item]));
        
        // Check each new item for changes
        newData.cartItems.forEach(newItem => {
            const oldItem = oldItemsMap.get(newItem.id);
            
            if (!oldItem) {
                // New item added
                changes.push({
                    type: 'added',
                    itemName: newItem.name,
                    message: `${newItem.name} was added to your cart`
                });
            } else {
                // Check for price change
                if (parseFloat(oldItem.price) !== parseFloat(newItem.price)) {
                    changes.push({
                        type: 'price',
                        itemName: newItem.name,
                        oldPrice: oldItem.price,
                        newPrice: newItem.price,
                        message: `${newItem.name} price changed from ₱${oldItem.price} to ₱${newItem.price}`
                    });
                }
                
                // Check for stock change
                if (oldItem.stock_quantity !== newItem.stock_quantity) {
                    changes.push({
                        type: 'stock',
                        itemName: newItem.name,
                        oldStock: oldItem.stock_quantity,
                        newStock: newItem.stock_quantity,
                        message: `${newItem.name} stock changed from ${oldItem.stock_quantity} to ${newItem.stock_quantity}`
                    });
                }
                
                // Check for availability change
                if (oldItem.is_available_for_checkout !== newItem.is_available_for_checkout) {
                    changes.push({
                        type: 'availability',
                        itemName: newItem.name,
                        message: `${newItem.name} availability changed`
                    });
                }
            }
        });
        
        // Check for removed items
        const newItemsMap = new Map(newData.cartItems.map(item => [item.id, item]));
        oldData.cartItems.forEach(oldItem => {
            if (!newItemsMap.has(oldItem.id)) {
                changes.push({
                    type: 'removed',
                    itemName: oldItem.name,
                    message: `${oldItem.name} was removed from your cart`
                });
            }
        });
        
        return changes;
    }

    showCartChangesWarning(changes) {
        const changeMessages = changes.map(c => c.message).join('\n');
        this.showMessage(`Cart updated:\n${changeMessages}`, 'info');
    }

    showGuestLoginPrompt() {
        showToast('Please log in to proceed to checkout', 'info');
        
        // Store return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        
        // Redirect to home with login prompt
        setTimeout(() => {
            window.location.href = `/?login=1&returnUrl=${returnUrl}`;
        }, 1500);
    }

    async loadDeliveryAddressSetting() {
        try {
            const response = await fetch(`${this.apiBase}/settings`);
            if (response.ok) {
                const data = await response.json();
                this.useDefaultDeliveryAddress = data.use_default_delivery_address !== false;
                this.updateAddressDisplay();
            }
        } catch (error) {
            console.error('Error loading delivery address setting:', error);
            // Default to true on error
            this.useDefaultDeliveryAddress = true;
            this.updateAddressDisplay();
        }
    }

    updateAddressDisplay() {
        const addressSection = document.querySelector('.co-card-header i.fa-truck')?.closest('.co-card');
        if (!addressSection) {
            return;
        }

        const addressNotice = addressSection.querySelector('.co-address-notice');
        const addressContent = addressSection.querySelector('.co-address-content');
        const setAddressBtn = document.getElementById('set-address-btn');
        
        if (!addressNotice) {
            return;
        }

        if (this.useDefaultDeliveryAddress) {
            // Show static Trabajo Market address (not changeable)
            if (addressContent) {
                addressContent.innerHTML = `
                    <i class="fas fa-map-marker-alt"></i>
                    <div>
                        <strong>Trabajo Market</strong>
                        <span class="d-block">M. Dela Fuente St., Sampaloc, Manila, Metro Manila</span>
                    </div>
                `;
            }
            if (setAddressBtn) setAddressBtn.style.display = 'none';
        } else {
            // Show custom address preview or prompt to set address
            if (this.selectedAddress) {
                if (addressContent) {
                    addressContent.innerHTML = `
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <strong>Delivery Address</strong>
                            <span class="d-block">${this.selectedAddress}</span>
                        </div>
                    `;
                }
            } else {
                if (addressContent) {
                    addressContent.innerHTML = `
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <strong>Delivery Address</strong>
                            <span class="d-block">Set your delivery address</span>
                        </div>
                    `;
                }
            }
            if (setAddressBtn) {
                setAddressBtn.style.display = 'flex';
            } else {
                console.error('Set Address button element not found!');
            }
        }
    }

    openAddressModal() {
        // Open the address modal
        const addressModal = document.getElementById('add-address-modal');
        if (addressModal) {
            addressModal.classList.add('open');
            this.setupAddressModalHandlers();
        } else {
            this.showMessage('Address modal not found. Please add address from your account.', 'warning');
        }
    }

    setupAddressModalHandlers() {
        // Close button
        const closeBtn = document.getElementById('close-add-address-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.getElementById('add-address-modal').classList.remove('open');
            };
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-add-address');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.getElementById('add-address-modal').classList.remove('open');
            };
        }

        // Setup PSGC dropdowns
        this.setupPsgcDropdowns();

        // Form submission
        const form = document.getElementById('add-address-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.saveAddress();
            };
        }
    }

    setupPsgcDropdowns() {
        if (!window.PSGC) {
            console.error('PSGC library not loaded');
            return;
        }

        const zoneEl = document.getElementById('floating-address-zone');
        const provinceEl = document.getElementById('floating-address-province');
        const cityEl = document.getElementById('floating-address-city');
        const barangayEl = document.getElementById('floating-address-barangay');
        const streetEl = document.getElementById('floating-address-street');
        const fullAddressEl = document.getElementById('floating-address-full');

        // Load zones
        if (zoneEl) {
            window.PSGC.loadZones(zoneEl);
            
            zoneEl.addEventListener('change', async () => {
                const zone = zoneEl.value;
                await window.PSGC.onZoneChange(zone, { provinceEl, cityEl, barangayEl });
                this.updateAddressPreview();
            });
        }

        // Province change
        if (provinceEl) {
            provinceEl.addEventListener('change', async () => {
                const province = provinceEl.value;
                await window.PSGC.onProvinceChange(province, { cityEl, barangayEl });
                this.updateAddressPreview();
            });
        }

        // City change
        if (cityEl) {
            cityEl.addEventListener('change', async () => {
                const city = cityEl.value;
                await window.PSGC.loadBarangays(city, barangayEl);
                this.updateAddressPreview();
            });
        }

        // Barangay or street change
        if (barangayEl) {
            barangayEl.addEventListener('change', () => this.updateAddressPreview());
        }
        if (streetEl) {
            streetEl.addEventListener('input', () => this.updateAddressPreview());
        }
    }

    updateAddressPreview() {
        const street = document.getElementById('floating-address-street')?.value || '';
        const barangay = document.getElementById('floating-address-barangay')?.value || '';
        const city = document.getElementById('floating-address-city')?.value || '';
        const province = document.getElementById('floating-address-province')?.value || '';
        const fullAddressEl = document.getElementById('floating-address-full');

        if (fullAddressEl) {
            const formatted = window.PSGC ? window.PSGC.formatAddress({ street, barangay, city, province }) : [street, barangay, city, province].filter(Boolean).join(', ');
            fullAddressEl.value = formatted;
        }
    }

    async saveAddress() {
        const form = document.getElementById('add-address-form');
        const street = document.getElementById('floating-address-street').value.trim();
        const barangay = document.getElementById('floating-address-barangay').value;
        const city = document.getElementById('floating-address-city').value;
        const province = document.getElementById('floating-address-province').value;

        // Validate required fields
        if (!street || !barangay || !city || !province) {
            this.showMessage('Please complete all address fields', 'error');
            return;
        }

        // Format the full address
        const fullAddress = window.PSGC ? window.PSGC.formatAddress({ street, barangay, city, province }) : [street, barangay, city, province].filter(Boolean).join(', ');

        // Set the selected address for checkout
        this.selectedAddress = fullAddress;

        // Auto-save the address
        this.saveDraftCheckoutInfo();

        // Update the display
        this.updateAddressDisplay();

        // Close the modal
        document.getElementById('add-address-modal').classList.remove('open');
        form.reset();

        this.showMessage('Delivery address set successfully!', 'success');
    }

    loadSavedCheckoutInfo() {
        if (!this.checkoutStorageKey) return;

        try {
            const savedData = localStorage.getItem(this.checkoutStorageKey);
            if (!savedData) return;

            const checkoutInfo = JSON.parse(savedData);

            // Auto-fill personal info
            if (checkoutInfo.firstname) {
                const firstnameEl = document.getElementById('checkout-firstname');
                if (firstnameEl) firstnameEl.value = checkoutInfo.firstname;
            }
            if (checkoutInfo.middlename) {
                const middlenameEl = document.getElementById('checkout-middlename');
                if (middlenameEl) middlenameEl.value = checkoutInfo.middlename;
            }
            if (checkoutInfo.lastname) {
                const lastnameEl = document.getElementById('checkout-lastname');
                if (lastnameEl) lastnameEl.value = checkoutInfo.lastname;
            }
            if (checkoutInfo.phone) {
                const phoneEl = document.getElementById('checkout-phone');
                if (phoneEl) phoneEl.value = checkoutInfo.phone;
            }
            if (checkoutInfo.specialInstructions) {
                const specialEl = document.getElementById('special-instructions');
                if (specialEl) specialEl.value = checkoutInfo.specialInstructions;
            }

            // Auto-fill address if custom address is enabled
            if (!this.useDefaultDeliveryAddress && checkoutInfo.address) {
                this.selectedAddress = checkoutInfo.address;
                this.updateAddressDisplay();
            }
        } catch (error) {
            console.error('Error loading saved checkout info:', error);
        }
    }

    autoFillCheckoutForm() {
        const lastCheckoutInfo = this.getLastCheckoutInfo();
        if (!lastCheckoutInfo) return;

        // Auto-fill personal info (always)
        if (lastCheckoutInfo.firstname) {
            const firstnameEl = document.getElementById('checkout-firstname');
            if (firstnameEl) firstnameEl.value = lastCheckoutInfo.firstname;
        }
        if (lastCheckoutInfo.middlename) {
            const middlenameEl = document.getElementById('checkout-middlename');
            if (middlenameEl) middlenameEl.value = lastCheckoutInfo.middlename;
        }
        if (lastCheckoutInfo.lastname) {
            const lastnameEl = document.getElementById('checkout-lastname');
            if (lastnameEl) lastnameEl.value = lastCheckoutInfo.lastname;
        }
        if (lastCheckoutInfo.phone) {
            const phoneEl = document.getElementById('checkout-phone');
            if (phoneEl) phoneEl.value = lastCheckoutInfo.phone;
        }

        // Auto-fill address only when default address is OFF
        if (!this.useDefaultDeliveryAddress && lastCheckoutInfo.address) {
            // Only fill if it's not Trabajo Market
            if (!this.isTrabajoMarketAddress(lastCheckoutInfo.address)) {
                const streetEl = document.getElementById('checkout-street');
                const barangayEl = document.getElementById('checkout-barangay');
                const cityEl = document.getElementById('checkout-city');
                const provinceEl = document.getElementById('checkout-province');

                if (streetEl) streetEl.value = lastCheckoutInfo.address.street || '';
                if (barangayEl) barangayEl.value = lastCheckoutInfo.address.barangay || '';
                if (cityEl) cityEl.value = lastCheckoutInfo.address.city || '';
                if (provinceEl) provinceEl.value = lastCheckoutInfo.address.province || '';
            }
        }
    }

    getLastCheckoutInfo() {
        try {
            const info = localStorage.getItem('lastCheckoutInfo');
            return info ? JSON.parse(info) : null;
        } catch (error) {
            console.error('Error getting last checkout info:', error);
            return null;
        }
    }

    saveDraftCheckoutInfo() {
        if (!this.checkoutStorageKey) return;

        const firstname = document.getElementById('checkout-firstname')?.value?.trim() || '';
        const middlename = document.getElementById('checkout-middlename')?.value?.trim() || '';
        const lastname = document.getElementById('checkout-lastname')?.value?.trim() || '';
        const phone = document.getElementById('checkout-phone')?.value?.trim() || '';
        const specialInstructions = document.getElementById('special-instructions')?.value?.trim() || '';

        const checkoutInfo = {
            firstname,
            middlename,
            lastname,
            phone,
            specialInstructions,
            address: this.selectedAddress,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(this.checkoutStorageKey, JSON.stringify(checkoutInfo));
        } catch (error) {
            console.error('Error saving draft checkout info:', error);
        }
    }

    clearDraftCheckoutInfo() {
        if (!this.checkoutStorageKey) return;
        try {
            localStorage.removeItem(this.checkoutStorageKey);
        } catch (error) {
            console.error('Error clearing draft checkout info:', error);
        }
    }

    saveCheckoutInfo() {
        const firstname = document.getElementById('checkout-firstname')?.value?.trim() || '';
        const middlename = document.getElementById('checkout-middlename')?.value?.trim() || '';
        const lastname = document.getElementById('checkout-lastname')?.value?.trim() || '';
        const phone = document.getElementById('checkout-phone')?.value?.trim() || '';

        let address = null;
        if (!this.useDefaultDeliveryAddress) {
            const street = document.getElementById('checkout-street')?.value?.trim() || '';
            const barangay = document.getElementById('checkout-barangay')?.value?.trim() || '';
            const city = document.getElementById('checkout-city')?.value?.trim() || '';
            const province = document.getElementById('checkout-province')?.value?.trim() || '';

            // Only save address if it's not Trabajo Market
            if (street || barangay || city || province) {
                const addressObj = { street, barangay, city, province };
                if (!this.isTrabajoMarketAddress(addressObj)) {
                    address = addressObj;
                }
            }
        }

        const checkoutInfo = {
            firstname,
            middlename,
            lastname,
            phone,
            address,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem('lastCheckoutInfo', JSON.stringify(checkoutInfo));
        } catch (error) {
            console.error('Error saving checkout info:', error);
        }
    }

    isTrabajoMarketAddress(address) {
        if (!address) return false;
        // More specific detection - must include Trabajo Market or M. Dela Fuente
        const trabajoKeywords = ['trabajo market', 'm. dela fuente'];
        const addressStr = `${address.street || ''} ${address.barangay || ''} ${address.city || ''} ${address.province || ''}`.toLowerCase();
        return trabajoKeywords.some(keyword => addressStr.includes(keyword));
    }

    initUserProfile() {
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const name = payload.full_name || payload.username || '';
            const topbarName = document.getElementById('topbar-user-name');
            if (topbarName && name) topbarName.textContent = name;
        } catch (_) {}
    }

    async loadCheckout(checkForChanges = false) {
        const loadingEl = document.getElementById('checkout-loading');
        const formEl = document.getElementById('checkout-form');
        // Refresh token from localStorage in case user logged out in another tab
        this.token = localStorage.getItem('token');
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }
        try {
            // Add cache-busting timestamp to ensure fresh data
            const response = await fetch(`${this.apiBase}/cart?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();

                // Filter cart items to only include selected products
                const selectedCartItemsStr = localStorage.getItem('selectedCartItems');
                if (selectedCartItemsStr) {
                    try {
                        const selectedCartIds = JSON.parse(selectedCartItemsStr);
                        data.cartItems = data.cartItems.filter(item => selectedCartIds.includes(item.id));
                        // Store selected IDs for later use (order placement, cart deletion)
                        this.selectedCartIds = selectedCartIds;
                    } catch (error) {
                        console.error('Error parsing selected cart items:', error);
                    }
                }

                if (data.cartItems.length === 0) {
                    this.showMessage('No products selected for checkout', 'error');
                    setTimeout(() => { window.location.href = '/index.html#products'; }, 2000);
                    return;
                }

                if (data.summary?.has_unavailable_items) {
                    this.showMessage('Your cart has unavailable items. Please remove them before checkout.', 'error');
                    setTimeout(() => { window.location.href = '/index.html#products'; }, 2000);
                    return;
                }

                // Check for changes if this is a refresh
                if (checkForChanges && this.currentCartData) {
                    const changes = this.detectCartChanges(this.currentCartData, data);
                    if (changes.length > 0) {
                        this.showCartChangesWarning(changes);
                    }
                }

                // Store current cart data for comparison
                this.currentCartData = data;

                this.renderCheckout(data);
                if (loadingEl) loadingEl.style.display = 'none';
                if (formEl) formEl.style.display = '';

                // Load saved draft checkout info first
                this.loadSavedCheckoutInfo();

                // Auto-fill form with last used checkout info (fallback)
                this.autoFillCheckoutForm();
            } else {
                this.showMessage('Error loading cart', 'error');
            }
        } catch (error) {
            console.error('Error loading checkout:', error);
            this.showMessage('Error loading checkout', 'error');
        }
    }

    renderCheckout(data) {
        const checkoutItems = document.getElementById('checkout-items-list');
        const checkoutSubtotal = document.getElementById('checkout-subtotal');
        const checkoutTotalFooter = document.getElementById('checkout-total-footer');
        const checkoutTotalDisplay = document.getElementById('checkout-total-display');

        if (!checkoutItems) return;

        checkoutItems.innerHTML = data.cartItems.map(item => {
            const itemTotal = parseFloat(item.price) * item.quantity;
            const imageUrl = item.image_url || '/images/logo.png';
            const isUnavailable = item.is_available_for_checkout === false;
            const isPreorder = item.is_preorder === true;
            const disabledAttr = isUnavailable ? 'disabled' : '';
            let maxStock;
            if (isPreorder) {
                const reserved = Number(item.reserved_quantity ?? 0);
                const max = Number(item.max_preorder_quantity ?? 0);
                maxStock = max > 0 ? max - reserved : 0;
            } else {
                maxStock = Number(item.stock_quantity) || 0;
            }
            const minimumOrderQuantity = Number.parseInt(item.minimum_order_quantity, 10);
            const moq = Number.isInteger(minimumOrderQuantity) && minimumOrderQuantity > 0 ? minimumOrderQuantity : 1;
            maxStock = Math.max(moq, maxStock);
            const badge = isUnavailable
                ? `<span class="status-pill pending ms-1">Unavailable</span>`
                : '';
            const stockDisplay = isPreorder
                ? (() => {
                    const reserved = Number(item.reserved_quantity ?? 0);
                    const max = Number(item.max_preorder_quantity ?? 0);
                    const remaining = max > 0 ? max - reserved : 0;
                    return `Reservation: ${this.fmtNumber(remaining)} ${item.unit || 'unit'} remaining`;
                })()
                : `Stocks: ${this.fmtNumber(item.stock_quantity ?? 0)}`;
            const moqDisplay = moq > 1 ? `<div class="co-item-meta co-item-moq" style="font-size:0.75rem;color:#6b7280;">Min. order: ${moq} ${item.unit || 'unit'}</div>` : '';
            const minusDisabled = item.quantity <= moq || isUnavailable;
            return `
            <div class="co-item" data-product-id="${item.product_id}">
                <img src="${imageUrl}" alt="${item.name}" onerror="this.src='/images/logo.png'">
                <div class="co-item-info">
                    <div class="co-item-name">${item.name} ${badge}</div>
                    <div class="co-item-meta">${this.fmtCurrency(item.price)} per ${item.unit || 'item'}</div>
                    ${item.farmer_name ? `<div class="co-item-meta co-item-farmer">From ${item.farmer_name}</div>` : ''}
                    <div class="co-item-meta co-item-stock">${stockDisplay}</div>
                    ${moqDisplay}
                    <div class="co-qty">
                        <button type="button" class="co-qty-btn" onclick="checkoutPage.handleCheckoutQuantityButton(${item.id}, -1, ${maxStock}, ${moq})" ${minusDisabled ? 'disabled' : ''}><i class="fas fa-minus"></i></button>
                        <input type="number" class="co-qty-input" value="${item.quantity}" min="${moq}" max="${maxStock}" inputmode="numeric"
                            onchange="checkoutPage.handleCheckoutQuantityInput(${item.id}, this.value, ${maxStock}, ${moq}, this)"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" ${disabledAttr}>
                        <button type="button" class="co-qty-btn" onclick="checkoutPage.handleCheckoutQuantityButton(${item.id}, 1, ${maxStock}, ${moq})" ${disabledAttr}><i class="fas fa-plus"></i></button>
                        <button type="button" class="co-remove-btn-qty" onclick="checkoutPage.removeCheckoutItem(${item.id})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="co-item-side">
                    <span class="co-item-total">${this.fmtCurrency(itemTotal)}</span>
                </div>
            </div>
        `;
        }).join('');

        // Recalculate subtotal based on filtered cart items
        const subtotal = data.cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);
        
        // Calculate delivery fee based on unique farmers in filtered cart items
        const uniqueFarmers = new Set(data.cartItems.map(item => item.farmer_name));
        const globalDeliveryFee = 35; // Global delivery fee per farmer
        const deliveryFee = uniqueFarmers.size * globalDeliveryFee;
        
        const grandTotal = subtotal + (deliveryFee > 0 ? deliveryFee : 0);

        if (checkoutSubtotal) {
            checkoutSubtotal.textContent = this.fmtNumber(subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (checkoutTotalFooter) {
            checkoutTotalFooter.textContent = this.fmtNumber(grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (checkoutTotalDisplay) {
            checkoutTotalDisplay.textContent = this.fmtNumber(grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Conditionally show/hide delivery fee
        const checkoutDeliveryFeeRow = document.getElementById('checkout-delivery-fee-row');
        const checkoutDeliveryFee = document.getElementById('checkout-delivery-fee');
        if (checkoutDeliveryFeeRow && checkoutDeliveryFee) {
            if (deliveryFee > 0) {
                checkoutDeliveryFeeRow.style.display = 'flex';
                checkoutDeliveryFee.textContent = this.fmtNumber(deliveryFee, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else {
                checkoutDeliveryFeeRow.style.display = 'none';
            }
        }
    }

    // Delivery date is now set by farmer only - removed customer delivery date input

    setupEventListeners() {
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => this.handleCheckoutSubmit(e));
        }

        const shopMoreBtn = document.getElementById('shop-more-btn');
        if (shopMoreBtn) {
            shopMoreBtn.addEventListener('click', () => {
                window.location.href = '/index.html#products';
            });
        }

        // Set Address button for custom delivery address - handled via inline onclick in HTML

        // Auto-save delivery information on input
        const deliveryFields = ['checkout-firstname', 'checkout-middlename', 'checkout-lastname', 'checkout-phone', 'special-instructions'];
        deliveryFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    this.saveDraftCheckoutInfo();
                });
            }
        });

        // Format phone input with spaces (9XX XXX XXXX)
        const checkoutPhone = document.getElementById('checkout-phone');
        if (checkoutPhone) {
            checkoutPhone.addEventListener('input', () => {
                // Remove non-digits
                let digits = checkoutPhone.value.replace(/\D/g, '');
                // Limit to 10 digits
                if (digits.length > 10) digits = digits.slice(0, 10);
                // Format as 9XX XXX XXXX
                if (digits.length > 0) {
                    let formatted = digits[0];
                    if (digits.length > 1) formatted += digits.slice(1, 3);
                    if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
                    if (digits.length > 6) formatted += ' ' + digits.slice(6, 10);
                    checkoutPhone.value = formatted;
                } else {
                    checkoutPhone.value = '';
                }
            });
        }
    }

    async handleCheckoutSubmit(e) {
        e.preventDefault();

        // Refresh token from localStorage in case user logged out in another tab
        this.token = localStorage.getItem('token');
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }

        const firstname = document.getElementById('checkout-firstname').value.trim();
        const middlename = document.getElementById('checkout-middlename').value.trim();
        const lastname = document.getElementById('checkout-lastname').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const specialInstructions = document.getElementById('special-instructions').value.trim();

        const phoneDigits = phone.replace(/\s/g, '');
        if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
            this.showMessage('Phone must be 10 digits starting with 9 (e.g. 912 345 6789)', 'error');
            return;
        }

        if (firstname.length > 40 || lastname.length > 40 || middlename.length > 40) {
            this.showMessage('Name fields must be 40 characters or less', 'error');
            return;
        }

        // Validate address if not using default
        if (!this.useDefaultDeliveryAddress && !this.selectedAddress) {
            this.showMessage('Please select a delivery address', 'error');
            return;
        }

        const deliveryAddress = this.useDefaultDeliveryAddress
            ? 'Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila'
            : this.selectedAddress;

        // Delivery date is now set by farmer only - always send null
        const deliveryDate = null;

        // Check if cart has any pre-order items
        const hasPreorder = this.currentCartData && this.currentCartData.cartItems && 
                           this.currentCartData.cartItems.some(item => item.is_preorder === true);

        const submitBtn = document.getElementById('place-order-btn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Placing…'; }

        try {
            const response = await fetch(`${this.apiBase}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    recipient_firstname: firstname,
                    recipient_middlename: middlename || null,
                    recipient_lastname: lastname,
                    recipient_phone: phone,
                    special_instructions: specialInstructions || null,
                    delivery_address: deliveryAddress,
                    delivery_date: deliveryDate,
                    cart_item_ids: this.selectedCartIds
                })
            });

            if (response.ok) {
                // Save checkout info for next time
                this.saveCheckoutInfo();

                // Clear draft checkout info after successful order
                this.clearDraftCheckoutInfo();

                // Clear selected cart items after successful order
                localStorage.removeItem('selectedCartItems');

                const successMessage = 'Order placed successfully! Redirecting…';
                this.showMessage(successMessage, 'success');
                setTimeout(() => { window.location.href = '/orders.html'; }, 1500);
            } else {
                const errorData = await response.json();
                const errorMessage = errorData.message || 'Failed to place order';
                this.showMessage(errorMessage, 'error');
                const btnText = '<i class="bi bi-bag-check-fill"></i> Place Order';
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = btnText; }
            }
        } catch (error) {
            console.error('Error placing order:', error);
            const errorMessage = 'Error placing order';
            this.showMessage(errorMessage, 'error');
            const btnText = '<i class="bi bi-bag-check-fill"></i> Place Order';
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = btnText; }
        }
    }

    async handleCheckoutQuantityButton(cartId, change, maxStock, moq) {
        const inputEl = document.querySelector(`.co-qty-input[onchange*="${cartId}"]`);
        if (!inputEl) return;

        const itemEl = inputEl.closest('.co-item');
        const productId = itemEl ? itemEl.getAttribute('data-product-id') : null;
        
        // Fetch current stock from server
        let currentStock = maxStock;
        if (productId) {
            const stockInfo = await this.fetchProductStock(productId);
            if (stockInfo !== null && stockInfo.stock !== null && stockInfo.stock !== currentStock) {
                currentStock = stockInfo.stock;
                const stockType = stockInfo.isPreorder ? 'pre-order' : 'stock';
                this.showMessage(`${stockType.charAt(0).toUpperCase() + stockType.slice(1)} updated: Only ${currentStock} available`, 'info');
            }
        }

        const safeMoq = Number.isFinite(Number(moq)) && Number(moq) > 0 ? Number(moq) : 1;
        const currentQty = parseInt(inputEl.value, 10) || safeMoq;
        const newQty = currentQty + change;

        if (newQty < safeMoq || newQty > currentStock) return;

        // Update max and min attributes on input
        inputEl.max = currentStock;
        inputEl.min = safeMoq;
        
        await this.updateCartQuantity(cartId, newQty, inputEl);
    }

    async handleCheckoutQuantityInput(cartId, rawValue, maxStock, moq, inputEl) {
        const itemEl = inputEl ? inputEl.closest('.co-item') : null;
        const productId = itemEl ? itemEl.getAttribute('data-product-id') : null;
        
        // Fetch current stock from server
        let currentStock = maxStock;
        if (productId) {
            const stockInfo = await this.fetchProductStock(productId);
            if (stockInfo !== null && stockInfo.stock !== null && stockInfo.stock !== currentStock) {
                currentStock = stockInfo.stock;
                const stockType = stockInfo.isPreorder ? 'pre-order' : 'stock';
                this.showMessage(`${stockType.charAt(0).toUpperCase() + stockType.slice(1)} updated: Only ${currentStock} available`, 'info');
            }
        }
        
        const parsed = Number.parseInt(String(rawValue || '').trim(), 10);
        const safeMax = Number.isFinite(Number(currentStock)) && Number(currentStock) > 0 ? Number(currentStock) : 1;
        const safeMoq = Number.isFinite(Number(moq)) && Number(moq) > 0 ? Number(moq) : 1;
        const nextQuantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, safeMoq), safeMax) : safeMoq;
        if (inputEl) {
            inputEl.value = String(nextQuantity);
            inputEl.max = safeMax;
            inputEl.min = safeMoq;
        }
        await this.updateCartQuantity(cartId, nextQuantity, inputEl);
    }

    updateCartQuantity(cartId, newQty, inputEl) {
        const oldQty = parseInt(inputEl.value, 10);
        
        // Instant UI update
        inputEl.value = newQty;
        
        // Get item price for local total calculation
        const itemEl = inputEl.closest('.co-item');
        const itemMetaEls = itemEl ? itemEl.querySelectorAll('.co-item-meta') : [];
        // The first .co-item-meta contains the price
        const itemPriceEl = itemMetaEls.length > 0 ? itemMetaEls[0] : null;
        const priceText = itemPriceEl ? itemPriceEl.textContent : '';
        const itemPrice = itemPriceEl ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
        
        // Update totals immediately
        this.updateCheckoutTotalsInstant(oldQty, newQty, itemPrice, itemEl);
        
        // Debounce the API call so rapid clicks only send one request
        this._debounceCheckoutUpdate(cartId, newQty, oldQty);
    }

    updateCheckoutTotalsInstant(oldQty, newQty, itemPrice, itemEl) {
        // Update individual item total
        const itemTotalEl = itemEl ? itemEl.querySelector('.co-item-total') : null;
        if (itemTotalEl && itemPrice) {
            const newItemTotal = itemPrice * newQty;
            itemTotalEl.textContent = this.fmtCurrency(newItemTotal);
        }
        
        // Update subtotal
        const checkoutSubtotal = document.getElementById('checkout-subtotal');
        if (checkoutSubtotal && itemPrice) {
            const currentSubtotal = parseFloat(checkoutSubtotal.textContent.replace(/,/g, ''));
            const quantityDiff = newQty - oldQty;
            const newSubtotal = currentSubtotal + (itemPrice * quantityDiff);
            checkoutSubtotal.textContent = this.fmtNumber(newSubtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Update total
        const checkoutTotalFooter = document.getElementById('checkout-total-footer');
        if (checkoutTotalFooter && itemPrice) {
            const currentTotal = parseFloat(checkoutTotalFooter.textContent.replace(/,/g, ''));
            const quantityDiff = newQty - oldQty;
            const newTotal = currentTotal + (itemPrice * quantityDiff);
            checkoutTotalFooter.textContent = this.fmtNumber(newTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    _debounceCheckoutUpdate(cartId, newQty, oldQty) {
        if (!this._checkoutUpdateTimers) {
            this._checkoutUpdateTimers = {};
        }
        
        // Clear existing timer for this cart item
        if (this._checkoutUpdateTimers[cartId]) {
            clearTimeout(this._checkoutUpdateTimers[cartId]);
        }
        
        // Set new timer (500ms debounce)
        this._checkoutUpdateTimers[cartId] = setTimeout(async () => {
            await this._executeCheckoutUpdate(cartId, newQty, oldQty);
            delete this._checkoutUpdateTimers[cartId];
        }, 500);
    }

    async _executeCheckoutUpdate(cartId, newQty, oldQty) {
        // Refresh token from localStorage in case user logged out in another tab
        this.token = localStorage.getItem('token');
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/cart/${cartId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ quantity: newQty })
            });

            if (response.ok) {
                const data = await response.json();
                // Sync with server totals
                this.updateCheckoutTotals(data);
            } else if (response.status === 404) {
                // Item no longer exists - reload cart to get current state
                this.showMessage('Cart was updated, reloading...', 'info');
                await this.loadCheckout();
            } else {
                // Revert to old quantity on error
                const inputEl = document.querySelector(`.co-qty-input[onchange*="${cartId}"]`);
                if (inputEl) {
                    inputEl.value = oldQty;
                    // Revert totals
                    const itemEl = inputEl.closest('.co-item');
                    const itemMetaEls = itemEl ? itemEl.querySelectorAll('.co-item-meta') : [];
                    const itemPriceEl = itemMetaEls.length > 0 ? itemMetaEls[0] : null;
                    const itemPrice = itemPriceEl ? parseFloat(itemPriceEl.textContent.replace(/[^\d.]/g, '')) : 0;
                    this.updateCheckoutTotalsInstant(newQty, oldQty, itemPrice, itemEl);
                }
                this.showMessage('Failed to update quantity', 'error');
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            this.showMessage('Error updating quantity', 'error');
        }
    }

    updateCheckoutTotals(data) {
        // Update subtotal
        const checkoutSubtotal = document.getElementById('checkout-subtotal');
        if (checkoutSubtotal && data.summary?.subtotal) {
            checkoutSubtotal.textContent = this.fmtNumber(data.summary.subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Update total
        const checkoutTotalFooter = document.getElementById('checkout-total-footer');
        if (checkoutTotalFooter && data.summary?.total) {
            checkoutTotalFooter.textContent = this.fmtNumber(data.summary.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Update delivery fee if it changed
        const checkoutDeliveryFee = document.getElementById('checkout-delivery-fee');
        if (checkoutDeliveryFee && data.summary?.delivery_fee) {
            checkoutDeliveryFee.textContent = this.fmtNumber(data.summary.delivery_fee, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    async removeCheckoutItem(cartId) {
        // Show confirmation modal
        const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        const confirmBtn = document.getElementById('confirm-delete-btn');

        // Store cart ID for deletion
        this.pendingDeleteId = cartId;

        // Set up confirm button handler
        confirmBtn.onclick = async () => {
            modal.hide();
            await this.executeRemoveItem(cartId);
        };

        modal.show();
    }

    async executeRemoveItem(cartId) {
        // Refresh token from localStorage in case user logged out in another tab
        this.token = localStorage.getItem('token');
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/cart/${cartId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderCheckout(data);
            } else if (response.status === 404) {
                // Item no longer exists - reload cart to get current state
                this.showMessage('Cart was updated, reloading...', 'info');
                await this.loadCheckout();
            } else {
                this.showMessage('Failed to remove item', 'error');
            }
        } catch (error) {
            console.error('Error removing item:', error);
            this.showMessage('Error removing item', 'error');
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        window.location.href = '/index.html';
    }

    getDeliveryFee() {
        return this.deliveryFee;
    }

    fmtCurrency(amount) {
        return `₱${this.fmtNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    fmtNumber(num, options = {}) {
        return new Intl.NumberFormat('en-PH', options).format(num);
    }

    showMessage(message, type = 'info') {
        const bg = type === 'success' ? '#2d7a3a' : type === 'error' ? '#dc2626' : '#0ea5e9';
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed;top:76px;right:1.25rem;z-index:9999;
            background:${bg};color:#fff;
            padding:.6rem 1.1rem;border-radius:8px;
            font-size:.85rem;font-weight:600;
            box-shadow:0 4px 14px rgba(0,0,0,.18);
            display:flex;align-items:center;gap:.5rem;
            max-width:340px;animation:fadeInDown .2s ease;
        `;
        const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-x-circle-fill' : 'bi-info-circle-fill';
        toast.innerHTML = `<i class="bi ${icon}"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 3500);
    }

}

// Initialize checkout page
const checkoutPage = new CheckoutPage();
window.checkoutPage = checkoutPage;
document.addEventListener('DOMContentLoaded', () => checkoutPage.init());
