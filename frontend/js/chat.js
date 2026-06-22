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
        this.MAX_MESSAGE_LENGTH = 500;
        window.chatUI = this;

        // Support Center filter state
        this.supportFilter = {
            status: 'open', // open, in_progress, resolved, closed
            search: '',
            page: 1
        };

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
        this.configureCustomerBackButton();
        this.setupTicketDetailModal();
        await this.loadConversations();
        const openedDeepLink = this.handleDeepLink();
        if (!openedDeepLink) {
            this.openMostRecentConversation();
        }
        this.setupEventListeners();
        // Update UI to reflect 'open' as default
        this.updateSupportFilterUI();
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

    configureCustomerBackButton() {
        const backBtn = document.querySelector('header a[href="/customer-account.html"]');
        if (!backBtn) return;
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl');
        if (returnUrl) {
            backBtn.setAttribute('href', decodeURIComponent(returnUrl));
        }
    }

    openMostRecentConversation() {
        const first = document.querySelector('.conversation-item[data-id]:not([style*="display: none"]):not([style*="display:none"])');
        if (!first) return;
        const firstId = first.getAttribute('data-id');
        const firstType = first.getAttribute('data-type');
        if (firstId) {
            if (firstType === 'ticket') {
                this.openTicket(firstId);
            } else {
                this.openConversation(firstId);
            }
        }
    }

    setupEventListeners() {
        const form = document.getElementById('chat-form');
        if (form) {
            form.addEventListener('submit', (e) => this.sendMessage(e));
        }
        const input = document.getElementById('chat-input');
        if (input) {
            input.addEventListener('input', () => this.updateCharCounter());
            input.setAttribute('maxlength', String(this.MAX_MESSAGE_LENGTH));
            this.updateCharCounter();
        }

        // Support Center filter event listeners
        this.setupSupportCenterFilters();
    }

    setupSupportCenterFilters() {
        // Status pills
        document.querySelectorAll('.support-status-tabs .support-status-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.supportFilter.status = e.target.getAttribute('data-status');
                this.supportFilter.page = 1;
                this.updateSupportFilterUI();
                this.filterConversations();
                // Auto-select first conversation after filter applies
                setTimeout(() => this.openMostRecentConversation(), 50);
            });
        });

        // Search input
        const searchInput = document.getElementById('support-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.supportFilter.search = e.target.value.toLowerCase();
                this.supportFilter.page = 1;
                this.filterConversations();
            });
        }

        // Prev/Next pagination buttons
        const prevBtn = document.getElementById('support-prev-btn');
        const nextBtn = document.getElementById('support-next-btn');
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

    updateSupportFilterUI() {
        // Update status pills active state
        document.querySelectorAll('.support-status-tabs .support-status-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === this.supportFilter.status);
        });
    }

    filterConversations() {
        const allItems = Array.from(document.querySelectorAll('.conversation-item'));
        const pageSize = 10;
        const page = this.supportFilter.page || 1;

        // Filter all matching items
        const matching = allItems.filter(item => {
            const itemType = item.getAttribute('data-type');
            const itemName = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
            const itemStatus = item.getAttribute('data-ticket-status') || '';

            // Status filter: 'all' shows both chats and tickets; specific status only shows matching tickets
            let statusMatch = true;
            if (this.supportFilter.status !== 'all') {
                if (itemType === 'ticket') {
                    statusMatch = itemStatus === this.supportFilter.status;
                } else {
                    // chats don't have a ticket status — hide them when a specific status is filtered
                    statusMatch = false;
                }
            }

            const searchMatch = this.supportFilter.search === '' || itemName.includes(this.supportFilter.search);

            return statusMatch && searchMatch;
        });

        const totalMatching = matching.length;
        const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
        const currentPage = Math.min(page, totalPages);
        this.supportFilter.page = currentPage;

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = matching.slice(start, end);

        // Show/hide all items
        allItems.forEach(item => item.style.display = 'none');
        pageItems.forEach(item => item.style.display = '');

        // Update count badge
        const countEl = document.getElementById('support-conv-count');
        if (countEl) countEl.textContent = totalMatching;

        // Update pagination controls
        const prevBtn = document.getElementById('support-prev-btn');
        const nextBtn = document.getElementById('support-next-btn');
        const pageInfo = document.getElementById('support-page-info');
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        if (pageInfo) {
            const from = totalMatching === 0 ? 0 : start + 1;
            const to = Math.min(end, totalMatching);
            pageInfo.textContent = `${from}\u2013${to} of ${totalMatching}`;
        }

        // Empty state
        const emptyState = document.getElementById('chat-empty-state');
        if (emptyState) {
            emptyState.style.display = totalMatching === 0 ? 'flex' : 'none';
        }
    }

    async updateTicketStatus(ticketId, status) {
        if (status === 'closed') {
            const confirmed = await this.showConfirmModal(
                'Are you sure you want to close this ticket?',
                'Close Ticket',
                true
            );
            if (!confirmed) {
                // Revert to previous status
                const meta = this.conversationMeta.get(`ticket_${ticketId}`);
                if (meta) {
                    const statusSelect = document.getElementById('chat-ticket-status-select');
                    if (statusSelect) {
                        statusSelect.value = meta.status;
                    }
                }
                return;
            }
        }

        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('Failed to update ticket status');
            }

            // Update metadata
            const meta = this.conversationMeta.get(`ticket_${ticketId}`);
            if (meta) {
                meta.status = status;
            }

            // Reload conversations to update status badge
            await this.loadConversations();
        } catch (error) {
            console.error('Update ticket status error:', error);
            this.showError('Failed to update ticket status');
            // Revert to previous status
            const meta = this.conversationMeta.get(`ticket_${ticketId}`);
            if (meta) {
                const statusSelect = document.getElementById('chat-ticket-status-select');
                if (statusSelect) {
                    statusSelect.value = meta.status;
                }
            }
        }
    }

    showConfirmModal(message, title = 'Confirm Action', danger = true) {
        return new Promise((resolve) => {
            const modal = document.getElementById('admin-confirm-modal');
            if (!modal) {
                console.warn('[showConfirmModal] Confirm modal not found — using browser confirm');
                resolve(confirm(message));
                return;
            }

            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            const iconEl = document.getElementById('confirm-icon');
            if (iconEl) {
                iconEl.className = danger
                    ? 'ac-confirm-modal__icon ac-confirm-modal__icon--danger'
                    : 'ac-confirm-modal__icon ac-confirm-modal__icon--success';
                iconEl.innerHTML = danger
                    ? '<i class="bi bi-exclamation-triangle-fill"></i>'
                    : '<i class="bi bi-send-check-fill"></i>';
            }
            const okBtn = document.getElementById('confirm-ok-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            okBtn.className = danger ? 'btn btn-sm btn-ac-red' : 'btn btn-sm ac-btn-primary';
            okBtn.textContent = 'Confirm';
            modal.classList.add('open');

            const done = (result) => {
                modal.classList.remove('open');
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(result);
            };

            document.getElementById('confirm-ok-btn').addEventListener('click', () => done(true), { once: true });
            document.getElementById('confirm-cancel-btn').addEventListener('click', () => done(false), { once: true });
        });
    }

    openTicketDetailModal(ticketId) {
        const meta = this.conversationMeta.get(`ticket_${ticketId}`);
        if (!meta) return;

        // Populate modal with ticket details
        document.getElementById('ticket-detail-number').textContent = `#${ticketId}`;
        document.getElementById('ticket-detail-farmer').textContent = meta.farmerName || '—';

        const statusStyles = {
            open: { bg: '#dcfce7', color: '#16a34a', label: 'Open' },
            in_progress: { bg: '#dbeafe', color: '#2563eb', label: 'In Progress' },
            resolved: { bg: '#fef3c7', color: '#d97706', label: 'Resolved' },
            closed: { bg: '#fee2e2', color: '#dc2626', label: 'Closed' }
        };
        const style = statusStyles[meta.status] || statusStyles.open;
        const statusEl = document.getElementById('ticket-detail-status');
        statusEl.innerHTML = `<span style="background:${style.bg};color:${style.color};font-size:0.75rem;font-weight:600;padding:4px 10px;border-radius:9999px;text-transform:uppercase;">${style.label}</span>`;

        // Set status dropdown value
        const statusSelect = document.getElementById('ticket-detail-status-select');
        if (statusSelect) {
            statusSelect.value = meta.status || 'open';
        }

        document.getElementById('ticket-detail-created').textContent = meta.created_at
            ? new Date(meta.created_at).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : '—';

        document.getElementById('ticket-detail-subject').textContent = meta.subject || '—';
        document.getElementById('ticket-detail-reason').textContent = meta.reason || '—';

        // Store ticket ID for status update
        this._detailModalTicketId = ticketId;

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('ticket-detail-modal'));
        modal.show();
    }

    setupTicketDetailModal() {
        const updateBtn = document.getElementById('ticket-detail-update-status-btn');
        const statusSelect = document.getElementById('ticket-detail-status-select');
        if (updateBtn && statusSelect) {
            updateBtn.addEventListener('click', async () => {
                if (!this._detailModalTicketId) return;

                const newStatus = statusSelect.value;
                const statusLabels = {
                    open: 'Open',
                    in_progress: 'In Progress',
                    resolved: 'Resolved',
                    closed: 'Closed'
                };

                let confirmed = false;
                if (newStatus === 'closed') {
                    confirmed = await this.showConfirmModal('Are you sure you want to close this ticket?', 'Close Ticket', true);
                } else {
                    confirmed = await this.showConfirmModal(`Change ticket status to ${statusLabels[newStatus]}?`, 'Update Status', false);
                }

                if (confirmed) {
                    // Close modal immediately
                    const modalEl = document.getElementById('ticket-detail-modal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();

                    // Update status in background
                    this.updateTicketStatus(this._detailModalTicketId, newStatus);
                }
            });
        }
    }

    updateCharCounter() {
        const input = document.getElementById('chat-input');
        const counter = document.getElementById('chat-char-counter');
        if (!input || !counter) return;
        const remaining = this.MAX_MESSAGE_LENGTH - input.value.length;
        counter.textContent = `${remaining}`;
        counter.className = remaining < 50 ? 'char-counter char-counter-warning' : 'char-counter';
    }

    async loadConversations() {
        try {
            const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;

            if (isAdminPage) {
                // On admin page: load both conversations and support tickets
                await Promise.all([
                    this.loadChatConversations(),
                    this.loadSupportTickets()
                ]);
                // Render once after both data sources are ready to avoid visual flash
                this.renderConversations(null, 'combined');
                // Apply filters immediately so the list is visible without waiting for stats
                this.filterConversations();
                await this.loadSupportStats();
            } else {
                // On farmer page: only load customer chats (support tickets have their own section)
                await this.loadChatConversations();
                this.renderConversations(null, 'combined');
            }
        } catch (error) {
            console.error('Load conversations error:', error);
            this.showError('Failed to load conversations. Please refresh the page.');
        }
    }

    async loadChatConversations() {
        try {
            const response = await fetch(`${this.apiBase}/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load conversations: ${response.status}`);
            }

            const data = await response.json();
            this._chatItems = data.conversations || [];
        } catch (error) {
            console.error('Load chat conversations error:', error);
        }
    }

    async loadSupportTickets() {
        try {
            const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;
            const endpoint = isAdminPage ? `${this.apiBase}/support-tickets?limit=100` : `${this.apiBase}/support-tickets/my?limit=100`;
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load support tickets: ${response.status}`);
            }

            const data = await response.json();
            this._ticketItems = data.tickets || [];
        } catch (error) {
            console.error('Load support tickets error:', error);
        }
    }

    async loadSupportStats() {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets?limit=10000`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            this.updateSupportStats(data.tickets || []);
        } catch (error) {
            console.error('Load support stats error:', error);
        }
    }

    updateSupportStats(tickets) {
        const open = tickets.filter(t => t.status === 'open').length;
        const inProgress = tickets.filter(t => t.status === 'in_progress').length;
        const resolved = tickets.filter(t => t.status === 'resolved').length;
        const closed = tickets.filter(t => t.status === 'closed').length;

        const openCount = document.getElementById('support-open-count');
        const inProgressCount = document.getElementById('support-in-progress-count');
        const resolvedCount = document.getElementById('support-resolved-count');
        const closedCount = document.getElementById('support-closed-count');

        if (openCount) openCount.textContent = open;
        if (inProgressCount) inProgressCount.textContent = inProgress;
        if (resolvedCount) resolvedCount.textContent = resolved;
        if (closedCount) closedCount.textContent = closed;
    }

    renderConversations(items, type = 'chat') {
        const list = document.getElementById('conversation-list');
        if (!list) return;

        // For admin page, we need to accumulate items from both types
        if (type === 'chat') {
            this._chatItems = items || [];
        } else if (type === 'ticket') {
            this._ticketItems = items || [];
        }
        // 'combined' renders from already-stored _chatItems and _ticketItems

        // Combine and sort by last activity
        const allItems = [
            ...(this._chatItems || []).map(item => ({ ...item, _type: 'chat' })),
            ...(this._ticketItems || []).map(item => ({ ...item, _type: 'ticket' }))
        ].sort((a, b) => {
            const aTime = a._type === 'chat' ? (a.last_message_at || '') : (a.updated_at || a.created_at || '');
            const bTime = b._type === 'chat' ? (b.last_message_at || '') : (b.updated_at || b.created_at || '');
            return new Date(bTime) - new Date(aTime);
        });

        if (!allItems || allItems.length === 0) {
            list.innerHTML = '';
            const emptyState = document.getElementById('chat-empty-state');
            if (emptyState) emptyState.style.display = 'flex';
            const countEl = document.getElementById('support-conv-count');
            if (countEl) countEl.textContent = '0';
            const pageInfo = document.getElementById('support-page-info');
            if (pageInfo) pageInfo.textContent = '0\u20130 of 0';
            return;
        }

        // Clear and rebuild conversation metadata
        this.conversationMeta.clear();

        // On admin page, render items hidden by default to prevent visual flash before filter applies.
        // On farmer page, render visible since no filtering is applied.
        const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;
        list.innerHTML = allItems.map(item => {
            const html = item._type === 'chat'
                ? this.renderChatConversationItem(item)
                : this.renderTicketConversationItem(item);
            return isAdminPage
                ? html.replace(/<div class="conversation-item/, '<div style="display:none;" class="conversation-item')
                : html;
        }).join('');

        // Add click handlers
        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't open if clicking the view details button
                if (e.target.closest('.ticket-view-details-btn')) return;
                
                const id = item.getAttribute('data-id');
                const type = item.getAttribute('data-type');
                if (type === 'ticket') {
                    this.openTicket(id);
                } else {
                    this.openConversation(id);
                }
            });
        });

        // Add view details button handlers
        list.querySelectorAll('.ticket-view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ticketId = btn.getAttribute('data-ticket-id');
                this.openTicketDetailModal(ticketId);
            });
        });
    }

    renderChatConversationItem(conv) {
        const conversationId = conv.conversation_id || `${conv.farmer_id}_${conv.customer_id}`;
        const shopName = conv.other_shop_name || conv.other_full_name || conv.other_username || 'Unknown User';
        const fullName = conv.other_full_name || '';
        const displayName = fullName && fullName !== shopName ? `${shopName}\n${fullName}` : shopName;
        const lastMessageTime = conv.last_message_at
            ? this.formatConversationPreviewTime(conv.last_message_at)
            : 'No messages';
        const unreadCount = Number(conv.unread_count || 0);

        // Store metadata for later use
        this.conversationMeta.set(`chat_${conversationId}`, {
            type: 'chat',
            otherName: displayName,
            otherId: this.currentUserId === conv.farmer_id ? conv.customer_id : conv.farmer_id,
            conversationId: conversationId
        });

        // For farmer view, show customer full name; for admin view, show shop name
        const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;
        const listName = isAdminPage ? shopName : (fullName || shopName);
        const firstLetter = listName.charAt(0).toUpperCase();
        return `
            <div class="conversation-item ${unreadCount > 0 ? 'unread' : ''}" data-id="${conversationId}" data-type="chat" data-unread="${unreadCount}">
                <div class="conversation-avatar" style="background:var(--ac-primary);color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">${this.escapeHtml(firstLetter)}</div>
                <div style="flex:1;min-width:0;overflow:hidden;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                        <div class="conversation-name">${this.escapeHtml(listName)}</div>
                        ${unreadCount > 0 ? `<span class="unread-badge" style="flex-shrink:0;">${unreadCount}</span>` : ''}
                    </div>
                    <div class="conversation-time">${lastMessageTime}</div>
                </div>
            </div>
        `;
    }

    renderTicketConversationItem(ticket) {
        const ticketId = String(ticket.id);
        const farmerName = ticket.farmer_name || 'Unknown Farmer';
        const shopName = ticket.shop_name || '';
        const role = ticket.role || 'Farmer';
        const lastMessageTime = ticket.updated_at || ticket.created_at
            ? this.formatConversationPreviewTime(ticket.updated_at || ticket.created_at)
            : 'No messages';
        const unreadCount = Number(ticket.unread_count || 0);

        const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;

        // Store metadata for later use
        this.conversationMeta.set(`ticket_${ticketId}`, {
            type: 'ticket',
            ticketId: ticketId,
            farmerName: farmerName,
            shopName: shopName,
            role: role,
            subject: ticket.subject,
            status: ticket.status,
            reason: ticket.description, // Use description as reason
            created_at: ticket.created_at
        });

        const listName = shopName || farmerName;
        const firstLetter = listName.charAt(0).toUpperCase();
        const statusLabel = (ticket.status || 'open').replace('_', ' ');
        const detailsBtn = isAdminPage
            ? `<button class="btn btn-sm btn-outline-secondary ticket-view-details-btn" data-ticket-id="${ticketId}" title="View Details" style="flex-shrink:0;">
                    <i class="bi bi-three-dots-vertical"></i>
               </button>`
            : '';
        return `
            <div class="conversation-item conversation-item--ticket ${unreadCount > 0 ? 'unread' : ''}" data-id="${ticketId}" data-type="ticket" data-unread="${unreadCount}" data-ticket-status="${ticket.status || 'open'}">
                <div class="conversation-avatar" style="background:#f59e0b;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">${this.escapeHtml(firstLetter)}</div>
                <div style="flex:1;min-width:0;overflow:hidden;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                        <div class="conversation-name">${this.escapeHtml(listName)}</div>
                        ${unreadCount > 0 ? `<span class="unread-badge" style="flex-shrink:0;">${unreadCount}</span>` : ''}
                    </div>
                    <div class="conversation-time">${lastMessageTime}</div>
                </div>
                ${detailsBtn}
            </div>
        `;
    }

    async openConversation(conversationId) {
        if (!conversationId) return;

        this.currentConversation = conversationId;
        this.currentItemType = 'chat';

        // Update active state in conversation list
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeEl = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
        }

        // Update chat header
        const meta = this.conversationMeta.get(`chat_${conversationId}`);
        const titleEl = document.getElementById('chat-header-title');
        const subtitleEl = document.getElementById('chat-header-subtitle');
        const reasonEl = document.getElementById('chat-header-reason');
        const avatarEl = document.querySelector('.chat-thread-avatar');
        const statusControl = document.getElementById('ticket-status-control');

        if (titleEl) {
            titleEl.textContent = meta?.otherName || 'Chat';
        }
        if (subtitleEl) {
            const ctx = window.__chatContext;
            subtitleEl.textContent = ctx?.subtitle || 'Online';
        }
        if (reasonEl) {
            reasonEl.style.display = 'none';
        }
        if (avatarEl && meta?.otherName) {
            const firstLetter = meta.otherName.charAt(0).toUpperCase();
            avatarEl.innerHTML = `<span>${firstLetter}</span>`;
        }

        // Hide ticket number control for regular chats
        const numberControl = document.getElementById('ticket-number-control');
        if (numberControl) {
            numberControl.style.display = 'none';
        }

        // Check if user has open ticket (admin only)
        const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;
        if (isAdminPage && meta?.otherId) {
            await this.checkUserOpenTicket(meta.otherId);
        }

        // Load messages
        await this.loadMessages(conversationId);

        // Don't auto-scroll on open to avoid page scroll issues
        // User can manually scroll if needed

        // Only mark as read if not on admin page (admin page should not auto-mark on page load)
        if (!isAdminPage) {
            await this.markConversationRead(conversationId);
        }

        // Start polling for new messages
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = setInterval(() => {
            if (this.currentConversation === conversationId && this.currentItemType === 'chat') {
                this.loadMessages(conversationId);
            }
        }, 3000);
    }

    async checkUserOpenTicket(userId) {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets?farmer_id=${userId}&status=open&limit=1`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data.tickets && data.tickets.length > 0) {
                const ticket = data.tickets[0];
                const subtitleEl = document.getElementById('chat-header-subtitle');
                if (subtitleEl) {
                    subtitleEl.innerHTML = `<span class="badge bg-warning text-dark"><i class="bi bi-ticket-perforated me-1"></i>${this.escapeHtml(ticket.subject)}</span>`;
                }
            }
        } catch (error) {
            console.error('Check user open ticket error:', error);
        }
    }

    async openTicket(ticketId) {
        if (!ticketId) return;

        this.currentConversation = ticketId;
        this.currentItemType = 'ticket';

        // Update active state in conversation list
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.remove('active');
        });
        const activeEl = document.querySelector(`.conversation-item[data-id="${ticketId}"]`);
        if (activeEl) {
            activeEl.classList.add('active');
        }

        // Update chat header with ticket info
        const meta = this.conversationMeta.get(`ticket_${ticketId}`);
        const titleEl = document.getElementById('chat-header-title');
        const subtitleEl = document.getElementById('chat-header-subtitle');
        const reasonEl = document.getElementById('chat-header-reason');
        const reasonTextEl = document.getElementById('chat-header-reason-text');
        const avatarEl = document.querySelector('.chat-thread-avatar');
        const numberControl = document.getElementById('ticket-number-control');
        const numberEl = document.getElementById('chat-ticket-number');

        if (titleEl) {
            titleEl.innerHTML = `<strong>Subject:</strong> ${this.escapeHtml(meta?.subject || 'Support Ticket')}`;
        }
        if (reasonTextEl && meta?.reason) {
            reasonTextEl.textContent = meta?.reason;
            reasonEl.style.display = 'block';
        } else if (reasonEl) {
            reasonEl.style.display = 'none';
        }
        if (subtitleEl) {
            subtitleEl.textContent = meta?.reason || '—';
        }
        if (avatarEl) {
            avatarEl.innerHTML = `<i class="bi bi-ticket-perforated"></i>`;
        }

        // Show ticket number
        if (numberControl) {
            numberControl.style.display = 'block';
        }
        if (numberEl) {
            numberEl.textContent = `#${ticketId}`;
        }

        // Load ticket messages
        await this.loadTicketMessages(ticketId);

        // Refresh badge after opening ticket (messages marked as read by backend)
        const isAdminPage = document.getElementById('admin-sidebar-toggle') !== null;
        if (isAdminPage && typeof adminDashboard !== 'undefined' && adminDashboard.loadSupportTicketsBadge) {
            adminDashboard.loadSupportTicketsBadge();
        }

        // Don't auto-scroll on open to avoid page scroll issues
        // User can manually scroll if needed

        // Start polling for new ticket messages
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.pollInterval = setInterval(() => {
            if (this.currentConversation === ticketId && this.currentItemType === 'ticket') {
                this.loadTicketMessages(ticketId, false, false);
            }
        }, 3000);
    }

    async loadTicketMessages(ticketId, forceScroll = false, markRead = true) {
        if (!ticketId) return;

        try {
            // First get total count to calculate last page
            const url = `${this.apiBase}/support-tickets/${ticketId}/messages?page=1&limit=1&mark_read=${markRead}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load ticket messages: ${response.status}`);
            }

            const data = await response.json();
            const total = data.total || 0;
            const limit = 100;
            const lastPage = Math.ceil(total / limit) || 1;

            // Load last page to get most recent messages
            const messagesUrl = `${this.apiBase}/support-tickets/${ticketId}/messages?page=${lastPage}&limit=${limit}&mark_read=${markRead}`;
            const messagesResponse = await fetch(messagesUrl, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!messagesResponse.ok) {
                throw new Error(`Failed to load ticket messages: ${messagesResponse.status}`);
            }

            const messagesData = await messagesResponse.json();
            // Sort messages by created_at ascending for proper display
            const sortedMessages = (messagesData.messages || []).sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
            );
            this.renderTicketMessages(sortedMessages, forceScroll);
        } catch (error) {
            console.error('Load ticket messages error:', error);
        }
    }

    renderTicketMessages(messages, forceScroll = false) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        // Check if user is near bottom before re-rendering
        const wasNearBottom = this.isNearBottom(container);

        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
            return;
        }

        const meta = this.conversationMeta.get(`ticket_${this.currentConversation}`);
        const farmerName = meta?.farmerName || 'Farmer';

        // Sort messages by timestamp
        const sortedMessages = [...messages].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        );

        // Group messages: same sender within 5 minutes
        const groups = [];
        let currentGroup = null;

        sortedMessages.forEach((msg, index) => {
            // For support tickets: if current user is admin/super_admin, treat all admin/super_admin messages as "sent"
            const isAdminUser = this.isAdminUser();
            const isSent = isAdminUser
                ? (msg.sender_role === 'admin' || msg.sender_role === 'super_admin')
                : (msg.sender_id === this.currentUserId);
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

        // Render groups with separators and dividers
        let html = '';
        let lastSeparatorTime = null;
        let lastDay = null;

        groups.forEach((group, groupIndex) => {
            const firstMsg = group.messages[0];
            const firstMsgDate = new Date(firstMsg.created_at);
            // For support tickets: if current user is admin/super_admin, treat all admin/super_admin messages as "sent"
            const isAdminUser = this.isAdminUser();
            const isSent = isAdminUser
                ? (firstMsg.sender_role === 'admin' || firstMsg.sender_role === 'super_admin')
                : (firstMsg.sender_id === this.currentUserId);

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
                lastSeparatorTime = null;
            }

            // Check if we need a timestamp separator
            const needsSeparator =
                groupIndex === 0 ||
                lastSeparatorTime === null ||
                (firstMsgDate - lastSeparatorTime) / 60000 > 30;

            if (needsSeparator) {
                html += `<div class="chat-timestamp-separator">${this.formatTimestampSeparator(firstMsg.created_at)}</div>`;
                lastSeparatorTime = firstMsgDate;
            }

            // Render group
            html += `<div class="chat-msg-group ${isSent ? 'sent' : 'received'}">`;

            group.messages.forEach((msg, msgIndex) => {
                const msgIsSent = isAdminUser
                    ? (msg.sender_role === 'admin' || msg.sender_role === 'super_admin')
                    : (msg.sender_id === this.currentUserId);
                const senderName = msgIsSent ? 'You' : (msg.sender_role === 'admin' ? 'Support Admin' : farmerName);
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

        console.log('[DEBUG] renderTicketMessages setting innerHTML, length:', html.length);
        container.innerHTML = html;
        console.log('[DEBUG] renderTicketMessages innerHTML set');

        // Auto-scroll if user was near bottom, this is initial load, or forceScroll is true
        if (wasNearBottom || !this._hasLoadedMessages || forceScroll) {
            this.scrollToBottom();
        }
        this._hasLoadedMessages = true;
    }

    async loadMessages(conversationId) {
        if (!conversationId) return;

        try {
            const response = await fetch(`${this.apiBase}/messages/conversation/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                // If conversation not found (404), stop polling and clear the chat view
                if (response.status === 404) {
                    if (this.pollInterval) {
                        clearInterval(this.pollInterval);
                        this.pollInterval = null;
                    }
                    const container = document.getElementById('chat-messages');
                    if (container) {
                        container.innerHTML = '<div class="empty-state">Conversation not found or has been deleted.</div>';
                    }
                    return;
                }
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
            // Only show error if it's not a 404 (already handled above)
            if (!error.message.includes('404')) {
                this.showError(error.message || 'Failed to load messages');
            }
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

            // Refresh customer messages badge if on index.html
            if (window.AgricultureMarket && typeof window.AgricultureMarket.loadCustomerMessagesBadge === 'function') {
                window.AgricultureMarket.loadCustomerMessagesBadge();
            }

            // Trigger cross-tab sync via localStorage
            localStorage.setItem('messagesBadgeUpdate', Date.now().toString());
        } catch (_) {
            // ignore
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        // Check if user is near bottom before re-rendering
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

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
                    lastMessageTime: msgDate,
                    messages: [msg]
                };
            } else {
                const timeDiff = (msgDate - currentGroup.lastMessageTime) / 60000; // minutes
                const sameSender = msg.sender_id === currentGroup.senderId;

                if (sameSender && timeDiff < 5) {
                    // Same group
                    currentGroup.messages.push(msg);
                    currentGroup.lastMessageTime = msgDate;
                } else {
                    // New group
                    groups.push(currentGroup);
                    currentGroup = {
                        senderId: msg.sender_id,
                        lastMessageTime: msgDate,
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
                            <p class="chat-msg-text">${this.escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        });

        container.innerHTML = html;

        // Only scroll to bottom if user was already near bottom (reading latest messages)
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

        // Frontend validation
        if (messageText.length > this.MAX_MESSAGE_LENGTH) {
            this.showError(`Message too long. Maximum ${this.MAX_MESSAGE_LENGTH} characters.`);
            return;
        }

        input.value = '';
        this.updateCharCounter();

        // Handle ticket messages vs chat messages
        if (this.currentItemType === 'ticket') {
            await this.sendTicketMessage(messageText);
        } else {
            await this.sendChatMessage(messageText);
        }
    }

    async sendChatMessage(messageText) {
        // Get receiver ID from conversation metadata
        const meta = this.conversationMeta.get(`chat_${this.currentConversation}`);
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
        }
    }

    async sendTicketMessage(messageText) {
        try {
            const response = await fetch(`${this.apiBase}/support-tickets/${this.currentConversation}/messages`, {
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

            // Reload ticket messages immediately with forceScroll (don't mark as read, admin just sent message)
            await this.loadTicketMessages(this.currentConversation, true, false);

            // Reload support tickets to update last message time
            await this.loadSupportTickets();

            // Force scroll after everything is loaded using requestAnimationFrame (same as farmer support chat)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => this.scrollToBottom());
            });
        } catch (error) {
            console.error('Send ticket message error:', error);
            this.showError(error.message || 'Failed to send message. Please try again.');
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
            // Create conversation if it doesn't exist by sending an initial message
            this.createConversationIfNotExists(parseInt(farmerIdParam, 10), conversationId, subtitleText);
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

    async createConversationIfNotExists(farmerId, conversationId, contextText = '') {
        try {
            // Check if conversation already exists
            const response = await fetch(`${this.apiBase}/messages/conversation/${conversationId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                // Conversation exists, no need to create
                return;
            }

            // Conversation doesn't exist, create it with an initial message
            const initialMessage = contextText ? `I'm interested in: ${contextText}` : 'Hello, I would like to inquire about your products.';
            await fetch(`${this.apiBase}/messages/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    receiver_id: farmerId,
                    message: initialMessage
                })
            });
        } catch (error) {
            console.error('Create conversation error:', error);
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

    getUserRole() {
        try {
            if (!this.token) return null;
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.role;
        } catch (error) {
            console.error('Error parsing token for role:', error);
            return null;
        }
    }

    isAdminUser() {
        const role = this.getUserRole();
        return role === 'admin' || role === 'super_admin';
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

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    isNearBottom(container) {
        if (!container) return true;
        const threshold = 100;
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
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
    // Only auto-initialize on standalone chat.html
    // On farmer.html and admin.html, the dashboard scripts handle initialization
    const isStandaloneChat = window.location.pathname.endsWith('/chat.html') || 
                           window.location.pathname === '/chat';
    const chatMessages = document.getElementById('chat-messages');
    if (isStandaloneChat && chatMessages && !window.chatUI) {
        window.chatUI = new ChatUI();
    }
});
