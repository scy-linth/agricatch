// Superadmin Dashboard — AgriCatch
'use strict';

window.__PLACEHOLDER_IMAGE__ = window.__PLACEHOLDER_IMAGE__ || '/images/resendlogo.png';

class SuperAdminDashboard {
    constructor() {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';
        const isCustomHost = host === 'agricatch.store' || host === 'www.agricatch.store' ||
            host.includes('agricatch.store') || host === 'agricatch.page.dev';
        this.apiBase = window.API_BASE ||
            (isLocal ? 'http://localhost:3000/api' :
             isCustomHost ? 'https://agricatch.onrender.com/api' : '/api');
        try { if (!window.API_BASE) window.API_BASE = this.apiBase; } catch (_) {}

        this.token = localStorage.getItem('token');
        this.activeSection = 'overview';
        this._currentUser = null;
        this._editMode = false;
        this._editUserId = null;
        this._usersCache = {}; // id → user object

        this.pagination = {
            staff:   { page: 1, limit: 25, total: 0 },
            users:   { page: 1, limit: 25, total: 0 },
            seclog:  { page: 1, limit: 50, total: 0 },
        };

        this._loadedSections = {};

        if (!this.token) {
            window.location.href = '/?login=1';
            return;
        }

        this._init();
    }

    // ── Initialisation ─────────────────────────────────────────────────────────

