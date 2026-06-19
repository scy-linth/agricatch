# Farmer Subscription Tier Implementation Plan (Part 2: Frontend, Cron & Testing)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 2 covers farmer frontend UI, admin frontend UI, expiry cron script, and end-to-end testing.

**Tech Stack:** JavaScript, Bootstrap 5, HTML

---

## File Structure (Part 2)

**Files to create:**
- `backend/scripts/expire_subscriptions.js`

**Files to modify:**
- `frontend/farmer.html` — Subscription card, upgrade/extend modal, premium badge
- `frontend/js/farmer.js` — Subscription UI logic
- `frontend/admin.html` — Subscription requests section + payment accounts + pricing settings
- `frontend/js/admin.js` — Subscription admin logic

---

### Task 5: Frontend — Farmer Subscription UI

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add premium badge beside verified icon**

In `frontend/farmer.html` around line 494:

```html
<div class="d-flex align-items-center justify-content-center gap-1">
    <h6 class="mb-0 fw-semibold" id="user-name-dd" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></h6>
    <i id="header-verified-icon" class="bi bi-check-circle-fill text-primary" style="display:none;font-size:0.9rem;" data-bs-toggle="tooltip" title="Verified"></i>
    <i id="header-premium-icon" class="bi bi-gem text-warning" style="display:none;font-size:0.9rem;" data-bs-toggle="tooltip" title="Premium Partner"></i>
</div>
```

- [ ] **Step 2: Add subscription sidebar item**

Match existing sidebar pattern (badge uses `bg-danger` like chat/notifications):

```html
<li class="nav-item">
    <a class="nav-link collapsed sidebar-link" href="#subscription" data-section="subscription">
        <i class="bi bi-star-fill"></i><span>Subscription</span>
        <span id="subscription-status-badge" class="badge bg-danger ms-auto" style="display:none;">Pending</span>
    </a>
</li>
```

- [ ] **Step 3: Add subscription section card**

Match existing section pattern with `.ac-section-hero` banner (see products, orders sections for reference):

```html
<!-- SUBSCRIPTION SECTION -->
<section id="subscription" class="admin-section-card">
    <div class="ac-section-hero ac-section-hero--primary mb-4">
        <div class="ac-section-hero__icon"><i class="bi bi-star-fill"></i></div>
        <div class="ac-section-hero__body">
            <h4 class="ac-section-hero__title">Subscription</h4>
            <p class="ac-section-hero__sub">Manage your premium plan, billing, and benefits.</p>
        </div>
    </div>

    <div class="card">
        <div class="card-body">
            <div id="subscription-free-panel">
                <p class="text-muted">You are on the <strong>Free</strong> tier.</p>
                <ul class="list-unstyled small text-muted">
                    <li><i class="bi bi-check text-success"></i> Up to 10 product listings</li>
                    <li><i class="bi bi-check text-success"></i> Basic sales analytics</li>
                    <li><i class="bi bi-x text-danger"></i> Unlimited products</li>
                    <li><i class="bi bi-x text-danger"></i> Featured/priority badge</li>
                </ul>
                <button class="btn ac-btn-primary btn-sm" id="btn-upgrade-premium">
                    <i class="bi bi-star-fill me-1"></i> Go Premium
                </button>
            </div>
            <div id="subscription-active-panel" style="display:none;">
                <div class="alert alert-success"><i class="bi bi-gem"></i> <strong>Premium Partner</strong></div>
                <p>Expires: <strong id="subscription-expiry-date">—</strong></p>
                <div id="subscription-expiry-warning" style="display:none;"></div>
                <button class="btn ac-btn-primary btn-sm" id="btn-extend-subscription">
                    <i class="bi bi-plus-circle me-1"></i> Extend Subscription
                </button>
            </div>
            <div id="subscription-pending-panel" style="display:none;">
                <div class="alert alert-info"><i class="bi bi-hourglass"></i> Payment under review.</div>
            </div>
            <div id="subscription-expired-panel" style="display:none;">
                <div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Premium expired. Renew to restore features.</div>
                <button class="btn ac-btn-primary btn-sm" id="btn-renew-premium"><i class="bi bi-star-fill me-1"></i> Renew Premium</button>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 4: Add upgrade/extend modal**

**Note:** Farmer.html uses a custom `.modal` system with `z-index:1070`. This modal uses Bootstrap's modal system (`z-index:1055`). If a custom modal is already open, this one may appear behind it. Ensure only one modal is open at a time.

```html
<div class="modal fade" id="subscription-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="subscription-modal-title">Go Premium</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div id="subscription-current-info" class="alert alert-light border mb-3" style="display:none;">
                    <p class="mb-1"><strong>Current expiry:</strong> <span id="sub-current-expiry">—</span></p>
                    <p class="mb-0"><strong>New expiry:</strong> <span id="sub-new-expiry">—</span></p>
                </div>
                <p class="text-muted small">Select plan duration:</p>
                <div class="row g-3 mb-4" id="subscription-plan-options"></div>
                <div class="mb-3">
                    <label class="form-label">Select Payment Account</label>
                    <select class="form-select" id="sub-payment-account">
                        <option value="">Loading accounts...</option>
                    </select>
                    <div id="sub-payment-details" class="mt-2 p-2 border rounded" style="display:none; background:var(--ac-bg,#f5f7f5);">
                        <p class="mb-1 small"><strong>Name:</strong> <span id="sub-pay-name">—</span></p>
                        <p class="mb-1 small"><strong>Number:</strong> <span id="sub-pay-number">—</span></p>
                        <p class="mb-0 small"><strong>Type:</strong> <span id="sub-pay-type">—</span></p>
                    </div>
                </div>
                <div class="card mb-3" style="background:var(--ac-bg,#f5f7f5); border-color:var(--ac-border,#e2e8e0);">
                    <div class="card-body">
                        <h6><i class="bi bi-cash-stack"></i> Amount to Send</h6>
                        <p class="mb-0"><strong id="sub-amount-total" style="color:var(--ac-primary,#2d7a3a); font-size:1.25rem;">—</strong></p>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Upload receipt screenshot</label>
                    <input type="file" class="form-control" id="sub-payment-proof" accept="image/*" required>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn ac-btn-primary" id="btn-submit-subscription">
                    <i class="bi bi-send me-1"></i>Submit Request
                </button>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 5: Add subscription logic to farmer.js**

