class AddressesPage {
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
        this.loadAddresses();
        document.getElementById('address-form').addEventListener('submit', (e) => this.saveAddress(e));
        document.getElementById('cancel-edit').addEventListener('click', () => this.cancelEdit());
        
        // Phone number input - only allow digits
        const phoneInput = document.getElementById('address-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });
        }
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
            // Combine all address parts into a single address string
            const addressParts = [
                addr.address_line1,
                addr.address_line2,
                addr.city,
                addr.province,
                addr.postal_code
            ].filter(part => part && part.trim());
            const fullAddress = addressParts.join(', ');
            
            // Format phone with +63 prefix
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
        const address = document.getElementById('address-full').value.trim();
        
        // Validation
        if (!fullName) {
            alert('Please enter your full name');
            document.getElementById('address-fullname').focus();
            return;
        }
        
        if (!phone || phone.length !== 10) {
            alert('Please enter a valid 10-digit phone number');
            document.getElementById('address-phone').focus();
            return;
        }
        
        if (!address) {
            alert('Please enter your address');
            document.getElementById('address-full').focus();
            return;
        }
        
        const id = document.getElementById('address-id').value;
        
        // Format phone with +63 prefix for storage
        const phoneWithPrefix = phone.startsWith('+63') ? phone : '+63' + phone;
        
        // Store the full address in address_line1, other fields empty
        const payload = {
            label: '', // Not used in simplified version
            full_name: fullName,
            phone: phoneWithPrefix,
            address_line1: address,
            address_line2: '',
            city: '',
            province: '',
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
                const data = await response.json();
                document.getElementById('address-form').reset();
                document.getElementById('address-id').value = '';
                document.getElementById('cancel-edit').style.display = 'none';
                this.loadAddresses();
                
                // Show success message
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
                
                // Extract phone number (remove +63 prefix if present)
                let phone = addr.phone || '';
                if (phone.startsWith('+63')) {
                    phone = phone.substring(3);
                }
                document.getElementById('address-phone').value = phone;
                
                // Combine all address parts into single field
                const addressParts = [
                    addr.address_line1,
                    addr.address_line2,
                    addr.city,
                    addr.province,
                    addr.postal_code
                ].filter(part => part && part.trim());
                document.getElementById('address-full').value = addressParts.join(', ');
                
                document.getElementById('address-default').checked = !!addr.is_default;
                
                // Show cancel button
                document.getElementById('cancel-edit').style.display = 'inline-block';
                
                // Scroll to form
                document.getElementById('address-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Edit address error:', error);
            this.showMessage('Failed to load address for editing', 'error');
        }
    }
    
    cancelEdit() {
        document.getElementById('address-form').reset();
        document.getElementById('address-id').value = '';
        document.getElementById('cancel-edit').style.display = 'none';
    }

    async deleteAddress(id) {
        if (!confirm('Are you sure you want to delete this address? This action cannot be undone.')) return;
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
