class AddressesPage {
    constructor() {
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.init();
    }

    async init() {
        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        document.getElementById('address-form').addEventListener('submit', (e) => this.saveAddress(e));
        document.getElementById('cancel-edit').addEventListener('click', () => this.cancelEdit());
        document.getElementById('address-zone').addEventListener('change', () => this.handleZoneChange());
        document.getElementById('address-province').addEventListener('change', () => this.handleProvinceChange());
        document.getElementById('address-city').addEventListener('change', () => this.handleCityChange());
        document.getElementById('address-barangay').addEventListener('change', () => this.updateAddressPreview());
        document.getElementById('address-street').addEventListener('input', () => this.updateAddressPreview());

        const phoneInput = document.getElementById('address-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });
        }

        await this.setupPsgcForm();
        await this.loadAddresses();
    }

    async setupPsgcForm(address = null) {
        const zoneSelect = document.getElementById('address-zone');
        const provinceSelect = document.getElementById('address-province');
        const citySelect = document.getElementById('address-city');
        const barangaySelect = document.getElementById('address-barangay');

        if (!zoneSelect || !window.PSGC) return;

        window.PSGC.loadZones(zoneSelect);
        window.PSGC.setSelectOptions(provinceSelect, [], 'Select Province');
        provinceSelect.disabled = true;
        window.PSGC.setSelectOptions(citySelect, [], 'Select City / Municipality');
        citySelect.disabled = true;
        window.PSGC.setSelectOptions(barangaySelect, [], 'Select Barangay');
        barangaySelect.disabled = true;

        document.getElementById('address-street').value = address?.street || '';
        this.updateAddressPreview();
    }

    async handleZoneChange() {
        const zone = document.getElementById('address-zone').value;
        const provinceEl = document.getElementById('address-province');
        const cityEl = document.getElementById('address-city');
        const barangayEl = document.getElementById('address-barangay');
        await window.PSGC.onZoneChange(zone, { provinceEl, cityEl, barangayEl });
        this.updateAddressPreview();
    }

    async handleProvinceChange() {
        const province = document.getElementById('address-province').value;
        const cityEl = document.getElementById('address-city');
        const barangayEl = document.getElementById('address-barangay');
        await window.PSGC.onProvinceChange(province, { cityEl, barangayEl });
        this.updateAddressPreview();
    }

    async handleCityChange() {
        const city = document.getElementById('address-city').value;
        await window.PSGC.loadBarangays(city, document.getElementById('address-barangay'));
        this.updateAddressPreview();
    }

    getFormAddress() {
        return {
            province: document.getElementById('address-province').value.trim(),
            city: document.getElementById('address-city').value.trim(),
            barangay: document.getElementById('address-barangay').value.trim(),
            street: document.getElementById('address-street').value.trim()
        };
    }

    updateAddressPreview() {
        const preview = document.getElementById('address-preview');
        if (!preview) return;
        preview.value = window.PSGC.formatAddress(this.getFormAddress());
    }

    async loadAddresses() {
        try {
            const response = await fetch(`${this.apiBase}/addresses`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.renderAddresses(data.addresses || []);
            }
        } catch (error) {
            console.error('Load addresses error:', error);
        }
    }

