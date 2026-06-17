# Facebook Messenger-Style Chat Timestamps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Facebook Messenger-style timestamp behavior for chat messages including grouping, separators, date dividers, hover behavior, and smart auto-scroll.

**Architecture:** Modify the shared chat.js module to add date/time utility functions and update renderMessages() to implement message grouping, timestamp separators, and date dividers. Add minimal CSS for new separator/divider elements.

**Tech Stack:** JavaScript (ES6+), CSS, existing chat.js module, agricatch-admin.css

---

## File Structure

- **Modify:** `frontend/js/chat.js` - Add utility functions and update renderMessages() for grouping, separators, dividers, hover, and auto-scroll
- **Modify:** `frontend/css/agricatch-admin.css` - Add CSS for timestamp separators and date dividers

---

### Task 1: Add Date/Time Utility Functions to ChatUI Class

**Files:**
- Modify: `frontend/js/chat.js:379-429` (replace existing formatTime function)

- [ ] **Step 1: Replace formatTime with utility functions**

Add these utility functions after the getUserId() method:

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/chat.js
git commit -m "feat: add date/time utility functions for chat timestamps"
```

---

### Task 2: Update Conversation List to Use New Preview Time Format

**Files:**
- Modify: `frontend/js/chat.js:99-101`

- [ ] **Step 1: Replace formatTime with formatConversationPreviewTime**

Change line 100 from:
```javascript
const lastMessageTime = conv.last_message_at 
    ? this.formatTime(conv.last_message_at) 
    : 'No messages';
```

To:
```javascript
const lastMessageTime = conv.last_message_at 
    ? this.formatConversationPreviewTime(conv.last_message_at) 
    : 'No messages';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/chat.js
git commit -m "feat: use new conversation preview time format"
```

---

### Task 3: Implement Message Grouping Logic

**Files:**
- Modify: `frontend/js/chat.js:233-263` (renderMessages method)

- [ ] **Step 1: Replace renderMessages with grouping logic**

Replace the entire renderMessages method:

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/chat.js
git commit -m "feat: implement message grouping with timestamp separators and date dividers"
```

---

### Task 4: Add CSS for Timestamp Separators and Date Dividers

**Files:**
- Modify: `frontend/css/agricatch-admin.css` (add after chat-messages-feed section, around line 1504)

- [ ] **Step 1: Add CSS for new chat elements**

Add this CSS after the `.chat-messages-feed` rule:

```css
/* Timestamp separator */
.chat-timestamp-separator {
  text-align: center;
  font-size: 0.75rem;
  color: var(--ac-text-muted);
  padding: 8px 0;
  margin: 4px 0;
}

/* Date divider */
.chat-date-divider {
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ac-text-muted);
  padding: 12px 0;
  margin: 8px 0;
  border-top: 1px solid var(--ac-border-light);
  border-bottom: 1px solid var(--ac-border-light);
  background: var(--ac-bg);
}

/* Message group */
.chat-msg-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-msg-group.sent {
  align-items: flex-end;
}

.chat-msg-group.received {
  align-items: flex-start;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/css/agricatch-admin.css
git commit -m "feat: add CSS for timestamp separators and date dividers"
```

---

### Task 5: Remove Old formatTime Function

**Files:**
- Modify: `frontend/js/chat.js:379-429`

- [ ] **Step 1: Remove old formatTime function**

Delete the old formatTime function (lines 379-429) since it's been replaced by the utility functions.

- [ ] **Step 2: Commit**

```bash
git add frontend/js/chat.js
git commit -m "refactor: remove old formatTime function"
```

---

### Task 6: Manual Testing

**Files:**
- Test: Manual verification in browser

- [ ] **Step 1: Test conversation list preview times**

Open farmer.html or admin.html, navigate to chat section, and verify:
- Messages < 1 min show "Now"
- Messages < 60 min show "Xm" (e.g., "5m")
- Messages < 24 hours show "Xh" (e.g., "2h")
- Messages < 7 days show day abbreviation (Mon, Tue, etc.)
- Older messages show "Jun 10" format

- [ ] **Step 2: Test message grouping**

Send multiple messages within 5 minutes and verify:
- Messages from same sender are grouped together
- Only the last message in group shows sender name
- Messages from different sender start new group
- Messages >5 minutes apart start new group

- [ ] **Step 3: Test timestamp separators**

Verify separators appear:
- On first message in conversation
- When >30 minutes pass between messages
- When a new day begins

- [ ] **Step 4: Test date dividers**

Verify date dividers appear:
- When a new day begins in message stream
- Format is correct (Today, Yesterday, Monday, Jun 10)

- [ ] **Step 5: Test hover behavior**

Hover over message bubbles and verify:
- Exact timestamp appears in browser tooltip
- Format is "June 15, 2026, 2:45 PM"

- [ ] **Step 6: Test auto-scroll**

Verify:
- Auto-scrolls to bottom when near bottom (within 100px)
- Does not auto-scroll when scrolled up significantly

- [ ] **Step 7: Test both farmer and admin chat**

Verify all behaviors work in both:
- farmer.html chat section
- admin.html chat section

---

## Self-Review

**Spec coverage:**
- ✓ Message timestamps with separators (Task 3)
- ✓ Conversation list preview format (Task 2)
- ✓ Hover behavior with exact timestamp (Task 3)
- ✓ Message grouping (Task 3)
- ✓ Date dividers (Task 3)
- ✓ Auto-scroll behavior (Task 3)
- ✓ Both farmer and admin chat (shared chat.js module)

**Placeholder scan:**
- No placeholders found
- All code blocks contain actual implementation
- All steps are specific and actionable

**Type consistency:**
- Utility function names consistent across tasks
- CSS class names match usage in renderMessages
- Method signatures consistent