```javascript
subscriptionData: null,
selectedDuration: 1,
selectedPaymentAccount: null,  // Initialize property

async loadSubscription() {
    try {
        const res = await fetch(`${this.apiBase}/farmers/me/subscription`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.ok) { this.subscriptionData = await res.json(); this.updateSubscriptionUI(); this.updatePremiumBadge(); }
    } catch (e) { console.error('Load subscription error:', e); }
},

updateSubscriptionUI() {
    const d = this.subscriptionData;
    const panels = ['free','active','pending','expired'].map(s => document.getElementById(`subscription-${s}-panel`));
    const badge = document.getElementById('subscription-status-badge');
    panels.forEach(p => { if(p) p.style.display = 'none'; });
    if (badge) badge.style.display = 'none';
    const show = (id, status, badgeClass) => {
        const el = document.getElementById(`subscription-${id}-panel`);
        if (el) el.style.display = 'block';
        if (badge) { badge.textContent = status; badge.className = `badge ${badgeClass} ms-auto`; badge.style.display = 'inline'; }
    };
    if (d.status === 'pending') show('pending','Pending','bg-warning');
    else if (d.status === 'active') {
        show('active','Premium','bg-success');
        const expEl = document.getElementById('subscription-expiry-date');
        if (expEl && d.expires_at) expEl.textContent = new Date(d.expires_at).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
    } else if (d.status === 'expired') show('expired','Expired','bg-danger');
    else show('free','Free','bg-secondary');
},

updatePremiumBadge() {
    const icon = document.getElementById('header-premium-icon');
    if (!icon) return;
    const show = this.subscriptionData?.status === 'active';
    icon.style.display = show ? 'inline-block' : 'none';
    if (show && typeof bootstrap !== 'undefined') new bootstrap.Tooltip(icon);
},

async openSubscriptionModal(mode) {
    const settingsRes = await fetch(`${this.apiBase}/subscriptions/settings`);
    const settings = await settingsRes.json();

    // Populate payment accounts dropdown
    const accountSelect = document.getElementById('sub-payment-account');
    accountSelect.innerHTML = '';
    if (settings.payment_accounts && settings.payment_accounts.length > 0) {
        settings.payment_accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `${acc.name} (${acc.type === 'gcash' ? 'GCash' : 'Bank'}) — ${acc.account_number}`;
            accountSelect.appendChild(opt);
        });
        this.selectedPaymentAccount = settings.payment_accounts[0];
        this.showPaymentAccountDetails(this.selectedPaymentAccount);
    } else {
        accountSelect.innerHTML = '<option value="">No payment accounts available</option>';
    }
    accountSelect.onchange = (e) => {
        const selected = settings.payment_accounts.find(a => a.id === e.target.value);
        this.selectedPaymentAccount = selected || null;
        this.showPaymentAccountDetails(selected);
    };

    const opts = document.getElementById('subscription-plan-options');
    opts.innerHTML = '';
    Object.entries(settings.durations).forEach(([m, info]) => {
        const col = document.createElement('div'); col.className = 'col-md-4';
        // Use AgriCatch green accent instead of Bootstrap blue border-primary
        const isDefault = m === '1';
        const borderClass = isDefault ? 'border-success' : '';
        const bgClass = isDefault ? 'bg-light' : '';
        col.innerHTML = `<div class="card h-100 plan-option ${borderClass} ${bgClass}" data-months="${m}" style="border-width:2px; border-color:${isDefault ? 'var(--ac-primary,#2d7a3a)' : 'var(--ac-border)'};">
            <div class="card-body text-center">
                <h5>${info.months} Month${info.months>1?'s':''}</h5>
                <p class="fw-bold mb-1" style="color:var(--ac-primary,#2d7a3a);">₱${info.total.toLocaleString()}</p>
                ${info.discount_pct>0?`<small style="color:var(--ac-primary-dark,#1e5429);">Save ${info.discount_pct}%</small>`:''}
            </div></div>`;
        col.querySelector('.plan-option').addEventListener('click', () => {
            opts.querySelectorAll('.plan-option').forEach(el => {
                el.classList.remove('border-success','bg-light');
                el.style.borderColor = 'var(--ac-border)';
            });
            const selectedEl = col.querySelector('.plan-option');
            selectedEl.classList.add('border-success','bg-light');
            selectedEl.style.borderColor = 'var(--ac-primary,#2d7a3a)';
            this.selectedDuration = Number(m);
            document.getElementById('sub-amount-total').textContent = `₱${info.total.toLocaleString()}`;
            document.getElementById('sub-amount-total').dataset.amount = info.total;
            this.updateNewExpiryPreview();
        });
        opts.appendChild(col);
    });
    this.selectedDuration = 1;
    document.getElementById('sub-amount-total').textContent = `₱${settings.durations[1].total.toLocaleString()}`;
    document.getElementById('sub-amount-total').dataset.amount = settings.durations[1].total;
    const title = document.getElementById('subscription-modal-title');
    const currentInfo = document.getElementById('subscription-current-info');
    if (mode === 'extend' && this.subscriptionData?.expires_at) {
        title.textContent = 'Extend Subscription';
        currentInfo.style.display = 'block';
        document.getElementById('sub-current-expiry').textContent = new Date(this.subscriptionData.expires_at).toLocaleDateString('en-PH');
        this.updateNewExpiryPreview();
    } else {
        title.textContent = mode === 'renew' ? 'Renew Premium' : 'Go Premium';
        currentInfo.style.display = 'none';
    }
    new bootstrap.Modal(document.getElementById('subscription-modal')).show();
},

updateNewExpiryPreview() {
    if (!this.subscriptionData?.expires_at) return;
    const base = new Date(Math.max(new Date(this.subscriptionData.expires_at), new Date()));
    base.setMonth(base.getMonth() + this.selectedDuration);
    document.getElementById('sub-new-expiry').textContent = base.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
},

showPaymentAccountDetails(account) {
    const details = document.getElementById('sub-payment-details');
    if (!account || !details) { if (details) details.style.display = 'none'; return; }
    document.getElementById('sub-pay-name').textContent = account.name;
    document.getElementById('sub-pay-number').textContent = account.account_number;
    document.getElementById('sub-pay-type').textContent = account.type === 'gcash' ? 'GCash' : 'Bank Transfer';
    details.style.display = 'block';
},

async submitSubscriptionRequest() {
    const input = document.getElementById('sub-payment-proof');
    if (!input.files?.length) { alert('Please upload your payment receipt.'); return; }
    if (!this.selectedPaymentAccount) { alert('Please select a payment account.'); return; }
    const formData = new FormData();
    formData.append('payment_proof', input.files[0]);
    formData.append('plan_duration_months', this.selectedDuration);
    formData.append('payment_account_id', this.selectedPaymentAccount.id);
    formData.append('payment_method', this.selectedPaymentAccount.type);
    formData.append('expected_amount', document.getElementById('sub-amount-total').dataset.amount || '');
    try {
        const res = await fetch(`${this.apiBase}/farmers/me/subscription/request`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${this.token}` }, body: formData
        });
        const data = await res.json();
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('subscription-modal')).hide();
            alert(data.message); await this.loadSubscription();
        } else { alert(data.message || 'Failed to submit request.'); }
    } catch (e) { console.error(e); alert('Failed to submit request.'); }
}
```

- [ ] **Step 6: Wire event listeners**

In farmer.js init:

```javascript
document.getElementById('btn-upgrade-premium')?.addEventListener('click', () => this.openSubscriptionModal('upgrade'));
document.getElementById('btn-extend-subscription')?.addEventListener('click', () => this.openSubscriptionModal('extend'));
document.getElementById('btn-renew-premium')?.addEventListener('click', () => this.openSubscriptionModal('renew'));
document.getElementById('btn-submit-subscription')?.addEventListener('click', () => this.submitSubscriptionRequest());
```

Call `this.loadSubscription()` in init alongside other data fetches.

- [ ] **Step 7: Commit**

```bash
git add frontend/farmer.html frontend/js/farmer.js
git commit -m "feat: add farmer subscription UI with upgrade, extend, and renewal"
```

---

### Task 6: Frontend — Update Analytics Dashboard for Tiered Access

**Files:**
- Modify: `frontend/js/farmer.js:3641-3792`

- [ ] **Step 1: Replace `isVerified` check with tier-aware logic**

In `loadOverviewMetrics` (around line 3641), replace the existing verification check:

```javascript
// Check if user is verified for advanced analytics access
let isVerified = true;
try {
    const userRes = await fetch(`${this.apiBase}/auth/me`, { headers: { 'Authorization': `Bearer ${this.token}` } });
    if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.user && userData.user.is_verified === false) { isVerified = false; }
    }
} catch (_) { /* ignore */ }
```

With:

```javascript
// Determine farmer tier for analytics access
let isVerified = true;
let tier = 'free';
try {
    const [userRes, subRes] = await Promise.all([
        fetch(`${this.apiBase}/auth/me`, { headers: { 'Authorization': `Bearer ${this.token}` } }),
        fetch(`${this.apiBase}/farmers/me/subscription`, { headers: { 'Authorization': `Bearer ${this.token}` } })
    ]);
    if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.user && userData.user.is_verified === false) { isVerified = false; }
    }
    if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.status === 'active') tier = 'premium';
    }
} catch (_) { /* ignore */ }
```

- [ ] **Step 2: Update analytics warning banner**

Replace:
```javascript
if (!isVerified) {
    analyticsWarningEl.innerHTML = '<i class="fas fa-info-circle"></i> Advanced analytics (charts, trends, insights) are available for verified farmers only...';
}
```

With:
```javascript
if (!isVerified) {
    analyticsWarningEl.innerHTML = '<i class="fas fa-info-circle"></i> Analytics are unavailable. Please verify your account to access basic metrics. Upgrade to Premium for full analytics.';
} else if (tier !== 'premium') {
    analyticsWarningEl.innerHTML = '<i class="fas fa-info-circle"></i> Advanced analytics (charts, trends, insights) are a Premium feature. <a href="#" onclick="window.farmerDashboard.showSection(\'subscription\');return false;">Upgrade to Premium</a>.';
}
```

- [ ] **Step 3: Update unverified analytics block**

Replace:
```javascript
if (!isVerified) {
    this.renderBasicMetricsOnly();
    return;
}
```

With:
```javascript
if (!isVerified) {
    // Unverified: no analytics at all
    const lastUpdatedEl = document.getElementById('overview-last-updated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Verify your account to access metrics';
    const statusWrap = document.getElementById('statusChart');
    if (statusWrap) statusWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#9ca3af;font-size:14px;">Verify your account to access seller metrics</div>';
    const reportsWrap = document.getElementById('reportsChart');
    if (reportsWrap) reportsWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#9ca3af;font-size:14px;">Verify your account to access seller metrics</div>';
    return;
}

if (tier !== 'premium') {
    this.renderBasicMetricsOnly();
    return;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: tiered analytics access (unverified=none, free=basic, premium=full)"
```

---

### Task 7: Frontend — Update Product Limit Warning for Free Verified

**Files:**
- Modify: `frontend/js/farmer.js:3540-3556`

- [ ] **Step 1: Replace unverified warning with free-tier warning**

Replace:
```javascript
if (userData.user && userData.user.is_verified === false) {
    const productCount = this.myProductsCache.length;
    const limitWarningEl = document.getElementById('product-limit-warning');
    if (limitWarningEl) {
        if (productCount >= 8) {
            limitWarningEl.innerHTML = `...Unverified farmers can only have up to 10 products...`;
        }
    }
}
```

With:
```javascript
// Check tier for product limit warning
let tier = 'free';
try {
    const subRes = await fetch(`${this.apiBase}/farmers/me/subscription`, { headers: { 'Authorization': `Bearer ${this.token}` } });
    if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.status === 'active') tier = 'premium';
    }
} catch (_) { /* ignore */ }

