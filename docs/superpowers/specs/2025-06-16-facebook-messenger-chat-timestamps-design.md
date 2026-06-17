# Facebook Messenger-Style Chat Timestamps Design

**Date:** 2025-06-16
**Scope:** Update chat.js to implement Facebook Messenger-style timestamp behavior for both farmer and admin chat sections

## Overview

Implement Facebook Messenger-style timestamp behavior including message grouping, timestamp separators, date dividers, hover behavior, and smart auto-scroll. The changes apply to both `farmer.html` and `admin.html` since they share the `chat.js` module.

## Requirements

### 1. Message Timestamps

- Do not show timestamps on every message
- Show a timestamp separator only when:
  - The first message in the conversation is displayed
  - More than 30 minutes have passed between two consecutive messages
  - A new calendar day starts
- Timestamp format:
  - Same day: "Today at 2:45 PM"
  - Yesterday: "Yesterday at 2:45 PM"
  - Within 7 days: "Thursday at 2:45 PM"
  - Older messages in current year: "Jun 10 at 2:45 PM"
  - Previous years: "Jun 10, 2025 at 2:45 PM"

### 2. Conversation List Preview

Display the last message time using:
- < 1 minute = "Now"
- < 60 minutes = "Xm" (e.g., "5m")
- < 24 hours = "Xh" (e.g., "2h")
- < 7 days = Day abbreviation (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- Older = Month + Day (Jun 10)

### 3. Message Hover Behavior

- On desktop, show the exact timestamp when hovering over a message
- Example: "June 15, 2026, 2:45 PM"
- Use native browser `title` attribute on message bubbles

### 4. Message Grouping

- Group consecutive messages from the same sender
- Group threshold: 5 minutes between messages
- Within a group:
  - Only the last message shows the sender name
  - Only the last message shows the avatar (if avatars are added to messages)
  - All messages in group show their individual timestamps on hover
- When sender changes OR 5+ minutes pass, start a new group

### 5. Date Dividers

- Insert a date divider when a new day begins in the message stream
- Format: "Today", "Yesterday", "Monday", "June 10"
- Appears as a full-width divider with centered text
- Class: `chat-date-divider`

### 6. Auto-scroll Behavior

- When new message arrives via polling, auto-scroll to bottom if user is already near bottom (within 100px)
- Preserve scroll position when loading older messages (if pagination is added later)
- Current implementation already scrolls to bottom on render, minimal change needed

## Architecture

### File Structure

- `frontend/js/chat.js` - Main chat logic (modified)
- `frontend/css/agricatch-admin.css` - Chat styling (minimal additions for separators/dividers)

### Utility Functions

Add the following utility functions to ChatUI class:

- `formatExactTimestamp(date)` - Returns full exact timestamp for hover (e.g., "June 15, 2026, 2:45 PM")
- `formatTimestampSeparator(date)` - Returns separator format (e.g., "Today at 2:45 PM")
- `formatConversationPreviewTime(date)` - Returns preview format for conversation list
- `isSameDay(date1, date2)` - Checks if two dates are on the same calendar day
- `isWithinMinutes(date, minutes)` - Checks if date is within X minutes of now

All functions use Asia/Manila timezone and user's local time for calculations.

### Message Rendering Flow

1. `renderMessages(messages)` receives message array
2. Sort messages by timestamp (ascending)
3. Iterate through messages, grouping consecutive messages from same sender within 5 minutes
4. For each group:
   - Check if timestamp separator needed (first message, >30min gap, new day)
   - Check if date divider needed (new day)
   - Render group container with individual messages
   - Only last message in group shows sender name
5. Add `title` attribute to each message bubble with exact timestamp
6. Auto-scroll to bottom if near bottom

### CSS Classes

- `chat-msg-group` - Container for grouped messages
- `chat-timestamp-separator` - Timestamp separator between messages
- `chat-date-divider` - Date divider for new days
- `chat-msg` - Individual message (existing)
- `chat-msg-bubble` - Message bubble (existing)

## Data Flow

```
API Response (messages array)
    ↓
renderMessages()
    ↓
Group messages (same sender, <5min)
    ↓
Insert timestamp separators (first, >30min, new day)
    ↓
Insert date dividers (new day)
    ↓
Render HTML with title attributes
    ↓
Auto-scroll if near bottom
```

## Error Handling

- Invalid timestamps: Display "Unknown time" instead of crashing
- Missing timezone info: Default to user's local timezone
- Empty message array: Show "No messages yet" state (existing behavior)

## Testing Considerations

- Test with messages spanning multiple days
- Test with rapid consecutive messages (within 5 minutes)
- Test with messages spaced >30 minutes apart
- Test conversation list preview times
- Test hover behavior on desktop
- Test auto-scroll when near bottom vs when scrolled up
- Test with both farmer and admin chat sections

## Implementation Notes

- All changes in `chat.js` affect both farmer and admin chat (shared module)
- Existing `formatTime()` function will be replaced/refactored into utility functions
- Current polling (3 seconds) remains unchanged
- No backend changes required