    async _init() {
        try {
            const res = await fetch(`${this.apiBase}/auth/profile`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error('unauthenticated');
            const data = await res.json();
            const user = data.user || data;

            if (user.role !== 'super_admin') {
                // Redirect staff to admin panel, anyone else to homepage
                window.location.href = ['staff'].includes(user.role) ? '/admin.html' : '/';
                return;
            }

            this._currentUser = user;
            document.getElementById('sa-user-name').textContent = user.full_name || user.username || 'Superadmin';
            document.getElementById('sa-user-email').textContent = user.email || '';
            const initials = (user.full_name || user.username || 'SA').slice(0, 2).toUpperCase();
            document.getElementById('sa-avatar-initials').textContent = initials;
        } catch (_) {
            window.location.href = '/?login=1';
            return;
        }

        this._bindNav();
        this._bindSidebar();
        this._bindLogout();
        this._bindUserModal();
        this._bindButtons();
        this.loadOverview();
    }

    // ── Navigation ─────────────────────────────────────────────────────────────

    _bindNav() {
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });
    }

    _bindSidebar() {
        const overlay = document.getElementById('sa-sidebar-overlay');
        const toggle  = document.getElementById('sa-mobile-menu-toggle');
        const sidebar = document.getElementById('sa-sidebar');
        toggle?.addEventListener('click', () => {
            sidebar?.classList.toggle('open');
            overlay?.classList.toggle('active');
        });
        overlay?.addEventListener('click', () => {
            sidebar?.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    _bindLogout() {
        document.getElementById('sa-logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/';
        });
    }

    showSection(name) {
        document.querySelectorAll('.admin-section-card').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('[data-section]').forEach(l => l.classList.remove('active'));

        document.getElementById(name)?.classList.add('active');
        document.querySelector(`[data-section="${name}"]`)?.classList.add('active');

        const titles = {
            overview:         'Overview',
            staff:            'Staff Management',
            users:            'All Users',
            settings:         'Platform Settings',
            'security-log':   'Security Log',
            'feature-flags':  'Feature Flags',
        };
        document.getElementById('sa-page-title').textContent = titles[name] || name;
        this.activeSection = name;

        // Lazy-load on first visit
        if (name === 'staff'           && !this._loadedSections.staff)    { this._loadedSections.staff    = true; this.loadStaff(); }
        if (name === 'users'           && !this._loadedSections.users)    { this._loadedSections.users    = true; this.loadAllUsers(); }
        if (name === 'settings'        && !this._loadedSections.settings) { this._loadedSections.settings = true; this.loadSettings(); }
        if (name === 'security-log'    && !this._loadedSections.seclog)   { this._loadedSections.seclog   = true; this.loadSecurityLog(); }
        if (name === 'feature-flags'   && !this._loadedSections.flags)    { this._loadedSections.flags    = true; this.loadFeatureFlags(); }
    }

    // ── Toast ──────────────────────────────────────────────────────────────────

    showToast(message, type = 'info') {
        const stack = document.getElementById('sa-toast-stack');
        if (!stack) return;
        const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
        const toast = document.createElement('div');
        toast.className = `admin-toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this._escHtml(message)}</span>`;
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        const dismiss = () => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        };
        toast.addEventListener('click', dismiss);
        setTimeout(dismiss, 3500);
    }

    // ── Confirm Dialog ─────────────────────────────────────────────────────────

    saConfirm(message, { title = 'Are you sure?', danger = true, okLabel = 'Confirm' } = {}) {
        return new Promise(resolve => {
            const modal = document.getElementById('sa-confirm-modal');
            if (!modal) {
                console.warn('[saConfirm] Confirm modal not found — rejecting action');
                return resolve(false);
            }

            document.getElementById('sa-confirm-title').textContent   = title;
            document.getElementById('sa-confirm-message').textContent = message;
            const icon = document.getElementById('sa-confirm-icon');
            icon.className = `confirm-modal-icon ${danger ? 'danger' : 'info'}`;
            icon.innerHTML = `<i class="fas ${danger ? 'fa-exclamation-triangle' : 'fa-circle-info'}"></i>`;

            const okBtn = document.getElementById('sa-confirm-ok-btn');
            okBtn.textContent = okLabel;
            okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
            modal.classList.add('open');

            // Clone to remove old listeners
            const newOk     = okBtn.replaceWith(okBtn.cloneNode(true)) || document.getElementById('sa-confirm-ok-btn');
            const cancelEl  = document.getElementById('sa-confirm-cancel-btn');
            const newCancel = cancelEl.replaceWith(cancelEl.cloneNode(true)) || document.getElementById('sa-confirm-cancel-btn');

            const close = result => { modal.classList.remove('open'); resolve(result); };
            document.getElementById('sa-confirm-ok-btn').addEventListener('click',     () => close(true));
            document.getElementById('sa-confirm-cancel-btn').addEventListener('click', () => close(false));
        });
    }

    // ── Overview ───────────────────────────────────────────────────────────────

    async loadOverview() {
        try {
            const res = await fetch(`${this.apiBase}/superadmin/overview`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const summary = data.summary || {};
            document.getElementById('ov-staff-count').textContent = summary.staff_count ?? '–';
            document.getElementById('ov-farmer-count').textContent = summary.farmer_count ?? '–';
            document.getElementById('ov-pending-count').textContent = summary.pending_verifications ?? '–';
            document.getElementById('ov-orders-today').textContent = summary.orders_today ?? '–';
            document.getElementById('ov-customer-count').textContent = summary.customer_count ?? '–';
            document.getElementById('ov-total-count').textContent = summary.total_users ?? '–';
            this._renderActivityTable(data.logs || []);
        } catch (err) {
            console.error('Overview load error:', err);
        }
    }

    _renderActivityTable(logs) {
        const tbody = document.getElementById('ov-activity-tbody');
        if (!tbody) return;
        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No recent security events</td></tr>`;
            return;
        }
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td style="white-space:nowrap;">${this._fmtDate(log.created_at)}</td>
                <td>${this._escHtml(log.actor_admin_name || log.actor_admin_email || `#${log.actor_admin_id}`)}</td>
                <td><code>${this._escHtml(log.action)}</code></td>
                <td>${this._escHtml(log.entity)}${log.entity_id ? ` #${log.entity_id}` : ''}</td>
                <td style="font-size:0.8em;color:var(--admin-text-muted,#64748b);">${this._escHtml(log.ip_address || '–')}</td>
            </tr>
        `).join('');
    }

    async sendAnnouncement() {
        const titleEl = document.getElementById('announcement-title');
        const messageEl = document.getElementById('announcement-message');
        const audienceEl = document.getElementById('announcement-audience');
        const sendBtn = document.getElementById('send-announcement-btn');
        const title = String(titleEl?.value || '').trim();
        const message = String(messageEl?.value || '').trim();
        const audience = String(audienceEl?.value || 'farmer').trim();

        if (!title || !message) {
            this.showToast('Announcement title and message are required.', 'error');
            return;
        }

        try {
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<span class="admin-spinner"></span> Sending';
            }
            const res = await fetch(`${this.apiBase}/superadmin/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}`
                },
                body: JSON.stringify({ title, message, audience })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

            if (titleEl) titleEl.value = '';
            if (messageEl) messageEl.value = '';
            this.showToast(`Announcement sent to ${data.recipients || 0} user(s).`, 'success');
            this.loadOverview();
        } catch (err) {
            this.showToast(`Failed to send announcement: ${err.message}`, 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-bullhorn"></i> Send Announcement';
            }
        }
    }

    // ── Staff ──────────────────────────────────────────────────────────────────

    async loadStaff(page = 1) {
        const pg = this.pagination.staff;
        pg.page = page;
        const tbody = document.getElementById('staff-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6"><span class="admin-spinner"></span></td></tr>`;
        try {
            const res = await fetch(`${this.apiBase}/superadmin/staff?page=${page}&limit=${pg.limit}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            pg.total = data.total || 0;
            (data.staff || []).forEach(u => { this._usersCache[u.id] = u; });
            this._renderStaffTable(data.staff || []);
            this.renderPagination('staff-pagination', pg, p => this.loadStaff(p));
        } catch (err) {
            this.showToast('Failed to load staff: ' + err.message, 'error');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load staff</td></tr>`;
        }
    }

    _renderStaffTable(users) {
        const tbody = document.getElementById('staff-tbody');
        if (!tbody) return;
        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No staff accounts found</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(u => {
            const initials = (u.full_name || u.username || '?').slice(0, 2).toUpperCase();
            const isSelf   = u.id === this._currentUser?.id;
            return `<tr>
                <td>${u.id}</td>
                <td>
                    <div class="user-cell">
                        <div class="user-initials">${this._escHtml(initials)}</div>
                        <div>
                            <div class="user-cell-name">${this._escHtml(u.full_name || u.username)}</div>
                            <div class="user-cell-sub">${this._escHtml(u.username)} · ${this._escHtml(u.email)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-role-${u.role}">${this._escHtml(u.role)}</span></td>
                <td>${u.is_disabled
                    ? '<span class="badge badge-cancelled">Disabled</span>'
                    : '<span class="badge badge-active">Active</span>'}</td>
                <td style="white-space:nowrap;">${this._fmtDate(u.created_at)}</td>
                <td>
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-ghost-primary" onclick="window._sa.openEditUser(${u.id})">Edit</button>
                        ${!isSelf
                            ? `<button class="btn btn-sm btn-ghost-danger"
                                onclick="window._sa.${u.is_disabled ? 'enableUser' : 'disableUser'}(${u.id})">
                                ${u.is_disabled ? 'Enable' : 'Disable'}</button>`
                            : `<span style="font-size:0.8em;color:var(--admin-text-muted,#94a3b8);">You</span>`}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ── All Users ──────────────────────────────────────────────────────────────

    async loadAllUsers(page = 1) {
        const pg = this.pagination.users;
        pg.page = page;
        const tbody = document.getElementById('all-users-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6"><span class="admin-spinner"></span></td></tr>`;

        const roleFilter = document.getElementById('users-role-filter')?.value || '';
        const url = `${this.apiBase}/admin/users?page=${page}&limit=${pg.limit}${roleFilter ? `&role=${encodeURIComponent(roleFilter)}` : ''}`;
        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            pg.total = data.total || 0;
            (data.users || []).forEach(u => { this._usersCache[u.id] = u; });
            this._renderAllUsersTable(data.users || []);
            this.renderPagination('all-users-pagination', pg, p => this.loadAllUsers(p));
        } catch (err) {
            this.showToast('Failed to load users: ' + err.message, 'error');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load users</td></tr>`;
        }
    }

    _renderAllUsersTable(users) {
        const tbody = document.getElementById('all-users-tbody');
        if (!tbody) return;
        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No users found</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(u => {
            const initials = (u.full_name || u.username || '?').slice(0, 2).toUpperCase();
            const isSelf   = u.id === this._currentUser?.id;
            return `<tr>
                <td>${u.id}</td>
                <td>
                    <div class="user-cell">
                        <div class="user-initials">${this._escHtml(initials)}</div>
                        <div>
                            <div class="user-cell-name">${this._escHtml(u.full_name || u.username)}</div>
                            <div class="user-cell-sub">${this._escHtml(u.email)}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-role-${u.role}">${this._escHtml(u.role)}</span></td>
                <td>${u.is_disabled
                    ? '<span class="badge badge-cancelled">Disabled</span>'
                    : '<span class="badge badge-active">Active</span>'}</td>
                <td style="white-space:nowrap;">${this._fmtDate(u.created_at)}</td>
                <td>
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-ghost-primary" onclick="window._sa.openEditUser(${u.id})">Edit</button>
                        ${!isSelf
                            ? `<button class="btn btn-sm btn-ghost-danger"
                                onclick="window._sa.${u.is_disabled ? 'enableUser' : 'disableUser'}(${u.id})">
                                ${u.is_disabled ? 'Enable' : 'Disable'}</button>`
                            : `<span style="font-size:0.8em;color:var(--admin-text-muted,#94a3b8);">You</span>`}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ── User Modal ─────────────────────────────────────────────────────────────

    _bindUserModal() {
        document.getElementById('sa-user-modal-close')?.addEventListener('click',  () => this._closeUserModal());
        document.getElementById('sa-user-modal-cancel')?.addEventListener('click', () => this._closeUserModal());
        document.getElementById('sa-user-pw-toggle')?.addEventListener('click', () => {
            const inp = document.getElementById('sa-user-password');
            if (!inp) return;
            const hide = inp.type === 'password';
            inp.type = hide ? 'text' : 'password';
            document.getElementById('sa-user-pw-toggle').innerHTML = `<i class="fas ${hide ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
        });
        document.getElementById('sa-user-form')?.addEventListener('submit', e => {
            e.preventDefault();
            this._submitUserForm();
        });
    }

    _bindButtons() {
        document.getElementById('create-staff-btn')?.addEventListener('click',    () => this.openCreateUser('staff'));
        document.getElementById('create-any-user-btn')?.addEventListener('click', () => this.openCreateUser(''));
        document.getElementById('users-role-filter')?.addEventListener('change',  () => {
            this._loadedSections.users = true;
            this.loadAllUsers(1);
        });
        document.getElementById('ov-refresh-btn')?.addEventListener('click',      () => this.loadOverview());
        document.getElementById('send-announcement-btn')?.addEventListener('click', () => this.sendAnnouncement());
        document.getElementById('seclog-refresh-btn')?.addEventListener('click',  () => this.loadSecurityLog(1));
        document.getElementById('flags-refresh-btn')?.addEventListener('click',   () => this.loadFeatureFlags());
        document.getElementById('save-settings-btn')?.addEventListener('click',   () => this.saveSettings());
    }

    openCreateUser(defaultRole = '') {
        this._editMode   = false;
        this._editUserId = null;
        document.getElementById('sa-user-modal-title').textContent  = 'Create New User';
        document.getElementById('sa-user-modal-save').textContent   = 'Create User';
        document.getElementById('sa-user-id').value          = '';
        document.getElementById('sa-user-firstname').value   = '';
        document.getElementById('sa-user-middlename').value  = '';
        document.getElementById('sa-user-lastname').value    = '';
        document.getElementById('sa-user-username').value    = '';
        document.getElementById('sa-user-email').value       = '';
        document.getElementById('sa-user-password').value    = '';
        document.getElementById('sa-user-role').value        = defaultRole;
        document.getElementById('sa-user-pw-required-label').style.display = '';
        document.getElementById('sa-user-pw-optional-label').style.display = 'none';
        this._clearUserError();
        document.getElementById('sa-user-modal').classList.add('open');
    }

    openEditUser(userId) {
        const user = this._usersCache[userId];
        this._editMode   = true;
        this._editUserId = userId;
        document.getElementById('sa-user-modal-title').textContent = `Edit User #${userId}`;
        document.getElementById('sa-user-modal-save').textContent  = 'Save Changes';
        document.getElementById('sa-user-id').value          = userId;
        document.getElementById('sa-user-firstname').value   = user?.first_name  || '';
        document.getElementById('sa-user-middlename').value  = user?.middle_name || '';
        document.getElementById('sa-user-lastname').value    = user?.last_name   || '';
        document.getElementById('sa-user-username').value    = user?.username    || '';
        document.getElementById('sa-user-email').value       = user?.email       || '';
        document.getElementById('sa-user-password').value    = '';
        document.getElementById('sa-user-role').value        = user?.role        || '';
        document.getElementById('sa-user-pw-required-label').style.display = 'none';
        document.getElementById('sa-user-pw-optional-label').style.display = '';
        this._clearUserError();
        document.getElementById('sa-user-modal').classList.add('open');
    }

    _closeUserModal() {
        document.getElementById('sa-user-modal').classList.remove('open');
    }

    _clearUserError() {
        const el = document.getElementById('sa-user-error');
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    }

    _showUserError(msg) {
        const el = document.getElementById('sa-user-error');
        if (el) { el.style.display = ''; el.textContent = msg; }
    }

    async _submitUserForm() {
        const first_name  = document.getElementById('sa-user-firstname').value.trim();
        const middle_name = document.getElementById('sa-user-middlename').value.trim();
        const last_name   = document.getElementById('sa-user-lastname').value.trim();
        const username    = document.getElementById('sa-user-username').value.trim();
        const email       = document.getElementById('sa-user-email').value.trim();
        const password    = document.getElementById('sa-user-password').value;
        const role        = document.getElementById('sa-user-role').value;

        if (!username || !email || !role) {
            this._showUserError('Username, email, and role are required.');
            return;
        }
        if (!this._editMode && !password) {
            this._showUserError('Password is required when creating a new account.');
            return;
        }
        if (password && password.length < 8) {
            this._showUserError('Password must be at least 8 characters.');
            return;
        }

        const fullName   = [first_name, middle_name, last_name].filter(Boolean).join(' ') || username;
        const maskedPw   = password ? '•'.repeat(Math.min(password.length, 12)) : '(unchanged)';
        const confirmed  = await this.saConfirm(
            `${this._editMode ? 'Save changes for' : 'Create account for'} ${fullName} (${email}) as ${role}?${password ? '\nPassword: ' + maskedPw : ''}`,
            { title: this._editMode ? 'Save user changes?' : 'Create user?', danger: false, okLabel: this._editMode ? 'Save' : 'Create' }
        );
        if (!confirmed) return;

        const payload = { first_name, middle_name, last_name, username, email, role };
        if (password) payload.password = password;

        const saveBtn = document.getElementById('sa-user-modal-save');
        saveBtn.disabled    = true;
        saveBtn.textContent = this._editMode ? 'Saving…' : 'Creating…';
        this._clearUserError();

        try {
            const url    = this._editMode
                ? `${this.apiBase}/superadmin/users/${this._editUserId}`
                : `${this.apiBase}/superadmin/users`;
            const method = this._editMode ? 'PUT' : 'POST';
            const res    = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) { this._showUserError(data.message || 'Operation failed'); return; }

            this.showToast(this._editMode ? 'User updated' : 'User created', 'success');
            this._closeUserModal();
            this._refreshCurrentList();
        } catch (err) {
            this._showUserError('Network error: ' + err.message);
        } finally {
            saveBtn.disabled    = false;
            saveBtn.textContent = this._editMode ? 'Save Changes' : 'Create User';
        }
    }

    async disableUser(userId) {
        const ok = await this.saConfirm('This will prevent the user from logging in.', {
            title: 'Disable this account?', danger: true, okLabel: 'Disable'
        });
        if (!ok) return;
        try {
            const res  = await fetch(`${this.apiBase}/superadmin/users/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${this.token}` },
            });
            const data = await res.json();
            if (!res.ok) { this.showToast(data.message || 'Failed to disable', 'error'); return; }
            this.showToast('Account disabled', 'success');
            this._refreshCurrentList();
        } catch (_) {
            this.showToast('Network error', 'error');
        }
    }

    async enableUser(userId) {
        const ok = await this.saConfirm('Re-enable this user\'s account?', {
            title: 'Enable account?', danger: false, okLabel: 'Enable'
        });
        if (!ok) return;
        try {
            const res  = await fetch(`${this.apiBase}/admin/users/${userId}/enable`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${this.token}` },
            });
            const data = await res.json();
            if (!res.ok) { this.showToast(data.message || 'Failed to enable', 'error'); return; }
            this.showToast('Account enabled', 'success');
            this._refreshCurrentList();
        } catch (_) {
            this.showToast('Network error', 'error');
        }
    }

    _refreshCurrentList() {
        if (this.activeSection === 'staff') {
            this._loadedSections.staff = false;
            this.loadStaff(this.pagination.staff.page);
        } else if (this.activeSection === 'users') {
            this._loadedSections.users = false;
            this.loadAllUsers(this.pagination.users.page);
        }
    }

    // ── Platform Settings ──────────────────────────────────────────────────────

    static get SETTING_PRESETS() {
        return [
            { key: 'maintenance_mode',         label: 'Maintenance Mode',          type: 'toggle', default: 'false', description: 'When enabled, only super_admin can access the site.' },
            { key: 'allow_new_registrations',  label: 'Allow New Registrations',   type: 'toggle', default: 'true',  description: 'Allow customers and farmers to register new accounts.' },
            { key: 'delivery_fee',             label: 'Delivery Fee (₱)',          type: 'number', default: '35',    description: 'Fixed delivery fee charged at checkout.' },
            { key: 'platform_name',            label: 'Platform Name',             type: 'text',   default: 'AgriCatch', description: 'Displayed in the app header and notification emails.' },
            { key: 'max_products_per_farmer',  label: 'Max Products per Farmer',   type: 'number', default: '0',    description: 'Maximum active listings per farmer. Set to 0 for no limit.' },
            { key: 'max_order_quantity',       label: 'Max Quantity per Order',    type: 'number', default: '100',  description: 'Maximum item quantity allowed in a single order.' },
        ];
    }

    async loadSettings() {
        const form = document.getElementById('settings-form');
        if (!form) return;
        form.innerHTML = `<div class="section-loading"><span class="admin-spinner"></span></div>`;
        try {
            const res  = await fetch(`${this.apiBase}/superadmin/settings`, { headers: { Authorization: `Bearer ${this.token}` } });
            const data = res.ok ? await res.json() : { settings: {} };
            const db   = data.settings || {};

            form.innerHTML = SuperAdminDashboard.SETTING_PRESETS.map(p => {
                const current = db[p.key]?.value ?? p.default;
                if (p.type === 'toggle') {
                    const checked = current === 'true' || current === true;
                    return `<div class="form-group" style="max-width:640px;padding:1rem;border:1px solid var(--admin-border,#e2e8f0);border-radius:10px;margin-bottom:0.75rem;">
                        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;">
                            <div>
                                <div class="form-label" style="margin-bottom:0.2rem;">${this._escHtml(p.label)}</div>
                                <div class="form-hint" style="margin:0;">${this._escHtml(p.description)}</div>
                            </div>
                            <label style="flex-shrink:0;display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding-top:0.1rem;">
                                <input type="checkbox" id="setting-${p.key}" data-setting-key="${p.key}" data-setting-type="toggle"
                                    ${checked ? 'checked' : ''} style="width:auto;cursor:pointer;">
                                <span style="font-size:0.85em;color:var(--admin-text-muted,#64748b);min-width:24px;"
                                    id="setting-${p.key}-label">${checked ? 'On' : 'Off'}</span>
                            </label>
                        </div>
                    </div>`;
                }
                return `<div class="form-group" style="max-width:640px;padding:1rem;border:1px solid var(--admin-border,#e2e8f0);border-radius:10px;margin-bottom:0.75rem;">
                    <label class="form-label" for="setting-${p.key}">${this._escHtml(p.label)}</label>
                    <p class="form-hint" style="margin-bottom:0.4rem;">${this._escHtml(p.description)}</p>
                    <input type="${p.type === 'number' ? 'number' : 'text'}" id="setting-${p.key}"
                        class="form-control" value="${this._escHtml(String(current))}"
                        data-setting-key="${p.key}" data-setting-type="${p.type}"
                        style="max-width:320px;"
                        ${p.type === 'number' ? 'min="0"' : ''}>
                </div>`;
            }).join('');

            form.querySelectorAll('[data-setting-type="toggle"]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const lbl = document.getElementById(`setting-${cb.dataset.settingKey}-label`);
                    if (lbl) lbl.textContent = cb.checked ? 'On' : 'Off';
                });
            });
        } catch (err) {
            form.innerHTML = `<div class="alert-danger">Failed to load settings: ${this._escHtml(err.message)}</div>`;
        }
    }

    async saveSettings() {
        const updates = {};
        document.querySelectorAll('[data-setting-key]').forEach(el => {
            updates[el.dataset.settingKey] = el.type === 'checkbox' ? String(el.checked) : el.value.trim();
        });
        if (!Object.keys(updates).length) { this.showToast('No settings to save', 'info'); return; }

        const btn = document.getElementById('save-settings-btn');
        btn.disabled    = true;
        btn.textContent = 'Saving…';
        try {
            const res  = await fetch(`${this.apiBase}/superadmin/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
                body: JSON.stringify(updates),
            });
            const data = await res.json();
            if (!res.ok) { this.showToast(data.message || 'Save failed', 'error'); return; }
            this.showToast('Settings saved', 'success');
            this._loadedSections.settings = false;
            this.loadSettings();
        } catch (err) {
            this.showToast('Network error: ' + err.message, 'error');
        } finally {
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save All';
        }
    }

    // ── Security Log ────────────────────────────────────────────────────────────

    async loadSecurityLog(page = 1) {
        const pg = this.pagination.seclog;
        pg.page = page;
        const tbody = document.getElementById('seclog-tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6"><span class="admin-spinner"></span></td></tr>`;
        try {
            const res = await fetch(`${this.apiBase}/superadmin/security-log?page=${page}&limit=${pg.limit}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            pg.total = data.total || 0;
            this._renderSeclog(data.logs || []);
            this.renderPagination('seclog-pagination', pg, p => this.loadSecurityLog(p));
        } catch (err) {
            this.showToast('Failed to load security log: ' + err.message, 'error');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Failed to load</td></tr>`;
        }
    }

    _renderSeclog(logs) {
        const tbody = document.getElementById('seclog-tbody');
        if (!tbody) return;
        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No security events found</td></tr>`;
            return;
        }
        const actionColour = {
            'user.create': '#10b981', 'user.disable': '#ef4444', 'user.enable': '#10b981',
            'user.role_change': '#f59e0b', 'user.password_reset': '#f59e0b',
            'login.failed': '#ef4444', 'login.success': '#10b981',
            'auth.recover_admin': '#8b5cf6', 'settings.update': '#3b82f6',
        };
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td style="white-space:nowrap;">${this._fmtDate(log.created_at)}</td>
                <td>${this._escHtml(log.actor_admin_name || log.actor_admin_email || `#${log.actor_admin_id}`)}</td>
                <td><code style="color:${actionColour[log.action] || '#334155'};">${this._escHtml(log.action)}</code></td>
                <td>${this._escHtml(log.entity)}${log.entity_id ? ` #${log.entity_id}` : ''}</td>
                <td style="font-size:0.8em;">${this._escHtml(log.ip_address || '–')}</td>
                <td style="font-size:0.75em;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                    title="${this._escHtml(log.user_agent || '')}">
                    ${this._escHtml((log.user_agent || '–').slice(0, 60))}
                </td>
            </tr>
        `).join('');
    }

    // ── Feature Flags ───────────────────────────────────────────────────────────

    async loadFeatureFlags() {
        const container = document.getElementById('feature-flags-list');
        if (!container) return;
        container.innerHTML = '<div style="text-align:center;padding:32px;color:#6b7280;"><span class="admin-spinner"></span></div>';
        try {
            const res = await fetch(`${this.apiBase}/superadmin/flags`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this._renderFlags(data.flags || []);
        } catch (err) {
            container.innerHTML = '<p style="color:#ef4444;padding:16px;">Failed to load feature flags.</p>';
            console.error('[SA] loadFeatureFlags error:', err);
        }
    }

    _renderFlags(flags) {
        const container = document.getElementById('feature-flags-list');
        if (!container) return;
        if (!flags.length) {
            container.innerHTML = '<p style="color:#6b7280;padding:16px;">No feature flags configured.</p>';
            return;
        }
        container.innerHTML = flags.map(f => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;gap:12px;flex-wrap:wrap;">
                <div>
                    <div style="font-weight:600;font-size:0.95rem;color:var(--text,#111827);">${this._escHtml(f.name)}</div>
                    ${f.description ? `<div style="font-size:0.82rem;color:var(--text-muted,#6b7280);margin-top:2px;">${this._escHtml(f.description)}</div>` : ''}
                </div>
                <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;" title="${f.enabled ? 'Enabled' : 'Disabled'}">
                    <input type="checkbox" class="flag-toggle" data-key="${this._escHtml(f.key)}" ${f.enabled ? 'checked' : ''}
                        style="width:1.1rem;height:1.1rem;accent-color:#16a34a;cursor:pointer;">
                    <span style="font-size:0.88rem;color:${f.enabled ? '#16a34a' : '#9ca3af'};font-weight:600;">${f.enabled ? 'On' : 'Off'}</span>
                </label>
            </div>
        `).join('');

        container.querySelectorAll('.flag-toggle').forEach(toggle => {
            toggle.addEventListener('change', async () => {
                const key = toggle.dataset.key;
                const enabled = toggle.checked;
                const label = toggle.closest('div').querySelector('span');
                try {
                    const res = await fetch(`${this.apiBase}/superadmin/flags/${encodeURIComponent(key)}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${this.token}`
                        },
                        body: JSON.stringify({ enabled })
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    if (label) {
                        label.textContent = enabled ? 'On' : 'Off';
                        label.style.color = enabled ? '#16a34a' : '#9ca3af';
                    }
                    this.showToast(`Flag "${key}" ${enabled ? 'enabled' : 'disabled'}.`, 'success');
                } catch (err) {
                    toggle.checked = !enabled; // revert
                    if (label) { label.textContent = !enabled ? 'On' : 'Off'; label.style.color = !enabled ? '#16a34a' : '#9ca3af'; }
                    this.showToast('Failed to update flag: ' + err.message, 'error');
                }
            });
        });
    }

    // ── Pagination ─────────────────────────────────────────────────────────────

    renderPagination(containerId, pg, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const { page, limit, total } = pg;
        const totalPages = Math.max(Math.ceil(total / limit), 1);
        const from = total === 0 ? 0 : (page - 1) * limit + 1;
        const to   = Math.min(page * limit, total);
        if (total === 0) { container.innerHTML = ''; return; }

        const addedPages = new Set();
        const pageNums = [];
        [1, 2, page - 1, page, page + 1, totalPages - 1, totalPages].forEach(p => {
            if (p >= 1 && p <= totalPages && !addedPages.has(p)) { addedPages.add(p); pageNums.push(p); }
        });
        pageNums.sort((a, b) => a - b);

        let btns = '', prev = 0;
        for (const p of pageNums) {
            if (p - prev > 1) btns += `<span class="page-btn" style="opacity:0.4;padding:0 4px;">…</span>`;
            btns += `<button class="page-btn${p === page ? ' active' : ''}" data-page="${p}">${p}</button>`;
            prev = p;
        }

        container.innerHTML = `
            <div class="pagination-info">Showing ${from}–${to} of ${total}</div>
            <div class="pagination-controls">
                <button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                ${btns}
                <button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
        container.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page, 10);
                if (p >= 1 && p <= totalPages) onPageChange(p);
            });
        });
    }

    // ── Utilities ──────────────────────────────────────────────────────────────

    _escHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _fmtDate(dateStr) {
        if (!dateStr) return '–';
        try {
            const d = new Date(dateStr);
            if (isNaN(d)) return String(dateStr);
            return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (_) { return String(dateStr); }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window._sa = new SuperAdminDashboard();
});