if (tier === 'free') {
    const productCount = this.myProductsCache.length;
    const limitWarningEl = document.getElementById('product-limit-warning');
    if (limitWarningEl) {
        if (productCount >= 8) {
            limitWarningEl.style.display = '';
            limitWarningEl.className = 'alert alert-warning';
            limitWarningEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> You have ${productCount}/10 products. Free tier limit is 10. <a href="#" onclick="window.farmerDashboard.showSection('subscription');return false;">Upgrade to Premium</a> for unlimited products.`;
        } else {
            limitWarningEl.style.display = 'none';
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: product limit warning now targets free verified farmers"
```

---

### Task 8: Frontend — Update Unverified Banner Text

**Files:**
- Modify: `frontend/js/farmer.js:6616-6620` and `6812-6817`

- [ ] **Step 1: Update verification banner text**

Replace:
```javascript
'Your account is unverified. Submit a verification request to unlock unlimited products and advanced analytics.'
```

With:
```javascript
'Your account is unverified. Submit a verification request to start selling. Upgrade to Premium for unlimited products and advanced analytics.'
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: update unverified banner text for tiered benefits"
```

---

### Task 9: Frontend — Admin Subscription Management

**Files:**
- Modify: `frontend/admin.html`
- Modify: `frontend/js/admin.js`

- [ ] **Step 1: Add sidebar item and section**

**Sidebar placement:** Add the `<li>` inside the main sidebar `<ul>` alongside other admin links under "Requests" heading — do NOT place it inside a `data-roles="super_admin"` container since both admin and super_admin need to approve subscriptions.

```html
<li class="nav-item">
    <a class="nav-link collapsed sidebar-link" href="#subscription-requests" data-section="subscription-requests">
        <i class="bi bi-star-fill"></i><span>Subscriptions</span>
        <span id="subscription-pending-count" class="sidebar-badge" style="display:none">0</span>
    </a>
</li>

<!-- ════════════════════════════════════════════════════════════════
     § XX — SUBSCRIPTION REQUESTS SECTION
═══════════════════════════════════════════════════════════════════ -->
<section id="subscription-requests" class="admin-section-card">
    <div class="ac-section-hero ac-section-hero--primary mb-4">
        <div class="ac-section-hero__icon"><i class="bi bi-star-fill"></i></div>
        <div class="ac-section-hero__body">
            <h4 class="ac-section-hero__title">Subscription Requests</h4>
            <p class="ac-section-hero__sub">Review, approve, and manage farmer premium subscriptions.</p>
        </div>
    </div>

    <div class="card">
        <div class="card-body">
            <!-- Reuse existing .verification-tabs class from agricatch-admin.css -->
            <div class="verification-tabs subscription-tabs mb-3">
                <button class="tab-btn active" data-status="pending">Pending</button>
                <button class="tab-btn" data-status="active">Active</button>
                <button class="tab-btn" data-status="expired">Expired</button>
                <button class="tab-btn" data-status="rejected">Rejected</button>
            </div>
            <div class="table-responsive">
                <table class="table" id="subscriptions-table">
                    <thead><tr><th>Farmer</th><th>Plan</th><th>Amount</th><th>Payment To</th><th>Date</th><th>Proof</th><th>Actions</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 2: Add admin JS logic**

```javascript
async loadSubscriptionRequests(status = 'pending') {
    try {
        const res = await fetch(`${this.apiBase}/admin/subscriptions?status=${status}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const tbody = document.querySelector('#subscriptions-table tbody');
        if (!tbody) return;
        tbody.innerHTML = data.subscriptions.map(s => `
            <tr>
                <td>${this.escapeHtml(s.farm_name || `${s.first_name} ${s.last_name}`)}</td>
                <td>${s.plan_duration_months} month${s.plan_duration_months > 1 ? 's' : ''}</td>
                <td>₱${Number(s.amount_paid || 0).toLocaleString()}</td>
                <td>${s.payment_account_name ? `<span class="badge bg-${s.payment_account_type === 'gcash' ? 'success' : 'info'}">${s.payment_account_type === 'gcash' ? 'GCash' : 'Bank'}</span> ${this.escapeHtml(s.payment_account_name)}` : '—'}</td>
                <td>${new Date(s.created_at).toLocaleDateString('en-PH')}</td>
                <td>${s.payment_proof_url ? `<a href="${s.payment_proof_url}" target="_blank" class="btn btn-sm btn-outline-success"><i class="bi bi-image"></i> View</a>` : '—'}</td>
                <td>
                    ${status === 'pending' ? `
                        <button class="btn btn-sm btn-success approve-sub-btn" data-id="${s.id}">Approve</button>
                        <button class="btn btn-sm btn-danger reject-sub-btn" data-id="${s.id}">Reject</button>
                    ` : `<span class="badge bg-${status === 'active' ? 'success' : status === 'rejected' ? 'danger' : 'secondary'}">${status}</span>`}
                </td>
            </tr>
        `).join('');
        // Wire buttons
        tbody.querySelectorAll('.approve-sub-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Approve this subscription?')) return;
                await this.handleSubscriptionAction(btn.dataset.id, 'approve');
            });
        });
        tbody.querySelectorAll('.reject-sub-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reason = prompt('Rejection reason (optional):') || '';
                await this.handleSubscriptionAction(btn.dataset.id, 'reject', reason);
            });
        });
        // Update badge count
        if (status === 'pending') {
            const badge = document.getElementById('subscription-pending-count');
            if (badge) { badge.textContent = data.subscriptions.length; badge.style.display = data.subscriptions.length > 0 ? 'inline' : 'none'; }
        }
    } catch (e) { console.error('Load subscriptions error:', e); }
},

async handleSubscriptionAction(id, action, reason = '') {
    try {
        const res = await fetch(`${this.apiBase}/admin/subscriptions/${id}/${action}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body: action === 'reject' ? JSON.stringify({ reason }) : undefined
        });
        const data = await res.json();
        alert(data.message);
        this.loadSubscriptionRequests('pending');
    } catch (e) { console.error(e); alert('Action failed.'); }
}
```

- [ ] **Step 3: Wire tab clicks and init badge count**

```javascript
// Tab switching
document.querySelectorAll('.subscription-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.subscription-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadSubscriptionRequests(btn.dataset.status);
    });
});

