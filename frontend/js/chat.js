class ChatUI {
    constructor() {
        // Resolve API base by host so chat works even without app.js.
        const host = window.location.hostname;
        const isCustomFrontendHost = host === 'agricatch.store' ||
            host === 'www.agricatch.store' ||
            host.includes('agricatch.store') ||
            host === 'agricatch.page.dev';
        this.apiBase = window.API_BASE || (isCustomFrontendHost ? 'https://agricatch.onrender.com/api' : '/api');
        this.token = localStorage.getItem('token');
        this.currentConversation = null;
        this.pollInterval = null;
        this.conversationMeta = new Map();
        this.currentUserId = this.getUserId();
        this._lastMarkReadAt = 0;
        window.chatUI = this;
        
        if (!this.token || !this.currentUserId) {
            // Preserve deep link parameters
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/?login=1&returnUrl=${returnUrl}`;
            return;
        }
        
        this.init();
    }

    async init() {
        this.configureBackButton();
        await this.loadConversations();
        const openedDeepLink = this.handleDeepLink();
        if (!openedDeepLink) {
            this.openMostRecentConversation();
        }
        this.setupEventListeners();
    }

    configureBackButton() {
        const backBtn = document.getElementById('back-to-shop-btn');
        if (!backBtn) return;
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl');
        if (returnUrl) {
            backBtn.setAttribute('href', decodeURIComponent(returnUrl));
        } else {
            backBtn.setAttribute('href', '/#products');
        }
    }

    openMostRecentConversation() {
        const first = document.querySelector('.conversation-item[data-id]');
        if (!first) return;
        const firstId = first.getAttribute('data-id');
        if (firstId) {
            this.openConversation(firstId);
        }
    }

    setupEventListeners() {
        const form = document.getElementById('chat-form');
        if (form) {
            form.addEventListener('submit', (e) => this.sendMessage(e));
        }
    }

    async loadConversations() {
        try {
            const response = await fetch(`${this.apiBase}/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load conversations: ${response.status}`);
            }

            const data = await response.json();
            this.renderConversations(data.conversations || []);
        } catch (error) {
            console.error('Load conversations error:', error);
            this.showError('Failed to load conversations. Please refresh the page.');
        }
    }

    renderConversations(conversations) {
        const list = document.getElementById('conversation-list');
        if (!list) return;

        if (!conversations || conversations.length === 0) {
            list.innerHTML = '<div class="empty-state">No conversations yet. Start chatting with a farmer!</div>';
            return;
        }

        // Clear and rebuild conversation metadata
        this.conversationMeta.clear();
        
        list.innerHTML = conversations.map(conv => {
            const conversationId = conv.conversation_id || `${conv.farmer_id}_${conv.customer_id}`;
            const otherName = conv.other_name || conv.other_username || 'Unknown User';
            const lastMessageTime = conv.last_message_at
                ? this.formatConversationPreviewTime(conv.last_message_at)
                : 'No messages';
            const unreadCount = Number(conv.unread_count || 0);

            // Store metadata for later use
            this.conversationMeta.set(String(conversationId), {
                otherName: otherName,
                otherId: this.currentUserId === conv.farmer_id ? conv.customer_id : conv.farmer_id,
                conversationId: conversationId
            });

            const firstLetter = otherName.charAt(0).toUpperCase();
            return `
                <div class="conversation-item ${unreadCount > 0 ? 'unread' : ''}" data-id="${conversationId}" data-unread="${unreadCount}">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="conversation-avatar" style="background:var(--ac-primary);color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">${firstLetter}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                <div class="conversation-name">${otherName}</div>
                                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                            </div>
                            <div class="conversation-time">${lastMessageTime}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                this.openConversation(id);
            });
        });
    }

    async openConversation(conversationId) {
        if (!conversationId) return;

        this.currentConversation = conversationId;

        // Update active state in conversation list
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeEl = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
        }

        // Update chat header
        const meta = this.conversationMeta.get(String(conversationId));
        const titleEl = document.getElementById('chat-header-title');
        const subtitleEl = document.getElementById('chat-header-subtitle');
        const avatarEl = document.querySelector('.chat-thread-avatar');

        if (titleEl) {
            titleEl.textContent = meta?.otherName || 'Chat';
        }
        if (subtitleEl) {
            const ctx = window.__chatContext;
            subtitleEl.textContent = ctx?.subtitle || 'Online';
        }
        if (avatarEl && meta?.otherName) {
            const firstLetter = meta.otherName.charAt(0).toUpperCase();
            avatarEl.innerHTML = `<span>${firstLetter}</span>`;
        }

        // Load messages
        await this.loadMessages(conversationId);

        // Only mark as read if not on admin page (admin page should not auto-mark on page load)
        const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;
        if (!isAdminPage) {
            await this.markConversationRead(conversationId);
        }

        // Start polling for new messages
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = setInterval(() => {
            if (this.currentConversation === conversationId) {
                this.loadMessages(conversationId);
            }
        }, 3000);
    }

    async loadMessages(conversationId) {
        if (!conversationId) return;

        try {
            const response = await fetch(`${this.apiBase}/messages/conversation/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.status}`);
            }

            const data = await response.json();
            this.renderMessages(data.messages || []);

            // Mark as read after rendering (throttled)
            const now = Date.now();
            if (now - (this._lastMarkReadAt || 0) > 2500) {
                this._lastMarkReadAt = now;
                await this.markConversationRead(conversationId);
            }
        } catch (error) {
            console.error('Load messages error:', error);
        }
    }

    async markConversationRead(conversationId) {
        try {
            if (!conversationId) return;
            const res = await fetch(`${this.apiBase}/messages/conversation/${encodeURIComponent(conversationId)}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) return;

            // Refresh farmer dashboard unread badges immediately (if embedded)
            if (window.farmerDashboard && typeof window.farmerDashboard.loadFarmerStats === 'function') {
                window.farmerDashboard.loadFarmerStats({ skipProducts: true });
            }
        } catch (_) {
            // ignore
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
            return;
        }

        const meta = this.conversationMeta.get(String(this.currentConversation));
        const otherName = meta?.otherName || 'User';

        // Sort messages by timestamp
        const sortedMessages = [...messages].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        );

        // Group messages: same sender within 5 minutes
        const groups = [];
        let currentGroup = null;

        sortedMessages.forEach((msg, index) => {
            const isSent = msg.sender_id === this.currentUserId;
            const msgDate = new Date(msg.created_at);

            if (!currentGroup) {
                // First message - start new group
                currentGroup = {
                    senderId: msg.sender_id,
                    startTime: msgDate,
                    messages: [msg]
                };
            } else {
                const timeDiff = (msgDate - currentGroup.startTime) / 60000; // minutes
                const sameSender = msg.sender_id === currentGroup.senderId;

                if (sameSender && timeDiff < 5) {
                    // Same group
                    currentGroup.messages.push(msg);
                } else {
                    // New group
                    groups.push(currentGroup);
                    currentGroup = {
                        senderId: msg.sender_id,
                        startTime: msgDate,
                        messages: [msg]
                    };
                }
            }
        });

        // Don't forget the last group
        if (currentGroup) {
            groups.push(currentGroup);
        }

        // Render groups with separators and dividers
        let html = '';
        let lastSeparatorTime = null;
        let lastDay = null;

        groups.forEach((group, groupIndex) => {
            const firstMsg = group.messages[0];
            const firstMsgDate = new Date(firstMsg.created_at);
            const isSent = firstMsg.sender_id === this.currentUserId;

            // Check if we need a date divider (new day)
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
                lastSeparatorTime = null; // Reset separator time on new day
            }

            // Check if we need a timestamp separator
            const needsSeparator =
                groupIndex === 0 || // First group
                lastSeparatorTime === null ||
                (firstMsgDate - lastSeparatorTime) / 60000 > 30; // >30 min gap

            if (needsSeparator) {
                html += `<div class="chat-timestamp-separator">${this.formatTimestampSeparator(firstMsg.created_at)}</div>`;
                lastSeparatorTime = firstMsgDate;
            }

            // Render group
            html += `<div class="chat-msg-group ${isSent ? 'sent' : 'received'}">`;

            group.messages.forEach((msg, msgIndex) => {
                const isLastInGroup = msgIndex === group.messages.length - 1;
                const msgIsSent = msg.sender_id === this.currentUserId;
                const senderName = msgIsSent ? 'You' : otherName;
                const exactTime = this.formatExactTimestamp(msg.created_at);

                html += `
                    <div class="chat-msg ${msgIsSent ? 'sent' : 'received'}" title="${exactTime}">
                        <div class="chat-msg-bubble">
                            ${isLastInGroup ? `<span class="chat-msg-sender">${senderName}</span>` : ''}
                            <p class="chat-msg-text">${this.escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        });

        container.innerHTML = html;

        // Smart auto-scroll: scroll to bottom if user is near bottom (within 100px)
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }

    async sendMessage(e) {
        e.preventDefault();
        
        if (!this.currentConversation) {
            this.showError('Please select a conversation first.');
            return;
        }

        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;

        const messageText = input.value.trim();
        input.value = '';

        // Get receiver ID from conversation metadata
        const meta = this.conversationMeta.get(String(this.currentConversation));
        if (!meta || !meta.otherId) {
            this.showError('Unable to determine recipient. Please refresh the page.');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    receiver_id: parseInt(meta.otherId, 10),
                    message: messageText
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to send message');
            }

            // Reload messages immediately
            await this.loadMessages(this.currentConversation);
            
            // Reload conversations to update last message time
            await this.loadConversations();
        } catch (error) {
            console.error('Send message error:', error);
            this.showError(error.message || 'Failed to send message. Please try again.');
            // Restore input value on error
            input.value = messageText;
        }
    }

    handleDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const farmerIdParam = params.get('farmerId');
        const customerIdParam = params.get('customerId');
        const orderIdParam = params.get('orderId');
        const productNameParam = params.get('productName');
        const quantityParam = Number(params.get('quantity') || 0);

        const subtitleParts = [];
        if (orderIdParam) subtitleParts.push(`Pre-order #${orderIdParam}`);
        if (productNameParam) subtitleParts.push(decodeURIComponent(productNameParam));
        if (quantityParam > 0) subtitleParts.push(`Qty: ${quantityParam}`);
        const subtitleText = subtitleParts.join(' · ');

        if (farmerIdParam && this.currentUserId) {
            const conversationId = `${farmerIdParam}_${this.currentUserId}`;
            this.ensureConversationMeta(conversationId, parseInt(farmerIdParam, 10), 'Farmer');
            if (subtitleText) {
                window.__chatContext = { subtitle: subtitleText };
            }
            this.openConversation(conversationId);
            return true;
        } else if (customerIdParam && this.currentUserId) {
            const conversationId = `${this.currentUserId}_${customerIdParam}`;
            this.ensureConversationMeta(conversationId, parseInt(customerIdParam, 10), 'Customer');
            if (subtitleText) {
                window.__chatContext = { subtitle: subtitleText };
            }
            this.openConversation(conversationId);
            return true;
        }
        return false;
    }

    ensureConversationMeta(conversationId, otherId, otherName = 'User') {
        const key = String(conversationId);
        if (this.conversationMeta.has(key)) return;
        this.conversationMeta.set(key, {
            otherName,
            otherId,
            conversationId
        });
    }

    openConversationWithFarmer(farmerId, farmerName = 'Farmer') {
        if (!farmerId || !this.currentUserId) return;
        const conversationId = `${farmerId}_${this.currentUserId}`;
        this.ensureConversationMeta(conversationId, parseInt(farmerId, 10), farmerName);
        this.openConversation(conversationId);
    }

    getUserId() {
        try {
            if (!this.token) return null;
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.id;
        } catch (error) {
            console.error('Error parsing token:', error);
            return null;
        }
    }

    // Date/Time Utility Functions
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

        const currentYear = now.getFullYear();
        const msgYear = d.getFullYear();
        if (msgYear === currentYear) {
            return d.toLocaleDateString('en-US', {
                timeZone: 'Asia/Manila',
                month: 'short',
                day: 'numeric'
            }) + ` at ${timeStr}`;
        }

        return d.toLocaleDateString('en-US', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) + ` at ${timeStr}`;
    }

    formatConversationPreviewTime(date) {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) {
            return d.toLocaleDateString('en-US', {
                timeZone: 'Asia/Manila',
                weekday: 'short'
            });
        }
        return d.toLocaleDateString('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric'
        });
    }

    isSameDay(date1, date2) {
        if (!date1 || !date2) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        return d1.getTime() === d2.getTime();
    }

    isWithinMinutes(date, minutes) {
        if (!date) return false;
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        return diffMins <= minutes;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    showError(message) {
        // Simple error display - could be enhanced with toast notifications
        console.error(message);
        const container = document.getElementById('chat-messages');
        if (container) {
            container.innerHTML = `<div class="error-state">${this.escapeHtml(message)}</div>`;
        }
    }
}

// Initialize ChatUI - works for both standalone chat.html and embedded chat in farmer.html
document.addEventListener('DOMContentLoaded', () => {
    // Initialize if we're on chat.html or if chat elements exist in farmer dashboard or admin dashboard
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && !window.chatUI) {
        window.chatUI = new ChatUI();
    }
});
