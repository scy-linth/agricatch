class ChatUI {
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.currentConversation = null;
        this.pollInterval = null;
        this.conversationMeta = new Map();
        this.currentUserId = this.getUserId();
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
        await this.loadConversations();
        this.handleDeepLink();
        this.setupEventListeners();
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
                ? this.formatTime(conv.last_message_at) 
                : 'No messages';

            // Store metadata for later use
            this.conversationMeta.set(String(conversationId), {
                otherName: otherName,
                otherId: this.currentUserId === conv.farmer_id ? conv.customer_id : conv.farmer_id,
                conversationId: conversationId
            });

            return `
                <div class="conversation-item" data-id="${conversationId}">
                    <div class="conversation-name">${otherName}</div>
                    <div class="conversation-time">${lastMessageTime}</div>
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
        
        if (titleEl) {
            titleEl.textContent = meta?.otherName || 'Chat';
        }
        if (subtitleEl) {
            const ctx = window.__chatContext;
            subtitleEl.textContent = ctx?.subtitle || 'Online';
        }

        // Load messages
        await this.loadMessages(conversationId);
        
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
        } catch (error) {
            console.error('Load messages error:', error);
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

        container.innerHTML = messages.map(msg => {
            const isSent = msg.sender_id === this.currentUserId;
            const senderName = isSent ? 'You' : otherName;
            const time = this.formatTime(msg.created_at);

            return `
                <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                    <span class="message-sender">${senderName}</span>
                    <p class="message-text">${this.escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
                    <span class="message-time">${time}</span>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
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

        if (farmerIdParam && this.currentUserId) {
            const conversationId = `${farmerIdParam}_${this.currentUserId}`;
            this.ensureConversationMeta(conversationId, parseInt(farmerIdParam, 10), 'Farmer');
            if (orderIdParam) {
                window.__chatContext = { subtitle: `Order #${orderIdParam}` };
            }
            this.openConversation(conversationId);
        } else if (customerIdParam && this.currentUserId) {
            const conversationId = `${this.currentUserId}_${customerIdParam}`;
            this.ensureConversationMeta(conversationId, parseInt(customerIdParam, 10), 'Customer');
            if (orderIdParam) {
                window.__chatContext = { subtitle: `Order #${orderIdParam}` };
            }
            this.openConversation(conversationId);
        }
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

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
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
    // Only initialize if we're on chat.html or if chat elements exist in farmer dashboard
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && !window.chatUI) {
        window.chatUI = new ChatUI();
    }
});