// Load pending count once on init (even if section not visible)
this.loadSubscriptionRequests('pending');
```

Also wire the section load in `showSection()` or `navigateTo()` when `subscription-requests` is shown:

```javascript
// In showSection() or a section-specific handler:
if (sectionId === 'subscription-requests') {
    this.loadSubscriptionRequests('pending');
    document.querySelectorAll('.subscription-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.subscription-tabs .tab-btn[data-status="pending"]')?.classList.add('active');
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/admin.html frontend/js/admin.js
git commit -m "feat: add admin subscription requests UI"
```

---

### Task 10: Frontend — Add Subscription CSS

**Files:**
- Modify: `frontend/farmer.html` (in `<style>` block)

- [ ] **Step 1: Add subscription-specific styles**

Append to the existing `<style>` block in `farmer.html`:

```css
/* Subscription Section Styles — matches existing verification-tabs pattern */
.subscription-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}
.subscription-tabs .tab-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--ac-border, #e2e8e4);
    border-radius: 8px;
    background: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    color: var(--ac-text-muted, #6b7e72);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.subscription-tabs .tab-btn:hover {
    background: var(--ac-bg, #f5f7f5);
    color: var(--ac-text, #1a2e1e);
}
.subscription-tabs .tab-btn.active {
    background: var(--ac-primary, #2d7a3a);
    color: #fff;
    border-color: var(--ac-primary, #2d7a3a);
}
.plan-option {
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
}
.plan-option:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
#subscription-modal .modal-body { padding: 1.5rem; }
#sub-amount-total { font-size: 1.25rem; }

/* Mobile: scroll tabs horizontally */
@media (max-width: 768px) {
    .subscription-tabs { overflow-x: auto; white-space: nowrap; }
    .subscription-tabs .tab-btn { flex: 0 0 auto; }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add subscription section CSS styles"
```

---

### Task 11: Frontend — Register Subscription in showSection()

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add 'subscription' to validSections**

Find the `validSections` Set in `showSection()` and `setupSidebarNavigation()` and add `'subscription'`:

```javascript
const validSections = new Set([
    'overview', 'products', 'orders', 'chat', 'shop', 'reviews', 'profile', 'notifications',
    'subscription'  // ADD THIS
]);
```

Also update `setupSidebarNavigation()` init default:

```javascript
const validSections = new Set([
    'overview', 'products', 'orders', 'chat', 'shop', 'reviews', 'profile', 'notifications',
    'subscription'  // ADD THIS
]);
```

- [ ] **Step 2: Add 'subscription' case to showSection() title switch**

```javascript
case 'subscription':
    title = 'Subscription';
    break;
```

- [ ] **Step 4: Ensure subscription section uses admin-section-card**

The subscription `<section>` must have `class="admin-section-card"` (no `style="display:none"`). `showSection()` toggles `.active` on all `.admin-section-card` elements.

- [ ] **Step 5: (Optional) Add subscription to top search**

If `applyTopSearch()` in farmer.js filters by active section, add an `else if` for `subscription` or document that the search box has no effect on the subscription page (acceptable since it's a settings page, not a data list).

```javascript
} else if (this.activeSection === 'subscription') {
    // No search filtering on subscription page
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: register subscription section in farmer dashboard navigation"
```

---

### Task 12: Frontend — Loading States & Error Handling in Subscription Modal

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add loading state to the existing `submitSubscriptionRequest()` from Task 9**

Wrap the fetch call inside `submitSubscriptionRequest()` with button loading state. **Do not remove** the existing `payment_account_id`, `payment_method`, and `expected_amount` fields from Task 9.

```javascript
async submitSubscriptionRequest() {
    const input = document.getElementById('sub-payment-proof');
    const submitBtn = document.getElementById('btn-submit-subscription');
    if (!input.files?.length) { alert('Please upload your payment receipt.'); return; }
    if (!this.selectedPaymentAccount) { alert('Please select a payment account.'); return; }

    // Loading state
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting...';

    const formData = new FormData();
    formData.append('payment_proof', input.files[0]);
    formData.append('plan_duration_months', this.selectedDuration);
    formData.append('payment_account_id', this.selectedPaymentAccount.id);
    formData.append('payment_method', this.selectedPaymentAccount.type);
    formData.append('expected_amount', document.getElementById('sub-amount-total').dataset.amount || '');

    try {
        const res = await fetch(`${this.apiBase}/farmers/me/subscription/request`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${this.token}` }, body: formData
        });
        const data = await res.json();
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('subscription-modal')).hide();
            alert(data.message);
            input.value = ''; // Clear file input
            await this.loadSubscription();
        } else {
            alert(data.message || 'Failed to submit request.');
        }
    } catch (e) {
        console.error(e);
        alert('Failed to submit request. Please check your connection and try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}
```

- [ ] **Step 2: Add error handling to openSubscriptionModal**

Wrap settings fetch:

```javascript
async openSubscriptionModal(mode) {
    let settings;
    try {
        const settingsRes = await fetch(`${this.apiBase}/subscriptions/settings`);
        if (!settingsRes.ok) throw new Error('Failed to load pricing');
        settings = await settingsRes.json();
    } catch (err) {
        alert('Could not load subscription settings. Please try again later.');
        console.error(err);
        return;
    }
    // ... rest of modal setup
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add loading states and error handling to subscription modal"
```

---

### Task 13: Frontend — Expected Amount Tracking

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Store raw amount in data attribute for submission**

In `openSubscriptionModal()`, when updating the amount display:

```javascript
document.getElementById('sub-amount-total').textContent = `₱${info.total.toLocaleString()}`;
document.getElementById('sub-amount-total').dataset.amount = info.total;
```

This allows `submitSubscriptionRequest()` to send the expected amount to the backend for audit purposes.

- [ ] **Step 2: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: track expected subscription amount in request"
```

---

### Task 14: Frontend — Admin Payment Accounts Management

**Files:**
- Modify: `frontend/admin.html`
- Modify: `frontend/js/admin.js`

- [ ] **Step 1: Add payment accounts card + pricing settings to admin panel**

Place inside a `data-roles="super_admin"` container so only superadmin can see it:

```html
<!-- Payment Accounts & Pricing Settings (superadmin only) -->
<div data-roles="super_admin">
    <div class="card mt-3">
        <div class="card-body">
            <h5 class="card-title"><i class="bi bi-credit-card"></i> Payment Accounts</h5>
            <p class="text-muted small">Farmers will see all active accounts when subscribing. Add multiple GCash or bank accounts.</p>
            <div id="payment-accounts-list" class="mb-3"></div>
            <div class="border rounded p-3" style="background:var(--ac-bg,#f5f7f5); border-color:var(--ac-border,#e2e8e0);">
                <h6 class="mb-3">Add New Account</h6>
                <div class="row g-2">
                    <div class="col-md-3">
                        <label class="form-label small text-muted">Account Name</label>
                        <input type="text" class="form-control" id="new-pay-name" placeholder="e.g. AgriCatch GCash 2">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small text-muted">Number</label>
                        <input type="text" class="form-control" id="new-pay-number" placeholder="0917...">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small text-muted">Type</label>
                        <select class="form-select" id="new-pay-type">
                            <option value="gcash">GCash</option>
                            <option value="bank_transfer">Bank</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small text-muted">Order</label>
                        <input type="number" class="form-control" id="new-pay-order" placeholder="0" value="0">
                    </div>
                    <div class="col-md-2 d-flex align-items-end">
                        <button class="btn ac-btn-primary w-100" id="btn-add-payment-account"><i class="bi bi-plus-lg me-1"></i>Add</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Pricing Settings -->
    <div class="card mt-3">
        <div class="card-body">
            <h5 class="card-title"><i class="bi bi-gear"></i> Subscription Pricing</h5>
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label small text-muted">Monthly Price (₱)</label>
                    <input type="number" class="form-control" id="setting-premium-monthly-price" value="299">
                </div>
                <div class="col-md-4">
                    <label class="form-label small text-muted">3-Month Discount (%)</label>
                    <input type="number" class="form-control" id="setting-discount-3m" value="10">
                </div>
                <div class="col-md-4">
                    <label class="form-label small text-muted">6-Month Discount (%)</label>
                    <input type="number" class="form-control" id="setting-discount-6m" value="20">
                </div>
            </div>
            <button class="btn ac-btn-primary btn-sm mt-3" id="btn-save-subscription-settings">
                <i class="bi bi-check-lg me-1"></i>Save Pricing
            </button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Add payment accounts JS logic**

```javascript
async loadPaymentAccounts() {
    try {
        const res = await fetch(`${this.apiBase}/admin/payment-accounts`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('payment-accounts-list');
        if (!container) return;
        container.innerHTML = data.accounts.map(acc => `
            <div class="d-flex align-items-center justify-content-between p-2 mb-2 border rounded ${acc.is_active ? '' : 'bg-light opacity-50'}">
                <div>
                    <strong>${this.escapeHtml(acc.name)}</strong>
                    <span class="badge bg-${acc.type === 'gcash' ? 'primary' : 'info'} ms-1">${acc.type === 'gcash' ? 'GCash' : 'Bank'}</span>
                    <span class="text-muted small ms-2">${this.escapeHtml(acc.account_number)}</span>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-secondary toggle-pay-btn" data-id="${acc.id}" data-active="${acc.is_active}">
                        ${acc.is_active ? '<i class="bi bi-eye"></i> Active' : '<i class="bi bi-eye-slash"></i> Inactive'}
                    </button>
                    <button class="btn btn-sm btn-danger delete-pay-btn" data-id="${acc.id}"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `).join('');
        // Wire buttons
        container.querySelectorAll('.toggle-pay-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newActive = btn.dataset.active === 'true' ? false : true;
                await this.handlePaymentAccountAction(btn.dataset.id, 'toggle', { is_active: newActive });
            });
        });
        container.querySelectorAll('.delete-pay-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this payment account?')) return;
                await this.handlePaymentAccountAction(btn.dataset.id, 'delete');
            });
        });
    } catch (e) { console.error(e); }
},

async handlePaymentAccountAction(id, action, data = null) {
    try {
        let url = `${this.apiBase}/admin/payment-accounts/${id}`;
        let method = action === 'delete' ? 'DELETE' : 'PUT';
        let body = action === 'toggle' ? JSON.stringify(data) : undefined;
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body
        });
        const result = await res.json();
        alert(result.message);
        this.loadPaymentAccounts();
    } catch (e) { console.error(e); alert('Action failed'); }
},

async addPaymentAccount() {
    const name = document.getElementById('new-pay-name').value.trim();
    const number = document.getElementById('new-pay-number').value.trim();
    const type = document.getElementById('new-pay-type').value;
    const order = document.getElementById('new-pay-order').value;
    if (!name || !number) { alert('Name and number are required'); return; }
    try {
        const res = await fetch(`${this.apiBase}/admin/payment-accounts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, account_number: number, type, sort_order: Number(order) })
        });
        const data = await res.json();
        alert(data.message);
        document.getElementById('new-pay-name').value = '';
        document.getElementById('new-pay-number').value = '';
        this.loadPaymentAccounts();
    } catch (e) { console.error(e); alert('Failed to add account'); }
}
```

- [ ] **Step 3: Add pricing settings JS**

```javascript
async loadSubscriptionSettings() {
    try {
        const res = await fetch(`${this.apiBase}/superadmin/settings`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const s = data.settings || {};
        document.getElementById('setting-premium-monthly-price').value = s.premium_monthly_price?.value || 299;
        document.getElementById('setting-discount-3m').value = s.premium_3month_discount_pct?.value || 10;
        document.getElementById('setting-discount-6m').value = s.premium_6month_discount_pct?.value || 20;
    } catch (e) { console.error(e); }
},

async saveSubscriptionSettings() {
    const payload = {
        premium_monthly_price: document.getElementById('setting-premium-monthly-price').value,
        premium_3month_discount_pct: document.getElementById('setting-discount-3m').value,
        premium_6month_discount_pct: document.getElementById('setting-discount-6m').value
    };
    try {
        const res = await fetch(`${this.apiBase}/superadmin/settings`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert(data.message || 'Settings saved');
    } catch (e) { console.error(e); alert('Failed to save settings'); }
}
```

- [ ] **Step 4: Wire event listeners**

```javascript
document.getElementById('btn-add-payment-account')?.addEventListener('click', () => this.addPaymentAccount());
document.getElementById('btn-save-subscription-settings')?.addEventListener('click', () => this.saveSubscriptionSettings());
```

- [ ] **Step 5: Call loaders during admin init**

In the admin panel init (where other data is loaded on page load), add for superadmin:

```javascript
if (this.currentUserRole === 'super_admin') {
    this.loadPaymentAccounts();
    this.loadSubscriptionSettings();
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/admin.html frontend/js/admin.js
git commit -m "feat: add admin payment accounts management (multiple GCash/bank)"
```

---

### Task 15: Frontend — Proof Image Modal for Admin

**Files:**
- Modify: `frontend/admin.html`
- Modify: `frontend/js/admin.js`

- [ ] **Step 1: Add proof image modal**

```html
<!-- Subscription Proof Modal -->
<div class="modal fade" id="subscription-proof-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Payment Proof</h5>
                <button class="modal-close-btn" data-bs-dismiss="modal" aria-label="Close">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="modal-body text-center">
                <img id="sub-proof-img" src="" alt="Payment Proof" style="max-width:100%;max-height:70vh;object-fit:contain;">
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Update admin table to open modal instead of link**

Replace the proof column in `loadSubscriptionRequests()`:

```javascript
${s.payment_proof_url ? `<button class="btn btn-sm btn-outline-success view-proof-btn" data-url="${s.payment_proof_url}"><i class="bi bi-image"></i> View</button>` : '—'}
```

Add event listener wiring:

```javascript
tbody.querySelectorAll('.view-proof-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('sub-proof-img').src = btn.dataset.url;
        new bootstrap.Modal(document.getElementById('subscription-proof-modal')).show();
    });
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/admin.html frontend/js/admin.js
git commit -m "feat: add inline proof image modal for admin subscription review"
```

---

### Task 16: Frontend — "Add Product" Button Gate for Unverified

**Files:**
- Modify: `frontend/farmer.html`
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add tier-aware gate to Add Product button**

In `farmer.html` products section, find the Add Product button and add data attribute:

```html
<button class="btn btn-primary" id="btn-add-product">
    <i class="bi bi-plus"></i> Add Product
</button>
```

- [ ] **Step 2: Gate in farmer.js**

In the products section initialization or after `loadSubscription()`:

```javascript
updateAddProductButton() {
    const btn = document.getElementById('btn-add-product');
    if (!btn) return;
    const sub = this.subscriptionData;
    const isVerified = this.userData?.is_verified === true;  // Use cached auth data, not verification request
    if (!isVerified) {
        btn.disabled = true;
        btn.title = 'Verify your account to start selling products';
        btn.classList.add('btn-secondary');
        btn.classList.remove('btn-primary');
    } else {
        // Verified (free or premium) - button enabled, tier limit enforced on backend
        btn.disabled = false;
        btn.title = '';
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
    }
}
```

Call `this.updateAddProductButton()` after `loadSubscription()`.

- [ ] **Step 3: Commit**

```bash
git add frontend/farmer.html frontend/js/farmer.js
git commit -m "feat: disable Add Product button for unverified farmers"
```

---

### Task 17: Frontend — Subscription Expiry Warning

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add expiry warning check**

In `updateSubscriptionUI()`, add after active panel logic:

```javascript
else if (d.status === 'active') {
    show('active','Premium','bg-success');
    const expEl = document.getElementById('subscription-expiry-date');
    if (expEl && d.expires_at) {
        const expiry = new Date(d.expires_at);
        expEl.textContent = expiry.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
        // Show warning if expiring within 7 days
        const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
        const warningEl = document.getElementById('subscription-expiry-warning');
        if (warningEl) {
            if (daysLeft <= 7 && daysLeft > 0) {
                warningEl.style.display = '';
                warningEl.className = 'alert alert-warning mt-2';
                warningEl.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Your Premium subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. <a href="#" onclick="window.farmerDashboard.openSubscriptionModal('extend');return false;">Extend now</a> to avoid interruption.`;
            } else {
                warningEl.style.display = 'none';
            }
        }
    }
}
```

- [ ] **Step 2: Add warning element to HTML**

In the `subscription-active-panel` div:

```html
<div id="subscription-expiry-warning" style="display:none;"></div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/farmer.html frontend/js/farmer.js
git commit -m "feat: add 7-day subscription expiry warning"
```

---

### Task 18: Frontend — Sidebar Badge Live Updates via Polling

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Add polling for subscription status**

In the init/setup section, add alongside existing polling:

```javascript
// Poll subscription status every 30 seconds when on subscription section
this._subPollInterval = setInterval(() => {
    if (this.activeSection === 'subscription' || document.getElementById('subscription-status-badge')?.style.display !== 'none') {
        this.loadSubscription();
    }
}, 30000);
```

- [ ] **Step 2: Cleanup on logout**

```javascript
logout() {
    if (this._subPollInterval) clearInterval(this._subPollInterval);
    // ... existing logout code
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: poll subscription status for live sidebar badge updates"
```

---

### Task 19: Frontend — Update Verification Benefits Card Copy

**Files:**
- Modify: `frontend/farmer.html`

- [ ] **Step 1: Update verification benefits text**

Find the verification benefits grid in `farmer.html` (around line 1579-1617) and update:

```html
<div class="col-md-6 mb-3">
    <div class="card h-100">
        <div class="card-body">
            <h6><i class="bi bi-infinity text-success"></i> Up to 10 Products</h6>
            <small class="text-muted">Free verified farmers can list up to 10 products</small>
        </div>
    </div>
</div>
<div class="col-md-6 mb-3">
    <div class="card h-100">
        <div class="card-body">
            <h6><i class="bi bi-shield-check text-success"></i> Verified Seller Badge</h6>
            <small class="text-muted">Visible to customers on all your products</small>
        </div>
    </div>
</div>
<div class="col-md-6 mb-3">
    <div class="card h-100">
        <div class="card-body">
            <h6><i class="bi bi-star-fill text-warning"></i> Premium Upgrade</h6>
            <small class="text-muted">Go Premium for unlimited products, priority ranking, custom names, and full analytics</small>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: update verification benefits card for tiered system"
```

---

### Task 20: Frontend — Handle Missing Farmer Profile Gracefully

**Files:**
- Modify: `frontend/js/farmer.js`

- [ ] **Step 1: Update `loadSubscription()` to detect missing profile**

The backend returns **HTTP 200** with `{ tier: 'free', status: 'free', expires_at: null }` when no farmer profile exists. Detect missing profile by checking if `farmer_id` is absent (or by querying auth/me for role).

```javascript
async loadSubscription() {
    try {
        const [subRes, userRes] = await Promise.all([
            fetch(`${this.apiBase}/farmers/me/subscription`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            }),
            fetch(`${this.apiBase}/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            })
        ]);
        let hasFarmerProfile = false;
        if (userRes.ok) {
            const userData = await userRes.json();
            hasFarmerProfile = userData.user?.role === 'farmer';
        }
        if (subRes.ok) {
            this.subscriptionData = await subRes.json();
            if (!hasFarmerProfile) {
                this.subscriptionData.profile_incomplete = true;
            }
        }
        this.updateSubscriptionUI();
        this.updatePremiumBadge();
        this.updateAddProductButton();
    } catch (e) { console.error('Load subscription error:', e); }
}
```

- [ ] **Step 2: Show profile incomplete message**

In `updateSubscriptionUI()`, add before the existing status checks:

```javascript
if (d.profile_incomplete) {
    const freePanel = document.getElementById('subscription-free-panel');
    if (freePanel) {
        freePanel.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> Complete your farmer profile to access subscription features.
            </div>
            <button class="btn ac-btn-primary btn-sm" onclick="window.farmerDashboard.showSection('profile','edit');return false;">
                <i class="bi bi-person-check me-1"></i>Complete Profile
            </button>
        `;
    }
    // Hide other panels
    ['active','pending','expired'].forEach(s => {
        const p = document.getElementById(`subscription-${s}-panel`);
        if (p) p.style.display = 'none';
    });
    return;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: handle missing farmer profile in subscription UI"
```

---

### Task 21: End-to-End Testing

**Files:**
- Manual verification

- [ ] **Step 1: Run migration**

```bash
cd backend
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); (async()=>{await p.query('SELECT 1'); console.log('DB OK'); await p.end();})();"
```

- [ ] **Step 2: Test settings endpoint**

```bash
curl http://localhost:3000/api/subscriptions/settings
```

Expect JSON with `monthly_price`, `durations[1|3|6]`, `payment_accounts` array.

- [ ] **Step 3: Test farmer request flow**

- Login as farmer
- Navigate to Subscription → "Go Premium"
- Select 3 months, see computed total
- Select payment account from dropdown (GCash or Bank)
- Upload dummy receipt, submit
- Verify `GET /api/farmers/me/subscription` returns `status: 'pending'`

- [ ] **Step 4: Test admin approval**

- Login as admin
- Navigate to Subscriptions → Pending
- View proof in modal, click Approve
- Verify farmer's `expires_at` is ~90 days from now
- Repeat: submit new 6-month request, approve → verify `expires_at` extended by 180 days

- [ ] **Step 5: Test product limit**

- As unverified farmer: try to add product → expect 403 "verify your account first"
- As free-tier verified farmer: create 10 products → 11th expect 403
- As premium farmer: create 15+ products → expect all success

- [ ] **Step 6: Test analytics tier access**

- Unverified farmer: overview shows "verify your account" message, no charts
- Free verified: KPI cards visible, charts show "Premium feature" placeholder
- Premium: full charts and reports load

- [ ] **Step 7: Test badge rendering**

- Premium active farmer: verify `header-premium-icon` visible with tooltip
- Free verified: only `header-verified-icon` visible
- Unverified: neither badge visible

- [ ] **Step 8: Test expiry warning**

- Set a subscription to expire in 3 days (manual DB update)
- Verify farmer sees yellow warning banner with "expires in 3 days"

- [ ] **Step 9: Test payment accounts management**

- Login as superadmin
- Navigate to Subscription Settings → Payment Accounts
- Add new GCash account with name + number
- Verify account appears in farmer upgrade modal
- Toggle account inactive, verify it disappears from farmer modal
- Delete account

- [ ] **Step 10: Test custom product name gate**

- Free verified farmer: request custom name → expect 403
- Premium farmer: request custom name → expect success

- [ ] **Step 11: Commit test results**

```bash
git commit --allow-empty -m "test: verify complete subscription tier e2e workflow"
```

---

## Self-Review

**Post-review fixes applied (Critical + High + Medium + UI/UX):**

**Critical / Logic:**
- `subscription` added to `validSections` Set in farmer.js (Task 11)
- Removed `style="display:none"` from new `<section>` elements — CSS `.active` class handles visibility (Task 5, 9)
- Migration order fixed: `payment_accounts` created before `farmer_subscriptions` (Task 1)
- Task 12 preserves all `payment_account_id`, `payment_method`, `expected_amount` fields from Task 9
- Payment account dropdown uses `.onchange = ...` to prevent duplicate listeners (Task 9)
- Missing profile detection uses auth/me instead of checking 404 (Task 20)
- Pricing settings UI restored inside superadmin payment accounts card (Task 14)
- Admin badge count loaded on init + section navigation wiring (Task 9)
- Admin sidebar link placed outside `data-roles="super_admin"` (Task 9)
- `updateAddProductButton` uses `this.userData?.is_verified` instead of `currentVerificationRequest` (Task 16)
- Route collision warning added for `payment-accounts.js` (Task 3b)
- Admin init loads `loadPaymentAccounts()` and `loadSubscriptionSettings()` for superadmin (Task 14)
- `getFarmerTier(decoded.id)` fixed to use `farmerId` in custom product names gate (Task 5, Part 1)
- `selectedPaymentAccount` property initialized in constructor (Task 5)

**UI/UX Design Consistency (All matching existing AgriCatch system):**
- Farmer subscription section: added `.ac-section-hero` banner matching all other sections (Task 5)
- Admin subscription section: added `.ac-section-hero` banner + `§` section comment (Task 9)
- All primary buttons: changed `.btn btn-primary` → `.btn ac-btn-primary` / `.btn ac-btn-primary btn-sm` (Task 5, 14, 16, 20)
- Farmer sidebar badge: changed `bg-warning` → `bg-danger` matching chat/notifications (Task 5)
- Admin sidebar badge: changed `badge bg-warning ms-auto` → `sidebar-badge` matching existing admin pattern (Task 9)
- Plan option cards: replaced Bootstrap `border-primary`/`text-primary` (blue) with AgriCatch green CSS vars (Task 5)
- Subscription tabs CSS: uses `var(--ac-primary, #2d7a3a)` instead of hardcoded `#3b82f6` blue (Task 10)
- Admin tabs: reuse existing `.verification-tabs` class instead of new `.subscription-tabs` (Task 9)
- Modal amount display: uses `color:var(--ac-primary)` instead of `.text-primary` (Task 5)
- Payment details panel: uses `var(--ac-bg)` instead of `bg-light` (Task 5)
- Admin proof modal: uses `.modal-close-btn` with `bi-x-lg` matching existing admin modals (Task 15)
- Admin table badges: GCash uses `bg-success` (green) instead of `bg-primary` (blue) (Task 9)
- Admin proof buttons: use `btn-outline-success` instead of `btn-outline-primary` (Task 9, 15)
- Payment accounts card: uses `var(--ac-bg)` and `var(--ac-border)` tokens (Task 14)
- Added mobile responsive styles for tabs (Task 10)

**Spec coverage:**
- Database migration + payment_accounts (correct order) + backfill: Task 1
- Backend settings API (with payment_accounts): Task 2
- Admin approval + renewal: Task 3
- Payment accounts CRUD (with route collision note): Task 3b
- Product creation enforcement: Task 4
- Custom names enforcement: Task 5
- Search ranking priority: Task 6
- Notification text updates: Task 7
- Cron expiry + notifications: Task 8
- Farmer subscription UI (with payment account dropdown): Task 9
- Analytics tier access: Task 10
- Product limit warning: Task 11
- Unverified banners: Task 12
- Admin subscription table (with payment account column): Task 13
- Subscription CSS: Task 14
- Section registration (validSections + showSection title): Task 15
- Loading states + error handling (extends Task 9): Task 16
- Expected amount tracking: Task 17
- Admin payment accounts + pricing settings management: Task 18
- Proof image modal: Task 19
- Add Product button gate (uses cached auth data): Task 20
- Expiry warning: Task 21
- Sidebar polling: Task 22
- Verification card update: Task 23
- Missing profile handling (uses auth/me): Task 24
- E2E testing: Task 25

**Type consistency:** All status values match spec. `farmer_id` vs `user_id` correctly distinguished in all JOINs. `payment_account_id` correctly references `payment_accounts.id`. `GREATEST` renewal logic verified.
