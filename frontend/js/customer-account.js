class CustomerAccount {
    constructor() {
        // Determine API base (mirror app.js logic)
        const host = window.location.hostname;
        const isCustomFrontendHost = host === 'agricatch.store' ||
            host === 'www.agricatch.store' ||
            host.includes('agricatch.store') ||
            host === 'agricatch.page.dev';
        const isRenderHost = host.includes('onrender.com') || host.includes('render.com');
        this.apiBase = window.API_BASE || (isCustomFrontendHost
            ? 'https://agricatch.onrender.com/api'
            : (isRenderHost ? '/api' : 'http://localhost:3000/api'));
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        this.currentUser = null;
        this.currentProfile = null;
        this.currentVerification = null;
        this.verificationHistory = [];
        this._verificationHistoryPage = 1;
        this.tickets = [];
        this.ticketsTotal = 0;
        this.ticketsPage = 1;
        this.ticketsLimit = 10;

        // Chat polling for real-time unread message updates
        this.chatPollInterval = null;
        this.chatPollFailures = 0;

        // Notifications polling for real-time updates
        this.notifPollInterval = null;
        this.notifPollFailures = 0;

        window.customerAccount = this;
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

    getUserId() {
        if (!this.token) return null;
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.user_id || payload.id || null;
        } catch (e) {
            return null;
        }
    }

    async init() {
        if (!this.token || !this.getUserId()) {
            this.showGuestLoginPrompt();
            return;
        }

        try {
            await this.loadProfile();
        } catch (e) {
            console.error('Profile load failed:', e);
            this.showGuestLoginPrompt();
            return;
        }

        if (!this.currentProfile) {
            this.showGuestLoginPrompt();
            return;
        }

        // Farmers should use farmer.html
        if (this.currentProfile.role === 'farmer') {
            window.location.href = '/farmer.html';
            return;
        }

        // Admins should use admin.html
        if (this.currentProfile.role === 'admin' || this.currentProfile.role === 'super_admin') {
            window.location.href = '/admin.html';
            return;
        }

        this.setupEventListeners();
        this.setupTabs();
        this.renderHeader();
        this.renderOverview();
        this.populateEditForm();
        this.loadVerification();
        this.loadTickets();
        this.loadSupportTicketsBadge();
        this.loadMessages();
        this.loadNotifications();
        this.startChatPolling();
        this.startNotifPolling();
        this.setupRealtime();
        this.handleHashTab();
        this.setupPsgc();

        // Hide loading screen
        const loadingScreen = document.getElementById('admin-loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    showGuestLoginPrompt() {
        showToast('Please log in to view your profile', 'info');
        
        // Store return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        
        // Redirect to home with login prompt
        setTimeout(() => {
            window.location.href = `/?login=1&returnUrl=${returnUrl}`;
        }, 1500);
    }

    redirectToLogin() {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/?login=1&returnUrl=${returnUrl}`;
    }

    // Auth helpers
    async loadProfile() {
        const response = await fetch(`${this.apiBase}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Unauthorized');
            }
            throw new Error('Failed to load profile');
        }
        const data = await response.json();
        this.currentProfile = data.user || data.profile || null;
    }

    renderHeader() {
        const profile = this.currentProfile;
        const displayName = profile.username || profile.full_name || 'Account';
        const email = profile.email || '';

        // Update header name elements
        const nameEl = document.getElementById('user-name');
        const nameDdEl = document.getElementById('user-name-dd');
        const initialEl = document.getElementById('header-profile-initial');
        const emailEl = document.getElementById('user-email');
        const roleBadgeEl = document.getElementById('header-role-badge');
        const verifiedIconEl = document.getElementById('header-verified-icon');

        if (nameEl) nameEl.textContent = displayName;
        if (nameDdEl) nameDdEl.textContent = displayName;
        if (initialEl) initialEl.textContent = String(displayName).charAt(0).toUpperCase();
        if (emailEl) emailEl.textContent = email;
        if (roleBadgeEl && profile.role) {
            roleBadgeEl.textContent = this.formatRole(profile.role);
            roleBadgeEl.style.display = 'inline-block';
        }
        if (verifiedIconEl) {
            verifiedIconEl.style.display = profile.is_verified ? 'inline-block' : 'none';
        }
    }

    // Tabs
    setupTabs() {
        const navItems = document.querySelectorAll('.sidebar-link[data-section]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTab(item.dataset.section);
                window.location.hash = item.dataset.section;
            });
        });
    }

    showTab(tabId) {
        // Save active section to localStorage for persistence (match farmer.js behavior)
        localStorage.setItem('customerActiveSection', tabId);

        // Nav - use .sidebar-link with data-section
        document.querySelectorAll('.sidebar-link[data-section]').forEach(el => {
            el.classList.toggle('active', el.dataset.section === tabId);
        });
        // Sections - use .admin-section-card
        document.querySelectorAll('.admin-section-card').forEach(el => {
            el.classList.toggle('active', el.id === tabId);
        });

        // Hide sidebar and header for support tickets sections (fullscreen mode), but keep breadcrumbs visible
        const pagetitle = document.querySelector('.pagetitle');
        const sidebar = document.getElementById('customer-sidebar');
        const sidebarToggle = document.getElementById('customer-sidebar-toggle');
        const header = document.getElementById('header');
        const main = document.getElementById('main');

        if (tabId === 'support-tickets' || tabId === 'support-ticket-chat') {
            // Keep breadcrumbs visible - only hide sidebar and header
            if (sidebar) {
                sidebar.style.transition = 'none';
                sidebar.style.display = 'none';
            }
            if (sidebarToggle) sidebarToggle.style.display = 'none';
            if (header) header.style.display = 'none';
            if (main) {
                main.style.transition = 'none';
                main.style.marginLeft = '0';
                main.style.padding = '20px';
            }
        } else {
            if (sidebar) {
                sidebar.style.transition = '';
                sidebar.style.display = '';
            }
            if (sidebarToggle) sidebarToggle.style.display = '';
            if (header) header.style.display = '';
            if (main) {
                main.style.transition = '';
                main.style.marginLeft = '';
                main.style.padding = '';
            }
        }

        // Update breadcrumb
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbCurrent) {
            const breadcrumbLabels = {
                'profile-overview': 'My Profile',
                'profile-edit': 'Edit Profile',
                'profile-password': 'Change Password',
                'profile-verification': 'Verification',
                'support-tickets': 'Support Tickets',
                'support-ticket-chat': 'Support Chat'
            };
            breadcrumbCurrent.textContent = breadcrumbLabels[tabId] || 'My Profile';
        }

        // Mobile sidebar - use NiceAdmin toggle-sidebar pattern
        if (window.innerWidth <= 1199) {
            document.body.classList.remove('toggle-sidebar');
        }

        // Scroll to top when switching sections
        window.scrollTo(0, 0);

        // Load section-specific data
        if (tabId === 'support-tickets') {
            this.loadTickets();
        } else if (tabId === 'support-ticket-chat') {
            // Auto-select first ticket when support-ticket-chat section is opened (match farmer.js behavior)
            if (window.supportTicketChat && typeof window.supportTicketChat.onSectionVisible === 'function') {
                window.supportTicketChat.onSectionVisible();
            }
        } else if (tabId === 'profile-verification') {
            this.loadVerification();
        } else if (tabId === 'profile-overview') {
            this.renderOverview();
        }
    }

    handleHashTab() {
        // Match farmer.js behavior: use localStorage persistence with hash fallback
        // Note: support-tickets and support-ticket-chat are only accessible via dropdown, not sidebar
        const validSections = new Set(['profile-overview', 'profile-edit', 'profile-password', 'profile-verification', 'support-tickets', 'support-ticket-chat']);
        const savedSectionRaw = localStorage.getItem('customerActiveSection');
        const savedSection = String(savedSectionRaw || '').trim();
        const hash = String((window.location.hash || '')).replace('#', '').trim();

        const initialSection = validSections.has(savedSection)
            ? savedSection
            : (validSections.has(hash) ? hash : 'profile-overview');

        this.showTab(initialSection);

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && validSections.has(hash)) {
                this.showTab(hash);
            }
        });
    }

    // Overview
    renderOverview() {
        const profile = this.currentProfile;
        if (!profile) return;

        const nameParts = this.deriveNameParts(profile);
        const fullName = [nameParts.firstName, nameParts.middleName, nameParts.lastName].filter(Boolean).join(' ').trim() || profile.full_name || '—';
        const displayName = profile.username || profile.full_name || 'Account';
        const email = profile.email || '—';
        const phone = profile.phone || '—';
        const address = profile.address || '—';
        const role = this.formatRole(profile.role);
        const joined = profile.created_at ? FormatUtil.formatDateOnly(profile.created_at) : '—';
        const verificationStatus = this.formatVerificationStatus(profile);

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('overview-avatar', String(displayName).charAt(0).toUpperCase());
        setText('overview-name', displayName);
        setText('overview-email', email);
        setText('overview-username', profile.username || '—');
        setText('overview-fullname', fullName);
        setText('overview-email-detail', email);
        setText('overview-phone', phone);
        setText('overview-address', address);
        setText('overview-role', role);
        setText('overview-joined', joined);

        const verifEl = document.getElementById('overview-verification');
        if (verifEl) {
            verifEl.innerHTML = verificationStatus;
        }
    }

    formatRole(role) {
        if (!role) return '—';
        return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    formatVerificationStatus(profile) {
        if (profile.is_verified || profile.verification_status === 'approved') {
            return '<span class="status-badge status-approved"><i class="bi bi-check-circle me-1"></i>Verified</span>';
        }
        if (profile.verification_status === 'pending') {
            return '<span class="status-badge status-pending"><i class="bi bi-hourglass-split me-1"></i>Pending</span>';
        }
        return '<span class="status-badge status-unverified"><i class="bi bi-x-circle me-1"></i>Unverified</span>';
    }

    deriveNameParts(profile) {
        const first = String(profile.first_name || '').trim();
        const middle = String(profile.middle_name || '').trim();
        const last = String(profile.last_name || '').trim();
        if (first || middle || last) return { firstName: first, middleName: middle, lastName: last };
        const full = String(profile.full_name || '').trim();
        if (!full) return { firstName: '', middleName: '', lastName: '' };
        const parts = full.split(/\s+/);
        if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
        if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
        return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1] };
    }

    // Edit Profile
    populateEditForm() {
        const profile = this.currentProfile;
        const nameParts = this.deriveNameParts(profile);
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };
        setVal('edit-firstname', nameParts.firstName);
        setVal('edit-middlename', nameParts.middleName);
        setVal('edit-lastname', nameParts.lastName);
        setVal('edit-email', profile.email || '');
        setVal('edit-phone', this.formatPhoneInputValue(String(profile.phone || '').replace(/^\+63/, '')));
        setVal('edit-address-preview', profile.address || '');

        // Store address for later population after PSGC loads
        this.pendingAddress = profile.address;

        // Disable name fields if verified
        const isVerified = profile.is_verified || profile.verification_status === 'approved';
        const nameInputs = ['edit-firstname', 'edit-middlename', 'edit-lastname'];
        const verifiedHint = document.getElementById('edit-name-verified-hint');
        
        nameInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = isVerified;
            }
        });

        if (verifiedHint) {
            verifiedHint.style.display = isVerified ? 'block' : 'none';
        }
    }

    async populateAddressFields(address) {
        if (!address || !window.PSGC) return;

        const parsed = window.PSGC.parseAddress(address);
        if (!parsed) return;

        const zone = document.getElementById('edit-zone');
        const province = document.getElementById('edit-province');
        const city = document.getElementById('edit-city');
        const barangay = document.getElementById('edit-barangay');
        const street = document.getElementById('edit-street');

        if (!zone) return;

        // Set street if available
        if (street && parsed.street) {
            street.value = parsed.street;
        }

        // Determine and set zone
        let zoneValue = parsed.zone;
        if (!zoneValue && parsed.province === 'Metro Manila') {
            zoneValue = 'metro';
        }
        if (zoneValue) {
            zone.value = zoneValue;
            // Trigger zone change to load provinces/cities
            await window.PSGC.onZoneChange(zoneValue, { provinceEl: province, cityEl: city, barangayEl: barangay }).catch(() => {});

            // Set province after it's loaded
            if (parsed.province && province) {
                province.value = parsed.province;
                // Load cities for this province
                await window.PSGC.loadCities(parsed.province, city, parsed.city || '').catch(() => {});
                city.disabled = false;

                // Set barangay after city is loaded
                if (parsed.city && city) {
                    city.value = parsed.city;
                    await window.PSGC.loadBarangays(parsed.city, barangay, parsed.barangay || '').catch(() => {});
                    barangay.disabled = false;

                    if (parsed.barangay && barangay) {
                        barangay.value = parsed.barangay;
                    }
                }
            }
        }
    }

    setupPsgc() {
        const zone = document.getElementById('edit-zone');
        const province = document.getElementById('edit-province');
        const city = document.getElementById('edit-city');
        const barangay = document.getElementById('edit-barangay');
        const street = document.getElementById('edit-street');
        if (!zone) return;

        const waitForPsgc = async () => {
            if (window.PSGC) return window.PSGC;
            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 100));
                if (window.PSGC) return window.PSGC;
            }
            return null;
        };

        waitForPsgc().then(psgc => {
            if (psgc && zone) {
                psgc.loadZones(zone);
                zone.value = '';

                // Populate address fields with existing address from database
                if (this.pendingAddress) {
                    this.populateAddressFields(this.pendingAddress);
                }
            }
        });

        zone?.addEventListener('change', async () => {
            if (!window.PSGC) return;
            await window.PSGC.onZoneChange(zone.value, { provinceEl: province, cityEl: city, barangayEl: barangay }).catch(() => {});
            this.updateAddressPreview();
        });
        province?.addEventListener('change', async () => {
            if (!window.PSGC) return;
            if (province.value) {
                await window.PSGC.loadCities(province.value, city).catch(() => {});
                city.disabled = false;
            } else {
                city.innerHTML = '<option value="">Select City / Municipality</option>';
                city.disabled = true;
            }
            barangay.innerHTML = '<option value="">Select Barangay</option>';
            barangay.disabled = true;
            this.updateAddressPreview();
        });
        city?.addEventListener('change', async () => {
            if (!window.PSGC) return;
            if (city.value) {
                await window.PSGC.loadBarangays(city.value, barangay).catch(() => {});
                barangay.disabled = false;
            } else {
                barangay.innerHTML = '<option value="">Select Barangay</option>';
                barangay.disabled = true;
            }
            this.updateAddressPreview();
        });
        barangay?.addEventListener('change', () => this.updateAddressPreview());
        street?.addEventListener('input', () => this.updateAddressPreview());
    }

    updateAddressPreview() {
        const province = document.getElementById('edit-province')?.value?.trim() || '';
        const city = document.getElementById('edit-city')?.value?.trim() || '';
        const barangay = document.getElementById('edit-barangay')?.value?.trim() || '';
        const street = document.getElementById('edit-street')?.value?.trim() || '';
        const preview = document.getElementById('edit-address-preview');
        if (!preview) return;
        if (province || city || barangay || street) {
            preview.value = window.PSGC
                ? window.PSGC.formatAddress({ street, barangay, city, province })
                : [street, barangay, city, province].filter(Boolean).join(', ');
        }
    }

    async saveProfile(e) {
        e.preventDefault();
        const firstName = document.getElementById('edit-firstname')?.value?.trim() || '';
        const middleName = document.getElementById('edit-middlename')?.value?.trim() || '';
        const lastName = document.getElementById('edit-lastname')?.value?.trim() || '';
        const phoneRaw = document.getElementById('edit-phone')?.value || '';
        const province = document.getElementById('edit-province')?.value?.trim() || '';
        const city = document.getElementById('edit-city')?.value?.trim() || '';
        const barangay = document.getElementById('edit-barangay')?.value?.trim() || '';
        const street = document.getElementById('edit-street')?.value?.trim() || '';
        const phoneDigits = String(phoneRaw).replace(/\D/g, '');
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

        if (!firstName || !lastName) {
            this.showToast('Please complete first name and last name.', 'error');
            return;
        }
        if (firstName.length > 40) {
            this.showToast('First name must be 40 characters or less.', 'error');
            return;
        }
        if (middleName.length > 40) {
            this.showToast('Middle name must be 40 characters or less.', 'error');
            return;
        }
        if (lastName.length > 40) {
            this.showToast('Last name must be 40 characters or less.', 'error');
            return;
        }
        if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
            this.showToast('Please enter a valid contact number (10 digits starting with 9).', 'error');
            return;
        }

        // Check phone uniqueness before submission
        try {
            const phoneCheckResponse = await fetch('/api/auth/check-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneDigits, userId: this.user?.id })
            });
            if (phoneCheckResponse.status === 409) {
                this.showToast('This phone number is already registered.', 'error');
                return;
            }
        } catch (phoneCheckError) {
            // If phone check fails, continue with profile update (backend will validate)

        }

        let address = null;
        const anyAddress = province || city || barangay || street;
        if (anyAddress) {
            if (!province || !city || !barangay || !street) {
                this.showToast('Please complete all address fields: province, city, barangay, and street.', 'error');
                return;
            }
            address = window.PSGC
                ? window.PSGC.formatAddress({ street, barangay, city, province })
                : [street, barangay, city, province].filter(Boolean).join(', ');
        }

        const payload = {
            full_name: fullName,
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            phone: phoneDigits
        };
        if (address !== null) payload.address = address;

        this.setLoading('save-profile-btn', true);
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showToast(data.message || 'Failed to save profile changes.', 'error');
                return;
            }
            this.showToast('Profile updated successfully.', 'success');
            await this.loadProfile();
            this.renderHeader();
            this.renderOverview();
            this.showTab('profile-overview');
        } catch (error) {
            console.error('Save profile error:', error);
            this.showToast('Failed to save profile changes.', 'error');
        } finally {
            this.setLoading('save-profile-btn', false);
        }
    }

    // Change Password
    async changePassword(e) {
        e.preventDefault();
        const current = document.getElementById('current-password')?.value || '';
        const newPass = document.getElementById('new-password')?.value || '';
        const confirm = document.getElementById('confirm-password')?.value || '';
        const errorEl = document.getElementById('password-error');
        if (errorEl) errorEl.classList.add('d-none');

        if (!current || !newPass || !confirm) {
            this.showPasswordError('Please fill in all password fields.');
            return;
        }
        if (newPass.length < 6) {
            this.showPasswordError('New password must be at least 6 characters.');
            return;
        }
        if (newPass !== confirm) {
            this.showPasswordError('New passwords do not match.');
            return;
        }
        if (newPass === current) {
            this.showPasswordError('New password must be different from current password.');
            return;
        }

        this.setLoading('change-password-submit-btn', true);
        try {
            const response = await fetch(`${this.apiBase}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ currentPassword: current, newPassword: newPass })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showPasswordError(data.message || 'Failed to change password.');
                return;
            }
            this.showToast(data.message || 'Password changed successfully.', 'success');
            document.getElementById('change-password-form')?.reset();
            this.resetPasswordToggles();
        } catch (error) {
            console.error('Change password error:', error);
            this.showPasswordError('Failed to change password.');
        } finally {
            this.setLoading('change-password-submit-btn', false);
        }
    }

    showPasswordError(message) {
        const errorEl = document.getElementById('password-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        }
    }

    resetPasswordToggles() {
        ['current-password', 'new-password', 'confirm-password'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.type = 'password';
        });
        ['toggle-current-password', 'toggle-new-password', 'toggle-confirm-password'].forEach(id => {
            const icon = document.getElementById(id)?.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    }

    bindPasswordToggle(buttonId, inputId) {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
        if (!button || !input) return;
        button.addEventListener('click', () => {
            const icon = button.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
            } else {
                input.type = 'password';
                if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
            }
        });
    }

    // Verification
    async loadVerification() {
        try {
            const response = await fetch(`${this.apiBase}/farmers/me/verification-request`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json().catch(() => ({}));
            this.currentVerification = data.request || null;
            this.verificationHistory = data.history || [];
            this.renderVerification();
            this.updateVerificationUI();
        } catch (error) {
            console.error('Load verification error:', error);
            this.currentVerification = null;
            this.verificationHistory = [];
            this.renderVerification();
            this.updateVerificationUI();
        }
    }

    renderVerification() {
        const statusCard = document.getElementById('verification-status-card');
        const statusText = document.getElementById('verification-status-text');
        const statusDesc = document.getElementById('verification-status-description');
        const benefits = document.getElementById('verification-benefits');
        const formSection = document.getElementById('verification-form-section');
        const statusDisplay = document.getElementById('verification-status-display');
        const historySection = document.getElementById('verification-history-section');

        const request = this.currentVerification;
        const isVerified = this.currentProfile?.is_verified || request?.status === 'approved';

        if (isVerified) {
            statusCard.className = 'alert alert-success';
            statusText.textContent = 'Your account is verified.';
            statusDesc.textContent = 'You are a trusted member with a verified badge.';
            benefits.style.display = 'none';
            formSection.style.display = 'none';
            statusDisplay.style.display = 'none';
            historySection.style.display = 'block';
            this.renderHistoryTimeline();
            return;
        }

        if (!request) {
            statusCard.className = 'alert alert-info';
            statusText.textContent = 'Your account is not verified.';
            statusDesc.textContent = 'Submit a verification request to earn your trusted member badge.';
            benefits.style.display = 'block';
            formSection.style.display = 'block';
            statusDisplay.style.display = 'none';
            historySection.style.display = this.verificationHistory.length > 0 ? 'block' : 'none';
            if (this.verificationHistory.length > 0) {
                this.renderHistoryTimeline();
            }
            return;
        }

        const statusMap = {
            pending: { class: 'alert-warning', text: 'Verification request is pending review.', icon: 'hourglass-split' },
            approved: { class: 'alert-success', text: 'Your account is verified.', icon: 'check-circle-fill' },
            rejected: { class: 'alert-danger', text: 'Verification request was rejected.', icon: 'x-circle-fill' }
        };
        const map = statusMap[request.status] || statusMap.pending;
        statusCard.className = `alert ${map.class}`;
        statusText.textContent = map.text;

        if (request.status === 'rejected') {
            statusDesc.textContent = request.rejection_reason
                ? `Reason: ${request.rejection_reason}`
                : 'You can submit a new verification request below.';
            benefits.style.display = 'none';
            formSection.style.display = 'block';
            statusDisplay.style.display = 'block';
        } else if (request.status === 'pending') {
            statusDesc.textContent = 'Your submission is being reviewed. You will be notified once a decision is made.';
            benefits.style.display = 'none';
            formSection.style.display = 'none';
            statusDisplay.style.display = 'block';
        } else {
            statusDesc.textContent = '';
            benefits.style.display = 'none';
            formSection.style.display = 'none';
            statusDisplay.style.display = 'block';
        }

        // Show history section if there's history
        historySection.style.display = this.verificationHistory.length > 0 ? 'block' : 'none';
        if (this.verificationHistory.length > 0) {
            this.renderHistoryTimeline();
        }

        // Display details
        const displayStatus = document.getElementById('display-status');
        const displaySubmitted = document.getElementById('display-submitted-date');
        const displayEstimated = document.getElementById('display-estimated-time');
        const displayNotesWrap = document.getElementById('display-admin-notes-wrap');
        const displayNotes = document.getElementById('display-admin-notes');
        if (displayStatus) displayStatus.innerHTML = `<span class="status-badge status-${request.status}">${this.formatRole(request.status)}</span>`;
        if (displaySubmitted) displaySubmitted.textContent = request.created_at ? FormatUtil.formatDate(request.created_at) : '—';
        if (displayEstimated) displayEstimated.textContent = 'Within 1-3 business days';
        if (displayNotesWrap && displayNotes) {
            if (request.rejection_reason) {
                displayNotes.textContent = request.rejection_reason;
                displayNotesWrap.style.display = 'block';
            } else {
                displayNotesWrap.style.display = 'none';
            }
        }
    }

    async submitVerification(e) {
        e.preventDefault();
        const notes = document.getElementById('verification-notes')?.value?.trim() || '';
        const fileInput = document.getElementById('verification-document');
        const file = fileInput?.files?.[0];
        let document_url = null;

        this.setLoading('submit-verification-btn', true);
        try {
            if (file) {
                const formData = new FormData();
                formData.append('document', file);
                const uploadRes = await fetch(`${this.apiBase}/upload/verification-document`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.token}` },
                    body: formData
                });
                const uploadData = await uploadRes.json().catch(() => ({}));
                if (!uploadRes.ok) {
                    this.showToast(uploadData.message || 'Failed to upload document.', 'error');
                    this.setLoading('submit-verification-btn', false);
                    return;
                }
                document_url = uploadData.imageUrl || uploadData.url || uploadData.document_url || uploadData.public_id;
            }

            const response = await fetch(`${this.apiBase}/farmers/me/verification-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ document_url, notes })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showToast(data.message || 'Failed to submit verification request.', 'error');
                return;
            }
            this.showToast('Verification request submitted successfully.', 'success');
            document.getElementById('verification-request-form')?.reset();
            document.getElementById('document-preview').style.display = 'none';
            await this.loadVerification();
        } catch (error) {
            console.error('Submit verification error:', error);
            this.showToast('Failed to submit verification request.', 'error');
        } finally {
            this.setLoading('submit-verification-btn', false);
        }
    }

    // Support Tickets
    async loadTickets() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/my?page=${this.ticketsPage}&limit=${this.ticketsLimit}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 403) {
                    this.showToast('Support tickets are not available for your account.', 'error');
                }
                throw new Error(data.message || 'Failed to load tickets');
            }
            const data = await response.json();
            this.tickets = data.tickets || [];
            this.ticketsTotal = data.total || 0;
            this.renderTickets();
            this.renderTicketsPagination();
        } catch (error) {
            console.error('Load tickets error:', error);
            const tbody = document.querySelector('#support-tickets-table tbody');
            if (tbody) {
                tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Unable to load tickets. Please try again.</td></tr>`;
            }
        }
    }

    renderTickets() {
        const tbody = document.querySelector('#support-tickets-table tbody');
        if (!tbody) return;
        if (!this.tickets.length) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No support tickets yet. Create one to get help.</td></tr>`;
            return;
        }
        tbody.innerHTML = this.tickets.map(ticket => {
            const statusStyles = {
                open: { bg: '#dcfce7', color: '#16a34a', label: 'Open' },
                in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
                resolved: { bg: '#fef3c7', color: '#d97706', label: 'Resolved' },
                closed: { bg: '#fee2e2', color: '#dc2626', label: 'Closed' }
            };
            const style = statusStyles[ticket.status] || statusStyles.open;

            return `
                <tr>
                    <td>${this.escapeHtml(ticket.subject)}</td>
                    <td class="text-center">#${ticket.id}</td>
                    <td class="text-center"><span style="background:${style.bg};color:${style.color};font-size:0.75rem;font-weight:600;padding:4px 10px;border-radius:9999px;text-transform:uppercase;">${style.label}</span></td>
                    <td>${FormatUtil.formatDate(ticket.created_at)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-ticket-btn" data-id="${ticket.id}">Chat</button>
                        ${ticket.unread_count > 0 ? '<i class="bi bi-dot text-danger ms-1"></i>' : ''}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.view-ticket-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ticketId = parseInt(btn.dataset.id);
                this.showTab('support-ticket-chat');
                if (window.supportTicketChat && typeof window.supportTicketChat.openTicket === 'function') {
                    setTimeout(() => window.supportTicketChat.openTicket(ticketId), 300);
                }
            });
        });
    }

    renderTicketsPagination() {
        const container = document.getElementById('support-tickets-pagination');
        if (!container) return;
        const totalPages = Math.ceil(this.ticketsTotal / this.ticketsLimit) || 1;
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        let html = '<nav><ul class="pagination pagination-sm">';
        html += `<li class="page-item ${this.ticketsPage === 1 ? 'disabled' : ''}"><button class="page-link" data-page="prev">Previous</button></li>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === this.ticketsPage ? 'active' : ''}"><button class="page-link" data-page="${i}">${i}</button></li>`;
        }
        html += `<li class="page-item ${this.ticketsPage === totalPages ? 'disabled' : ''}"><button class="page-link" data-page="next">Next</button></li>`;
        html += '</ul></nav>';
        container.innerHTML = html;

        container.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                const totalPages = Math.ceil(this.ticketsTotal / this.ticketsLimit) || 1;
                if (page === 'prev') {
                    if (this.ticketsPage > 1) this.ticketsPage--;
                } else if (page === 'next') {
                    if (this.ticketsPage < totalPages) this.ticketsPage++;
                } else {
                    this.ticketsPage = parseInt(page);
                }
                this.loadTickets();
            });
        });
    }


    async createTicket(e) {
        e.preventDefault();
        const subject = document.getElementById('support-ticket-subject')?.value?.trim();
        const description = document.getElementById('support-ticket-description')?.value?.trim();

        if (!subject || !description) {
            this.showToast('Subject and description are required.', 'error');
            return;
        }

        this.setLoading('btn-submit-support-ticket', true);
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ subject, description })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showToast(data.message || 'Failed to create ticket.', 'error');
                return;
            }
            this.showToast('Support ticket created successfully.', 'success');
            this.closeTicketModal();
            this.ticketsPage = 1;
            this.loadTickets();
        } catch (error) {
            console.error('Create ticket error:', error);
            this.showToast('Failed to create ticket.', 'error');
        } finally {
            this.setLoading('btn-submit-support-ticket', false);
        }
    }

    openTicketModal() {
        const modal = document.getElementById('create-support-ticket-modal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
        document.getElementById('support-ticket-subject')?.focus();
    }

    closeTicketModal() {
        const modal = document.getElementById('create-support-ticket-modal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        }
        document.getElementById('create-support-ticket-form')?.reset();
        document.getElementById('subject-char-count').textContent = '0/200 characters';
        document.getElementById('description-char-count').textContent = '0/500 characters';
    }

    // Event listeners
    setupEventListeners() {
        // Profile form
        document.getElementById('edit-profile-form')?.addEventListener('submit', (e) => this.saveProfile(e));
        // Password form
        document.getElementById('change-password-form')?.addEventListener('submit', (e) => this.changePassword(e));
        // Verification form
        document.getElementById('verification-request-form')?.addEventListener('submit', (e) => this.submitVerification(e));
        // Ticket form
        document.getElementById('create-support-ticket-form')?.addEventListener('submit', (e) => this.createTicket(e));
        // Chat form is handled by support-ticket-chat.js

        // Password toggles
        this.bindPasswordToggle('toggle-current-password', 'current-password');
        this.bindPasswordToggle('toggle-new-password', 'new-password');
        this.bindPasswordToggle('toggle-confirm-password', 'confirm-password');

        // Document preview
        document.getElementById('verification-document')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('document-preview');
            const img = document.getElementById('document-preview-img');
            if (file && img) {
                const url = URL.createObjectURL(file);
                img.src = url;
                preview.style.display = 'block';
            } else if (preview) {
                preview.style.display = 'none';
            }
        });

        // Stop polling when user leaves page
        window.addEventListener('beforeunload', () => {
            this.stopChatPolling();
            this.stopNotifPolling();
        });

        // Stop polling when tab is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopChatPolling();
                this.stopNotifPolling();
            } else {
                this.startChatPolling();
                this.startNotifPolling();
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            this.startChatPolling();
            this.startNotifPolling();
            this.showToast('Connection restored. Syncing...', 'success');
        });

        window.addEventListener('offline', () => {
            this.stopChatPolling();
            this.stopNotifPolling();
            this.showToast('You are offline. Some features may be limited.', 'warning');
        });

        // Ticket char counters
        document.getElementById('support-ticket-subject')?.addEventListener('input', (e) => {
            document.getElementById('subject-char-count').textContent = `${e.target.value.length}/200 characters`;
        });
        document.getElementById('support-ticket-description')?.addEventListener('input', (e) => {
            document.getElementById('description-char-count').textContent = `${e.target.value.length}/500 characters`;
        });

        // Modal close buttons (Bootstrap handles via data-bs-dismiss, but we also reset form)
        const modal = document.getElementById('create-support-ticket-modal');
        if (modal) {
            modal.addEventListener('hidden.bs.modal', () => {
                document.getElementById('create-support-ticket-form')?.reset();
                document.getElementById('subject-char-count').textContent = '0/200 characters';
                document.getElementById('description-char-count').textContent = '0/500 characters';
            });
        }

        // Create ticket button
        document.getElementById('btn-create-support-ticket')?.addEventListener('click', () => this.openTicketModal());

        // Submit ticket button
        document.getElementById('btn-submit-support-ticket')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.createTicket(e);
        });

        // Chat back
        document.getElementById('support-chat-back-btn')?.addEventListener('click', () => {
            this.showTab('support-tickets');
        });

        // Phone formatting
        document.getElementById('edit-phone')?.addEventListener('input', (e) => {
            e.target.value = this.formatPhoneInputValue(e.target.value);
        });

        // Sidebar toggle - NiceAdmin pattern (body.toggle-sidebar)
        const sidebarToggle = document.getElementById('customer-sidebar-toggle');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.body.classList.toggle('toggle-sidebar');
            });
        }
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                document.body.classList.remove('toggle-sidebar');
            });
        }

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Super admin panel button (if present)
        document.getElementById('super-admin-panel-btn')?.addEventListener('click', () => {
            window.location.href = '/admin.html';
        });
    }

    // Utilities
    setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const spinner = btn.querySelector('.spinner-border');
        const text = btn.querySelector('.btn-text');
        btn.disabled = loading;
        btn.classList.toggle('loading', loading);
        if (spinner) spinner.classList.toggle('d-none', !loading);
        if (text) {
            text.style.opacity = loading ? '0' : '1';
            text.style.visibility = loading ? 'hidden' : 'visible';
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }

    formatPhoneInputValue(value) {
        const digits = String(value).replace(/\D/g, '').replace(/^\+63/, '').slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    async logout() {
        try {
            // Call backend logout endpoint to create audit log
            await fetch(`${this.apiBase}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
        } catch (error) {
            // Continue with logout even if backend call fails
            console.error('Logout API call failed:', error);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    // Verification History
    renderHistoryTimeline() {
        const tableBody = document.getElementById('verification-history-table-body');
        const emptyState = document.getElementById('verification-history-empty');
        const pagination = document.getElementById('verification-history-pagination');
        const infoEl = document.getElementById('verification-history-info');
        const currentEl = document.getElementById('verification-history-current');
        const prevBtn = document.getElementById('verification-history-prev');
        const nextBtn = document.getElementById('verification-history-next');

        if (!this.verificationHistory || this.verificationHistory.length === 0) {
            tableBody.innerHTML = '';
            emptyState.style.display = 'block';
            pagination.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        pagination.style.display = 'flex';

        // Pagination setup
        const itemsPerPage = 5;
        const totalPages = Math.ceil(this.verificationHistory.length / itemsPerPage);
        let currentPage = this._verificationHistoryPage || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = this.verificationHistory.slice(startIndex, endIndex);

        // Render table rows
        const statusBadgeClass = {
            'approved': 'bg-success',
            'rejected': 'bg-danger',
            'pending': 'bg-warning',
            'unverified': 'bg-secondary'
        };

        const rowsHtml = pageData.map(request => {
            const notes = request.admin_notes || request.rejection_reason || '-';
            const badgeClass = statusBadgeClass[request.status] || 'bg-secondary';
            const truncatedNotes = notes.length > 50 ? notes.substring(0, 50) + '...' : notes;
            const isTruncated = notes.length > 50;
            return `
                <tr>
                    <td>${FormatUtil.formatDate(request.created_at)}</td>
                    <td><span class="badge ${badgeClass}">${request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span></td>
                    <td>
                        <span class="notes-text">${truncatedNotes}</span>
                        ${isTruncated ? `<button class="btn btn-sm btn-link p-0 ms-1" onclick="customerAccount.showVerificationNotes('${notes.replace(/'/g, "\\'")}')">View</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rowsHtml;

        // Update pagination UI
        infoEl.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, this.verificationHistory.length)} of ${this.verificationHistory.length}`;
        currentEl.textContent = currentPage;

        prevBtn.classList.toggle('disabled', currentPage === 1);
        nextBtn.classList.toggle('disabled', currentPage === totalPages);

        // Store current page
        this._verificationHistoryPage = currentPage;
    }

    handleVerificationHistoryPagination(direction) {
        const itemsPerPage = 5;
        const totalPages = Math.ceil((this.verificationHistory?.length || 0) / itemsPerPage);
        let currentPage = this._verificationHistoryPage || 1;

        if (direction === 'prev' && currentPage > 1) {
            currentPage--;
        } else if (direction === 'next' && currentPage < totalPages) {
            currentPage++;
        }

        this._verificationHistoryPage = currentPage;
        this.renderHistoryTimeline();
    }

    showVerificationNotes(notes) {
        if (!notes || notes === '-') return;

        // Create modal if it doesn't exist
        let modal = document.getElementById('verification-notes-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'verification-notes-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Admin Notes</h3>
                        <button class="close-btn" onclick="customerAccount.closeVerificationNotesModal()">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p id="verification-notes-content"></p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('verification-notes-content').textContent = notes;
        modal.classList.add('open');
    }

    closeVerificationNotesModal() {
        const modal = document.getElementById('verification-notes-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    }

    // Support Tickets Badge
    async loadSupportTicketsBadge() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/my?limit=100`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) return;
            const data = await response.json();
            this.tickets = data.tickets || [];
            this.updateSupportTicketsBadge();
        } catch (error) {
            console.error('Load support tickets badge error:', error);
        }
    }

    updateSupportTicketsBadge() {
        // Match farmer.js behavior - calculate unread count from array
        const unreadCount = this.tickets.reduce((sum, ticket) => sum + Number(ticket.unread_count || 0), 0);
        
        // Update dropdown badge
        const badge = document.getElementById('support-tickets-dropdown-badge');
        if (badge) {
            if (unreadCount > 0) {
                const displayValue = unreadCount > 99 ? '99+' : String(unreadCount);
                badge.textContent = displayValue;
                badge.style.display = 'inline-block';
                badge.style.minWidth = 'unset';
                badge.style.width = 'auto';
            } else {
                badge.style.display = 'none';
            }
        }
        
        // Update topbar badge (match farmer.js)
        const topbarBadge = document.getElementById('chat-topbar-badge');
        if (topbarBadge) {
            topbarBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            topbarBadge.style.display = unreadCount > 0 ? '' : 'none';
        }
    }

    updateVerificationUI() {
        const btn = document.getElementById('verification-request-btn');
        const menuText = document.getElementById('verification-menu-text');
        const icon = btn?.querySelector('i');

        // Update name field states based on verification status
        const isVerified = this.currentProfile?.is_verified || this.currentVerification?.status === 'approved';
        const nameInputs = ['edit-firstname', 'edit-middlename', 'edit-lastname'];
        const verifiedHint = document.getElementById('edit-name-verified-hint');

        nameInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = isVerified;
            }
        });

        if (verifiedHint) {
            verifiedHint.style.display = isVerified ? 'block' : 'none';
        }

        if (!this.currentVerification) {
            // No request - show button
            if (btn) {
                btn.style.display = '';
                btn.style.removeProperty('display');
            }
            if (menuText) menuText.textContent = 'Request Verification';
            if (icon) {
                icon.className = 'bi bi-shield-check';
            }
        } else {
            const status = this.currentVerification.status;
            if (status === 'pending') {
                if (btn) {
                    btn.style.display = '';
                    btn.style.removeProperty('display');
                }
                if (menuText) menuText.textContent = 'Verification: Pending';
                if (icon) {
                    icon.className = 'bi bi-clock text-warning';
                }
            } else if (status === 'rejected') {
                if (btn) {
                    btn.style.display = '';
                    btn.style.removeProperty('display');
                }
                if (menuText) menuText.textContent = 'Verification: Rejected';
                if (icon) {
                    icon.className = 'bi bi-exclamation-triangle text-danger';
                }
            } else if (status === 'approved') {
                // Verified - remove dropdown item entirely since it's accessible from My Profile
                if (btn) {
                    const parentLi = btn.closest('li');
                    if (parentLi) parentLi.remove();
                }
            }
        }
    }

    async loadMessages() {
        try {
            // Load conversations for dropdown (no loading spinner for polling)
            const res = await fetch(`${this.apiBase}/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const conversations = data.conversations || [];
                this._updateChatHeaderDropdown(conversations);

                // Calculate total unread count
                const unread = conversations.filter(conv => conv.unread_count > 0).length;

                // Update badges
                const topbarBadge = document.getElementById('chat-topbar-badge');
                const unreadCountEl = document.getElementById('chat-unread-count');

                if (topbarBadge) {
                    topbarBadge.textContent = unread > 99 ? '99+' : String(unread);
                    topbarBadge.style.display = unread > 0 ? 'inline-block' : 'none';
                }
                if (unreadCountEl) {
                    unreadCountEl.textContent = unread;
                }
            }
        } catch (err) {
            console.error('Error loading messages:', err);
            this._updateChatHeaderDropdown([], true);
        }
    }

    _updateChatHeaderDropdown(conversations, error = null) {
        const dropdownList = document.getElementById('chat-dropdown-list');
        if (!dropdownList) return;

        if (error) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-danger">Failed to load messages</li>`;
            return;
        }

        const recent = conversations.slice(0, 5);
        if (!recent.length) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-muted">No messages</li>`;
            return;
        }

        dropdownList.innerHTML = recent.map(conv => {
            const farmerName = conv.other_shop_name || conv.other_full_name || conv.other_username || 'Farmer';
            const lastMessage = conv.last_message || 'No messages yet';
            const lastMessageTime = conv.last_message_at ? this._relativeTime(new Date(conv.last_message_at)) : '';
            const unreadCount = conv.unread_count || 0;
            const isUnread = unreadCount > 0;

            return `<li>
                <a class="dropdown-item py-2 chat-dropdown-item ${isUnread ? 'chat-dropdown-item-unread' : ''}" href="/chat.html?conversationId=${this.escapeAttr(conv.conversation_id)}" tabindex="0" style="border:none;padding:0.75rem 1rem;margin:0.25rem 0.5rem;border-radius:8px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="notification-icon-dropdown ${isUnread ? 'notification-icon-unread' : ''}" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.875rem;">
                            <i class="bi bi-person"></i>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div class="small" style="font-weight:${isUnread ? '600' : '500'};color:${isUnread ? '#065f46' : '#111827'};line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(farmerName)}</div>
                            <div style="font-size:0.75rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(lastMessage)}</div>
                            <div style="font-size:0.7rem;color:#9ca3af;">${lastMessageTime}</div>
                        </div>
                        ${isUnread ? `<span class="badge bg-danger" style="font-size:0.65rem;padding:2px 6px;border-radius:10px;">${unreadCount}</span>` : ''}
                    </div>
                </a>
            </li>`;
        }).join('');
    }

    async loadNotifications() {
        try {
            // Load notifications (no loading spinner for polling)
            const limit = 20;
            const res = await fetch(`${this.apiBase}/notifications?page=1&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            const items = data.notifications || data || [];

            this._updateNotifHeaderDropdown(items);

            const unread = items.filter(n => !n.is_read).length;
            const badge = document.getElementById('notif-badge');
            const count = document.getElementById('notif-count');
            if (badge) {
                badge.textContent = unread > 99 ? '99+' : String(unread);
                badge.style.display = unread ? '' : 'none';
            }
            if (count) count.textContent = unread > 99 ? '99+' : String(unread);
        } catch (err) {
            console.error('Error loading notifications:', err);
            this._updateNotifHeaderDropdown([], true);
        }
    }

    _updateNotifHeaderDropdown(items, error = null) {
        const dropdownList = document.getElementById('notif-list');
        if (!dropdownList) return;

        if (error) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-danger">Failed to load notifications</li>`;
            return;
        }

        const recent = items.slice(0, 5);
        if (!recent.length) {
            dropdownList.innerHTML = `<li class="text-center py-2 small text-muted">No notifications</li>`;
            return;
        }
        const iconMap = { order: 'bi-bag-check text-success', product: 'bi-box-seam text-primary', user: 'bi-person text-info', system: 'bi-gear text-secondary' };
        dropdownList.innerHTML = recent.map(n => {
            const ic = iconMap[n.type] || 'bi-bell text-muted';
            const relTime = this._relativeTime(new Date(n.created_at));
            const readStatus = n.is_read ? 'read' : 'unread';
            return `<li>
                <a class="dropdown-item notification-item-dropdown ${readStatus} py-2 notif-header-link" href="#" tabindex="0" style="border:none;padding:0.75rem 1rem;margin:0.25rem 0.5rem;border-radius:8px;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="notification-icon-dropdown" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${n.is_read ? '#f3f4f6' : '#ecfdf5'};color:${n.is_read ? '#6b7280' : '#10b981'};font-size:0.875rem;">
                            <i class="bi ${ic}"></i>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div class="small" style="font-weight:${n.is_read ? '500' : '600'};color:${n.is_read ? '#111827' : '#065f46'};line-height:1.4;">${this.escapeHtml(n.title || 'Notification')}</div>
                            <div style="font-size:0.75rem;color:#9ca3af;">${relTime}</div>
                        </div>
                        ${!n.is_read ? '<div style="width:6px;height:6px;border-radius:50%;background:#10b981;flex-shrink:0;"></div>' : ''}
                    </div>
                </a>
            </li>`;
        }).join('');

        // Add click and keyboard handlers
        dropdownList.querySelectorAll('.notif-header-link').forEach((link, index) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showToast('Notifications view coming soon', 'info');
            });
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.showToast('Notifications view coming soon', 'info');
                }
            });
        });
    }

    _relativeTime(date) {
        if (!date) return '';
        const d = new Date(date);

        // Check for invalid date
        if (isNaN(d.getTime())) return '';

        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}min ago`;

        if (diffHours < 24) return `${diffHours}hr ago`;

        // Check if yesterday (exactly 1 day ago and different calendar day)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString() && diffDays === 1) return 'Yesterday';

        // Days ago (2-6 days)
        if (diffDays < 7) return `${diffDays}d ago`;

        // Weeks ago (7-27 days)
        const diffWeeks = Math.floor(diffDays / 7);
        if (diffWeeks < 4) return `${diffWeeks}w ago`;

        // Months ago (28-364 days)
        const diffMonths = Math.floor(diffDays / 30);
        if (diffDays < 365) {
            return `${Math.max(1, diffMonths)}mo ago`;
        }

        // Years ago (365+ days)
        const diffYears = Math.floor(diffDays / 365);
        return `${Math.max(1, diffYears)}y ago`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttr(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    startChatPolling() {
        if (this.chatPollInterval) {
            clearInterval(this.chatPollInterval);
        }
        this.chatPollFailures = 0;
        this.chatPollInterval = setInterval(() => {
            this.loadMessages().catch(err => {
                this.chatPollFailures++;
                console.error('Chat poll error:', err);
                if (this.chatPollFailures >= 5) {
                    this.stopChatPolling();
                    this.showToast('Unable to load messages. Please refresh the page.', 'warning');
                }
            });
        }, 10000); // Poll every 10 seconds
    }

    stopChatPolling() {
        if (this.chatPollInterval) {
            clearInterval(this.chatPollInterval);
            this.chatPollInterval = null;
        }
        this.chatPollFailures = 0;
    }

    startNotifPolling() {
        if (this.notifPollInterval) {
            clearInterval(this.notifPollInterval);
        }
        this.notifPollFailures = 0;
        this.notifPollInterval = setInterval(() => {
            // Don't poll if user is viewing notifications section to avoid pagination reset
            if (localStorage.getItem('customerActiveSection') === 'notifications') return;
            this.loadNotifications().catch(err => {
                this.notifPollFailures++;
                console.error('Notification poll error:', err);
                if (this.notifPollFailures >= 5) {
                    this.stopNotifPolling();
                    this.showToast('Unable to load notifications. Please refresh the page.', 'warning');
                }
            });
        }, 10000); // Poll every 10 seconds (less frequent than chat)
    }

    stopNotifPolling() {
        if (this.notifPollInterval) {
            clearInterval(this.notifPollInterval);
            this.notifPollInterval = null;
        }
        this.notifPollFailures = 0;
    }

    setupRealtime() {
        try {
            if (!this.token) return;
            const url = `${this.apiBase}/events?token=${encodeURIComponent(this.token)}`;
            const es = new EventSource(url);

            // Listen for new chat messages
            es.addEventListener('chat.message', () => {
                this.loadMessages();
            });

            es.addEventListener('chat.read', () => {
                this.loadMessages();
            });

            // Listen for support ticket messages
            es.addEventListener('support.message', () => {
                this.loadSupportTicketsBadge();
            });

            // Listen for support ticket read events
            es.addEventListener('support.read', () => {
                this.loadSupportTicketsBadge();
            });

            // Listen for new notifications
            es.addEventListener('notification.created', (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.user_id === this.currentProfile?.id) {
                        // Don't reload if user is viewing notifications section to avoid pagination reset
                        if (localStorage.getItem('customerActiveSection') !== 'notifications') {
                            this.loadNotifications();
                        }
                    }
                } catch (e) {
                    // If parsing fails, refresh anyway as fallback (but only if not in notifications section)
                    if (localStorage.getItem('customerActiveSection') !== 'notifications') {
                        this.loadNotifications();
                    }
                }
            });

            // Handle connection errors
            es.addEventListener('error', () => {
                console.error('SSE connection error, will retry');
            });

            // Store for cleanup
            this.eventSource = es;
        } catch (error) {
            console.error('Failed to setup realtime:', error);
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new CustomerAccount();
});

// Verification history pagination event listener
document.addEventListener('click', (e) => {
    const pageLink = e.target.closest('[data-page]');
    if (pageLink && pageLink.closest('#verification-history-pagination')) {
        e.preventDefault();
        const direction = pageLink.dataset.page;
        if (customerAccount && customerAccount.handleVerificationHistoryPagination) {
            customerAccount.handleVerificationHistoryPagination(direction);
        }
    }
});