    renderAddresses(addresses) {
        const list = document.getElementById('addresses-list');
        if (!list) return;

        if (!addresses.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-map-marker-alt"></i><p>No addresses saved yet.</p><p>Add your first address below to get started.</p></div>';
            return;
        }

        list.innerHTML = addresses.map(addr => {
            const fullAddress = addr.formatted_address || window.PSGC.formatAddress({
                street: addr.street || addr.address_line1 || '',
                barangay: addr.barangay || addr.address_line2 || '',
                city: addr.city || '',
                province: addr.province || ''
            });

            let phoneDisplay = addr.phone || '';
            if (phoneDisplay && !phoneDisplay.startsWith('+63')) {
                phoneDisplay = '+63' + phoneDisplay;
            }

            return `
            <div class="address-card ${addr.is_default ? 'default-address' : ''}">
                <div class="address-card-content">
                    ${addr.is_default ? '<span class="default-badge"><i class="fas fa-star"></i> Default Address</span>' : ''}
                    <div class="address-info">
                        <h4>${addr.full_name || 'Unnamed'}</h4>
                        <p class="address-phone"><i class="fas fa-phone"></i> ${phoneDisplay}</p>
                        <p class="address-text"><i class="fas fa-map-marker-alt"></i> ${fullAddress || 'No address provided'}</p>
                    </div>
                </div>
                <div class="address-actions">
                    <button class="btn btn-small btn-primary" onclick="addressesPage.editAddress(${addr.id})" title="Edit address">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${!addr.is_default ? `<button class="btn btn-small btn-secondary" onclick="addressesPage.setDefault(${addr.id})" title="Set as default">
                        <i class="fas fa-star"></i> Set Default
                    </button>` : ''}
                    <button class="btn btn-small btn-danger" onclick="addressesPage.deleteAddress(${addr.id})" title="Delete address">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    async saveAddress(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('address-fullname').value.trim();
        const phone = document.getElementById('address-phone').value.trim();
        const { province, city, barangay, street } = this.getFormAddress();
        const formattedAddress = window.PSGC.formatAddress({ province, city, barangay, street });
        
        if (!fullName) {
            this.showMessage('Please enter your full name', 'error');
            document.getElementById('address-fullname').focus();
            return;
        }
        
        if (!phone || phone.length !== 10) {
            this.showMessage('Please enter a valid 10-digit phone number', 'error');
            document.getElementById('address-phone').focus();
            return;
        }
        
        if (!province || !city || !barangay || !street) {
            this.showMessage('Please complete the province, city, barangay, and street fields', 'error');
            if (!province) document.getElementById('address-province').focus();
            else if (!city) document.getElementById('address-city').focus();
            else if (!barangay) document.getElementById('address-barangay').focus();
            else document.getElementById('address-street').focus();
            return;
        }
        
        const id = document.getElementById('address-id').value;
        const phoneWithPrefix = phone.startsWith('+63') ? phone : '+63' + phone;

        const payload = {
            label: '',
            full_name: fullName,
            phone: phoneWithPrefix,
            street,
            barangay,
            city,
            province,
            address_line1: street,
            address_line2: barangay,
            postal_code: '',
            is_default: document.getElementById('address-default').checked
        };

        try {
            const response = await fetch(`${this.apiBase}/addresses${id ? `/${id}` : ''}`, {
                method: id ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                await response.json().catch(() => ({}));
                await this.resetForm();
                await this.loadAddresses();
                const message = id ? 'Address updated successfully!' : 'Address saved successfully!';
                this.showMessage(message, 'success');
            } else {
                const error = await response.json();
                this.showMessage(error.message || 'Failed to save address', 'error');
            }
        } catch (error) {
            console.error('Save address error:', error);
            this.showMessage('Failed to save address. Please try again.', 'error');
        }
    }
    
    showMessage(message, type = 'info') {
        // Create or update message element
        let messageEl = document.getElementById('address-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'address-message';
            messageEl.className = `address-message address-message-${type}`;
            const form = document.getElementById('address-form');
            form.parentNode.insertBefore(messageEl, form);
        }
        
        messageEl.className = `address-message address-message-${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }

    async editAddress(id) {
        try {
            const response = await fetch(`${this.apiBase}/addresses`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const addr = data.addresses.find(a => a.id === id);
                if (!addr) return;
                
                // Set form values
                document.getElementById('address-id').value = addr.id;
                document.getElementById('address-fullname').value = addr.full_name || '';

                let phone = addr.phone || '';
                if (phone.startsWith('+63')) {
                    phone = phone.substring(3);
                }
                document.getElementById('address-phone').value = phone;

                await this.setupPsgcForm({
                    province: addr.province || '',
                    city: addr.city || '',
                    barangay: addr.barangay || addr.address_line2 || '',
                    street: addr.street || addr.address_line1 || ''
                });
                document.getElementById('address-default').checked = !!addr.is_default;
                document.getElementById('cancel-edit').style.display = 'inline-block';

                document.getElementById('address-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Edit address error:', error);
            this.showMessage('Failed to load address for editing', 'error');
        }
    }
    
    async resetForm() {
        document.getElementById('address-form').reset();
        document.getElementById('address-id').value = '';
        document.getElementById('cancel-edit').style.display = 'none';
        await this.setupPsgcForm();
    }

    async cancelEdit() {
        await this.resetForm();
    }

    async deleteAddress(id) {
        if (!await showConfirm('Are you sure you want to delete this address? This action cannot be undone.', { title: 'Delete Address', okLabel: 'Delete', danger: true })) return;
        try {
            const response = await fetch(`${this.apiBase}/addresses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.loadAddresses();
                this.showMessage('Address deleted successfully', 'success');
            } else {
                this.showMessage('Failed to delete address', 'error');
            }
        } catch (error) {
            console.error('Delete address error:', error);
            this.showMessage('Failed to delete address. Please try again.', 'error');
        }
    }

    async setDefault(id) {
        try {
            const response = await fetch(`${this.apiBase}/addresses/${id}/set-default`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.loadAddresses();
                this.showMessage('Default address updated successfully', 'success');
            } else {
                this.showMessage('Failed to set default address', 'error');
            }
        } catch (error) {
            console.error('Set default address error:', error);
            this.showMessage('Failed to set default address. Please try again.', 'error');
        }
    }
}

const addressesPage = new AddressesPage();
