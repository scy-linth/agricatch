class SupportTicketChat {
    constructor() {
        // Resolve API base by host
        const host = window.location.hostname;
        const isCustomFrontendHost = host === 'agricatch.store' ||
            host === 'www.agricatch.store' ||
            host.includes('agricatch.store') ||
            host === 'agricatch.page.dev';
        this.apiBase = window.API_BASE || (isCustomFrontendHost ? 'https://agricatch.onrender.com/api' : '/api');
        this.token = localStorage.getItem('token');
        this.currentTicketId = null;
        this.pollInterval = null;
        this.conversationMeta = new Map();
        this.currentUserId = this.getUserId();
        this._lastMarkReadAt = 0;
        this.MAX_MESSAGE_LENGTH = 500;
        window.supportTicketChat = this;

        // Support filter state
        this.supportFilter = {
            status: 'open',
            search: '',
            page: 1
        };

        if (!this.token || !this.currentUserId) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/?login=1&returnUrl=${returnUrl}`;
            return;
        }

        this.init();
    }

    getUserId() {
        const token = this.token;
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.user_id || payload.id;
        } catch (e) {
            return null;
        }
    }

    async init() {
        await this.loadSupportTickets();
        this.setupEventListeners();
    }

    openMostRecentTicket() {
        const first = document.querySelector('#support-chat-conversation-list .conversation-item[data-id]:not([style*="display: none"]):not([style*="display:none"])');
        if (!first) return;
        const ticketId = first.getAttribute('data-id');
        if (ticketId) {
            this.openTicket(ticketId);
        }
    }

    // Call this when the support-ticket-chat section becomes visible
    onSectionVisible() {
        if (!this.currentTicketId) {
            setTimeout(() => this.openMostRecentTicket(), 100);
        }
    }

    setupEventListeners() {
        const form = document.getElementById('support-chat-form');
        if (form) {
            form.addEventListener('submit', (e) => this.sendMessage(e));
        }
        const input = document.getElementById('support-chat-input');
        if (input) {
            input.addEventListener('input', () => this.updateCharCounter());
            input.setAttribute('maxlength', String(this.MAX_MESSAGE_LENGTH));
            this.updateCharCounter();
        }

        // Back button - navigate to support tickets section
        const backBtn = document.getElementById('support-chat-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (window.customerAccount && typeof window.customerAccount.showTab === 'function') {
                    window.customerAccount.showTab('support-tickets');
                } else if (window.farmerDashboard && typeof window.farmerDashboard.showSection === 'function') {
                    window.farmerDashboard.showSection('support-tickets');
                }
            });
        }

        // Search input
        const searchInput = document.getElementById('support-chat-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.supportFilter.search = e.target.value.toLowerCase();
                this.supportFilter.page = 1;
                this.filterConversations();
            });
        }

        // Pagination buttons
        const prevBtn = document.getElementById('support-chat-prev-btn');
        const nextBtn = document.getElementById('support-chat-next-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (this.supportFilter.page > 1) {
                this.supportFilter.page--;
                this.filterConversations();
            }
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            this.supportFilter.page++;
            this.filterConversations();
        });
    }

    updateCharCounter() {
        const input = document.getElementById('support-chat-input');
        const counter = document.getElementById('support-chat-char-counter');
        if (!input || !counter) return;
        const remaining = this.MAX_MESSAGE_LENGTH - input.value.length;
        counter.textContent = `${remaining}`;
        counter.className = remaining < 50 ? 'char-counter char-counter-warning' : 'char-counter';
    }

    async loadSupportTickets() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/my?limit=100`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load support tickets: ${response.status}`);
            }

            const data = await response.json();
            this._ticketItems = data.tickets || [];
            this.renderConversations();
            this.filterConversations();
        } catch (error) {
            console.error('Load support tickets error:', error);
        }
    }

    renderConversations() {
        const list = document.getElementById('support-chat-conversation-list');
        if (!list) return;

        const items = this._ticketItems || [];

        if (!items || items.length === 0) {
            list.innerHTML = '';
            const emptyState = document.getElementById('support-chat-empty-state');
            if (emptyState) emptyState.style.display = 'flex';
            const countEl = document.getElementById('support-chat-conv-count');
            if (countEl) countEl.textContent = '0';
            const pageInfo = document.getElementById('support-chat-page-info');
            if (pageInfo) pageInfo.textContent = '0–0 of 0';
            return;
        }

        this.conversationMeta.clear();

        list.innerHTML = items.map(ticket => this.renderTicketConversationItem(ticket)).join('');

        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                this.openTicket(id);
            });
        });
    }

    renderTicketConversationItem(ticket) {
        const ticketId = String(ticket.id);
        const lastMessageTime = ticket.updated_at || ticket.created_at
            ? this.formatConversationPreviewTime(ticket.updated_at || ticket.created_at)
            : 'No messages';
        const unreadCount = Number(ticket.unread_count || 0);
        const status = ticket.status || 'open';

        this.conversationMeta.set(`ticket_${ticketId}`, {
            type: 'ticket',
            ticketId: ticketId,
            subject: ticket.subject,
            status: ticket.status,
            reason: ticket.description,
            created_at: ticket.created_at
        });

        const firstLetter = ticket.subject.charAt(0).toUpperCase();
        const statusBadge = this.getStatusBadge(status);
        return `
            <div class="conversation-item conversation-item--ticket ${unreadCount > 0 ? 'unread' : ''}" data-id="${ticketId}" data-type="ticket" data-unread="${unreadCount}" data-ticket-status="${status}">
                <div class="conversation-avatar" style="background:#f59e0b;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">${this.escapeHtml(firstLetter)}</div>
                <div style="flex:1;min-width:0;overflow:hidden;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                        <div class="conversation-name">${this.escapeHtml(ticket.subject)}</div>
                        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                            ${statusBadge}
                            ${unreadCount > 0 ? `<span class="conversation-item-unread">${unreadCount}</span>` : ''}
                        </div>
                    </div>
                    <div class="conversation-time">${lastMessageTime}</div>
                </div>
            </div>
        `;
    }

    getStatusBadge(status) {
        const statusStyles = {
            open: { bg: '#dcfce7', color: '#16a34a', label: 'Open' },
            in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
            resolved: { bg: '#fef3c7', color: '#d97706', label: 'Resolved' },
            closed: { bg: '#fee2e2', color: '#dc2626', label: 'Closed' }
        };
        const style = statusStyles[status] || statusStyles.open;
        return `<span class="ticket-status-badge" style="background:${style.bg};color:${style.color};font-size:0.7rem;font-weight:600;padding:2px 8px;border-radius:9999px;text-transform:uppercase;white-space:nowrap;">${style.label}</span>`;
    }

    filterConversations() {
        const allItems = Array.from(document.querySelectorAll('#support-chat-conversation-list .conversation-item'));
        const pageSize = 10;
        const page = this.supportFilter.page || 1;

        const matching = allItems.filter(item => {
            const itemName = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
            const searchMatch = this.supportFilter.search === '' || itemName.includes(this.supportFilter.search);
            return searchMatch;
        });

        const totalMatching = matching.length;
        const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
        const currentPage = Math.min(page, totalPages);
        this.supportFilter.page = currentPage;

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = matching.slice(start, end);

        allItems.forEach(item => item.style.display = 'none');
        pageItems.forEach(item => item.style.display = '');

        const countEl = document.getElementById('support-chat-conv-count');
        if (countEl) countEl.textContent = totalMatching;

        const prevBtn = document.getElementById('support-chat-prev-btn');
        const nextBtn = document.getElementById('support-chat-next-btn');
        const pageInfo = document.getElementById('support-chat-page-info');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        if (pageInfo) {
            const from = totalMatching === 0 ? 0 : start + 1;
            const to = Math.min(end, totalMatching);
            pageInfo.textContent = `${from}–${to} of ${totalMatching}`;
        }

        const emptyState = document.getElementById('support-chat-empty-state');
        if (emptyState) {
            emptyState.style.display = totalMatching === 0 ? 'flex' : 'none';
        }
    }

    async openTicket(ticketId) {
        if (!ticketId) return;

        this.currentTicketId = ticketId;

        document.querySelectorAll('#support-chat-conversation-list .conversation-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeEl = document.querySelector(`#support-chat-conversation-list .conversation-item[data-id="${ticketId}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
        }

        const meta = this.conversationMeta.get(`ticket_${ticketId}`);
        const titleEl = document.getElementById('support-chat-header-title');
        const subtitleEl = document.getElementById('support-chat-header-subtitle');
        const reasonEl = document.getElementById('support-chat-header-reason');
        const reasonTextEl = document.getElementById('support-chat-reason-text');
        const ticketNumberEl = document.getElementById('support-chat-ticket-number');
        const ticketIdEl = document.getElementById('support-chat-ticket-id');
        const avatarEl = document.querySelector('#support-chat-header .chat-thread-avatar');
        const chatForm = document.getElementById('support-chat-form');
        const chatInput = document.getElementById('support-chat-input');
        const chatSendBtn = document.querySelector('#support-chat-form button[type="submit"]');

        if (titleEl) {
            titleEl.innerHTML = `<strong>Subject:</strong> ${this.escapeHtml(meta?.subject || 'Support Ticket')}`;
        }
        if (reasonEl && reasonTextEl) {
            reasonEl.style.display = 'block';
            reasonTextEl.textContent = meta?.reason || '—';
        }
        if (subtitleEl) {
            subtitleEl.textContent = '';
        }
        if (ticketNumberEl && ticketIdEl) {
            ticketNumberEl.style.display = 'block';
            ticketIdEl.textContent = ticketId;
        }
        if (avatarEl) {
            avatarEl.innerHTML = `<i class="bi bi-ticket-perforated"></i>`;
        }

        // Check if ticket is closed/resolved and disable chat
        const isClosed = meta?.status === 'closed' || meta?.status === 'resolved';
        if (isClosed) {
            if (chatForm) chatForm.style.display = 'none';
            if (subtitleEl) {
                subtitleEl.textContent = 'This ticket has been closed. No further messages can be sent.';
                subtitleEl.style.color = '#dc3545';
            }
        } else {
            if (chatForm) chatForm.style.display = 'flex';
            if (chatInput) chatInput.disabled = false;
            if (chatSendBtn) chatSendBtn.disabled = false;
        }

        await this.loadTicketMessages(ticketId);

        // Reload tickets to update unread counts (backend marks as read)
        await this.loadSupportTickets();

        // Update parent badge (farmer or customer)
        if (window.farmerDashboard && typeof window.farmerDashboard.updateSupportTicketsBadge === 'function') {
            window.farmerDashboard.updateSupportTicketsBadge();
        } else if (window.customerAccount && typeof window.customerAccount.updateSupportTicketsBadge === 'function') {
            await window.customerAccount.loadSupportTicketsBadge();
            window.customerAccount.updateSupportTicketsBadge();
        }

        // Re-apply active class after re-render
        const activeElAfterRender = document.querySelector(`#support-chat-conversation-list .conversation-item[data-id="${ticketId}"]`);
        if (activeElAfterRender) {
            activeElAfterRender.classList.add('active');
        }

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = setInterval(() => {
            if (this.currentTicketId === ticketId) {
                this.loadTicketMessages(ticketId, false, false); // Don't mark as read during polling
            }
        }, 3000);
    }

    async loadTicketMessages(ticketId, forceScroll = false, markRead = true) {
        if (!ticketId) return;

        try {
            // Call the messages endpoint with mark_read parameter to trigger backend mark-as-read
            const markReadParam = markRead ? 'true' : 'false';
            const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}/messages?mark_read=${markReadParam}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load ticket messages: ${response.status}`);
            }

            const data = await response.json();
            this.renderTicketMessages(data.messages || [], forceScroll);
        } catch (error) {
            console.error('Load ticket messages error:', error);
        }
    }

    renderTicketMessages(messages, forceScroll = false) {
        const container = document.getElementById('support-chat-messages');
        if (!container) return;

        // Check if user is near bottom before re-rendering
        const wasNearBottom = this.isNearBottom(container);

        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
            return;
        }

        const sortedMessages = [...messages].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        );

        const groups = [];
        let currentGroup = null;

        sortedMessages.forEach((msg, index) => {
            const isSent = msg.sender_id === this.currentUserId;
            const msgDate = new Date(msg.created_at);

            if (!currentGroup) {
                currentGroup = {
                    senderId: msg.sender_id,
                    lastMessageTime: msgDate,
                    messages: [msg]
                };
            } else {
                const timeDiff = (msgDate - currentGroup.lastMessageTime) / 60000;
                const sameSender = msg.sender_id === currentGroup.senderId;

                if (sameSender && timeDiff < 5) {
                    currentGroup.messages.push(msg);
                    currentGroup.lastMessageTime = msgDate;
                } else {
                    groups.push(currentGroup);
                    currentGroup = {
                        senderId: msg.sender_id,
                        lastMessageTime: msgDate,
                        messages: [msg]
                    };
                }
            }
        });

        if (currentGroup) {
            groups.push(currentGroup);
        }

        let html = '';
        let lastSeparatorTime = null;
        let lastDay = null;

        groups.forEach((group, groupIndex) => {
            const firstMsg = group.messages[0];
            const firstMsgDate = new Date(firstMsg.created_at);
            const isSent = firstMsg.sender_id === this.currentUserId;

            const currentDay = firstMsgDate.toDateString();
            if (currentDay !== lastDay) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const msgDay = new Date(firstMsgDate);
                msgDay.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today - msgDay) / 86400000);

                let dayLabel = '';
                if (diffDays === 0) {
                    dayLabel = 'Today';
                } else if (diffDays === 1) {
                    dayLabel = 'Yesterday';
                } else if (diffDays < 7) {
                    dayLabel = firstMsgDate.toLocaleDateString('en-US', {
                        timeZone: 'Asia/Manila',
                        weekday: 'long'
                    });
                } else {
                    dayLabel = firstMsgDate.toLocaleDateString('en-US', {
                        timeZone: 'Asia/Manila',
                        month: 'short',
                        day: 'numeric'
                    });
                }

                html += `<div class="chat-date-divider">${dayLabel}</div>`;
                lastDay = currentDay;
                lastSeparatorTime = null;
            }

            const needsSeparator =
                groupIndex === 0 ||
                lastSeparatorTime === null ||
                (firstMsgDate - lastSeparatorTime) / 60000 > 30;

            if (needsSeparator) {
                html += `<div class="chat-timestamp-separator">${this.formatTimestampSeparator(firstMsg.created_at)}</div>`;
                lastSeparatorTime = firstMsgDate;
            }

            html += `<div class="chat-msg-group ${isSent ? 'sent' : 'received'}">`;

            group.messages.forEach((msg, msgIndex) => {
                const msgIsSent = msg.sender_id === this.currentUserId;
                const senderName = msgIsSent ? 'You' : (msg.sender_role === 'admin' ? 'Support Admin' : 'Support');
                const exactTime = this.formatExactTimestamp(msg.created_at);

                html += `
                    <div class="chat-msg ${msgIsSent ? 'sent' : 'received'}" title="${exactTime}">
                        <div class="chat-msg-bubble">
                            <p class="chat-msg-text">${this.escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        });

        // Add system message if ticket is closed/resolved
        const meta = this.conversationMeta.get(`ticket_${this.currentTicketId}`);
        if (meta && (meta.status === 'closed' || meta.status === 'resolved')) {
            const statusLabel = meta.status === 'closed' ? 'closed' : 'resolved';
            html += `
                <div class="chat-system-message">
                    <i class="bi bi-check-circle-fill"></i>
                    <span>Ticket ${statusLabel}. Thank you for contacting support.</span>
                </div>
            `;
        }

        container.innerHTML = html;
        // Auto-scroll if user was near bottom, this is initial load, or forceScroll is true
        if (wasNearBottom || !this._hasLoadedMessages || forceScroll) {
            this.scrollToBottom();
        }
        this._hasLoadedMessages = true;
    }

    formatExactTimestamp(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    formatTimestampSeparator(date) {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / 86400000);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const msgDate = new Date(d);
        msgDate.setHours(0, 0, 0, 0);

        const timeStr = d.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Manila',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        if (msgDate.getTime() === today.getTime()) {
            return `Today at ${timeStr}`;
        }
        if (msgDate.getTime() === yesterday.getTime()) {
            return `Yesterday at ${timeStr}`;
        }
        if (diffDays < 7) {
            const dayName = d.toLocaleDateString('en-US', {
                timeZone: 'Asia/Manila',
                weekday: 'long'
            });
            return `${dayName} at ${timeStr}`;
        }
        return d.toLocaleDateString('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ` at ${timeStr}`;
    }

    formatConversationPreviewTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    isNearBottom(container) {
        if (!container) return true;
        const threshold = 100;
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }

    scrollToBottom() {
        const container = document.getElementById('support-chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    async sendMessage(e) {
        e.preventDefault();

        if (!this.currentTicketId) {
            this.showError('Please select a ticket first.');
            return;
        }

        // Check if ticket is closed/resolved
        const meta = this.conversationMeta.get(`ticket_${this.currentTicketId}`);
        if (meta && (meta.status === 'closed' || meta.status === 'resolved')) {
            this.showError('This ticket has been closed. No further messages can be sent.');
            return;
        }

        const input = document.getElementById('support-chat-input');
        if (!input || !input.value.trim()) return;

        const messageText = input.value.trim();

        if (messageText.length > this.MAX_MESSAGE_LENGTH) {
            this.showError(`Message too long. Maximum ${this.MAX_MESSAGE_LENGTH} characters.`);
            return;
        }

        input.value = '';
        this.updateCharCounter();

        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ message: messageText })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to send message');
            }

            await this.loadTicketMessages(this.currentTicketId, true);
            await this.loadSupportTickets();
            
            // Update parent badge (farmer or customer)
            if (window.farmerDashboard && typeof window.farmerDashboard.updateSupportTicketsBadge === 'function') {
                window.farmerDashboard.updateSupportTicketsBadge();
            } else if (window.customerAccount && typeof window.customerAccount.updateSupportTicketsBadge === 'function') {
                await window.customerAccount.loadSupportTicketsBadge();
                window.customerAccount.updateSupportTicketsBadge();
            }
            
            // Force scroll after everything is loaded using requestAnimationFrame
            requestAnimationFrame(() => {
                requestAnimationFrame(() => this.scrollToBottom());
            });
        } catch (error) {
            console.error('Send message error:', error);
            this.showError(error.message || 'Failed to send message. Please try again.');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error('SupportTicketChat error:', message);
        alert(message);
    }
}

// Initialize support ticket chat when DOM is loaded
let supportTicketChat;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('support-ticket-chat')) {
        supportTicketChat = new SupportTicketChat();
    }
});
