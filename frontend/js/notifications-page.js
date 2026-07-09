// notifications-page.js — Full notifications list with pagination and mark-as-read
'use strict';

class NotificationsPage {
    constructor() {
        this.apiBase = '/api';
        const host = String(window.location.hostname || '').toLowerCase();
        if (host === 'agricatch.store' || host === 'www.agricatch.store') {
            this.apiBase = 'https://agricatch.onrender.com/api';
        }
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        this.currentPage = 1;
        this.limit = 20;
        this.total = 0;
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

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    init() {
        if (!this.token) {
            this.showGuestLoginPrompt();
            return;
        }
        document.getElementById('notif-mark-all-btn')?.addEventListener('click', () => this.markAllRead());
        this.loadPage(1);
    }

    showGuestLoginPrompt() {
        // Show toast message
        this.showToast('Please log in to view your notifications', 'info');
        
        // Store return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        
        // Redirect to home with login prompt
        setTimeout(() => {
            window.location.href = `/?login=1&returnUrl=${returnUrl}`;
        }, 1500);
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 12px 20px;
            border-radius: 8px;
            background: ${type === 'info' ? '#0ea5e9' : '#ef4444'};
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        
        // Add animation keyframes if not exists
        if (!document.getElementById('toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async loadPage(page) {
        this.currentPage = page;
        const list = document.getElementById('notifications-page-list');
        const subtitle = document.getElementById('notif-page-subtitle');
        if (list) list.innerHTML = (window.renderEmptyState || function() { return ''; })({
            icon: 'fas fa-spinner fa-pulse',
            title: 'Loading...'
        });

        try {
            const response = await fetch(
                `${this.apiBase}/notifications?page=${page}&limit=${this.limit}`,
                { headers: { 'Authorization': `Bearer ${this.token}` } }
            );

            if (!response.ok) {
                if (response.status === 401) { window.location.href = '/?login=1'; return; }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const notifications = data.notifications || [];
            this.total = data.total || notifications.length;
            const totalPages = data.totalPages || Math.ceil(this.total / this.limit) || 1;

            const unreadCount = notifications.filter((n) => !n.is_read).length;
            if (subtitle) {
                subtitle.textContent = this.total > 0
                    ? `${this.total} notification${this.total !== 1 ? 's' : ''}${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`
                    : 'No notifications yet.';
            }

            this._renderList(notifications, list);
            this._renderPagination(totalPages);
        } catch (err) {
            console.error('Load notifications error:', err);
            if (list) list.innerHTML = (window.renderEmptyState || function() { return ''; })({
                icon: 'fas fa-exclamation-circle',
                title: 'Unable to load notifications',
                description: 'Please try again.'
            });
        }
    }

    _renderList(notifications, container) {
        if (!container) return;
        if (!notifications.length) {
            container.innerHTML = (window.renderEmptyState || function() { return ''; })({
                icon: 'fas fa-bell-slash',
                title: 'No notifications yet',
                description: 'You\'ll see updates here when there\'s new activity.'
            });
            return;
        }

        container.innerHTML = notifications.map((n) => {
            const isRead = Boolean(n.is_read);
            const date = n.created_at ? FormatUtil.formatDate(n.created_at, {"month":"short","day":"numeric"}) : '—';
            const icon = this._getIcon(n.type);
            const bg = isRead ? '#fff' : '#eff6ff';
            const borderColor = isRead ? '#e5e7eb' : '#bfdbfe';

            return `<div class="notif-item" data-id="${n.id}" style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:8px;border:1px solid ${borderColor};background:${bg};cursor:default;">
                <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:1rem;margin-top:2px;">
                    <i class="${icon}"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:${isRead ? '400' : '600'};font-size:0.97rem;color:#111827;margin-bottom:2px;">${this.escapeHtml(n.message || 'Notification')}</div>
                    <div style="font-size:0.83rem;color:#6b7280;">${date}</div>
                    ${n.order_id ? `<div style="font-size:0.83rem;color:#3b82f6;margin-top:2px;"><a href="/orders.html?highlightOrderId=${n.order_id}" style="color:inherit;">View Pre-order #${n.order_id}</a></div>` : ''}
                </div>
                ${!isRead ? `<button class="btn btn-small btn-secondary notif-read-btn" data-notif-id="${n.id}" style="flex-shrink:0;white-space:nowrap;" title="Mark as read">
                    <i class="fas fa-check"></i>
                </button>` : ''}
            </div>`;
        }).join('');

        // Bind individual mark-read buttons
        container.querySelectorAll('.notif-read-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-notif-id');
                await this.markRead(id);
                this.loadPage(this.currentPage);
            });
        });
    }

    _getIcon(type) {
        const icons = {
            'order': 'fas fa-shopping-bag',
            'order_status': 'fas fa-truck',
            'message': 'fas fa-comment',
            'system': 'fas fa-info-circle',
            'promotion': 'fas fa-tag',
        };
        return icons[type] || 'fas fa-bell';
    }

    _renderPagination(totalPages) {
        const container = document.getElementById('notif-pagination');
        if (!container) return;
        if (totalPages <= 1) { container.innerHTML = ''; return; }

        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            const isActive = i === this.currentPage;
            html += `<button class="btn btn-small ${isActive ? 'btn-primary' : 'btn-secondary'}" onclick="notifPage.loadPage(${i})" ${isActive ? 'disabled' : ''}>${i}</button>`;
        }
        container.innerHTML = html;
    }

    async markRead(id) {
        try {
            await fetch(`${this.apiBase}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
        } catch (err) {
            console.error('Mark read error:', err);
        }
    }

    async markAllRead() {
        const btn = document.getElementById('notif-mark-all-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Marking...'; }
        try {
            await fetch(`${this.apiBase}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.loadPage(this.currentPage);
        } catch (err) {
            console.error('Mark all read error:', err);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-double"></i> Mark All as Read'; }
        }
    }
}

const notifPage = new NotificationsPage();
