# Design Guidelines for Archer - E2EE Chat Application

## Design Approach
**Reference-Based: Telegram-Inspired with AMOLED Aesthetic**

Drawing from Telegram's proven messaging interface patterns while implementing a pure AMOLED theme with maximum contrast. The design prioritizes clarity, speed, and privacy-focused minimalism.

## Core Design Principles
- **Maximum Contrast**: Pure blacks (#000000) and whites for AMOLED displays
- **Information Density**: Efficient use of space like Telegram, no wasted pixels
- **Touch-First**: Large tap targets (min 44px), swipe gestures, mobile-optimized
- **Privacy Emphasis**: Visual indicators for encryption status, minimal metadata display

## Typography System

**Font Family**: 
- Primary: 'Inter' or 'SF Pro Display' for clean, modern readability
- Monospace: 'JetBrains Mono' for usernames and encryption indicators

**Hierarchy**:
- Chat List Names: text-base font-semibold (16px, 600 weight)
- Message Text: text-sm (14px, 400 weight)
- Timestamps: text-xs (12px, 400 weight)
- Input Fields: text-base (16px to prevent iOS zoom)
- Profile Display Names: text-2xl font-bold (24px, 700 weight)
- @usernames: text-sm font-mono (14px, monospace)

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, and 8 consistently
- Component padding: p-4 (16px)
- Section gaps: gap-3 (12px) for compact lists, gap-6 (24px) for spaced sections
- Message bubbles: px-4 py-2
- Screen margins: px-4 (mobile), px-6 (desktop)

**Container Strategy**:
- Mobile: Full viewport width (w-full), no outer margins except px-4
- Desktop: Three-column layout (sidebar 320px, chat list 380px, conversation flex-1)
- Max-width for chat messages: max-w-2xl to prevent excessive line length

## Component Library

### 1. Authentication Screens
- **Login/Register**: Centered cards with max-w-sm, minimal form fields
- Input fields with text-base size, p-3 padding
- Primary action buttons: w-full, h-12, rounded-lg
- Error messages: text-sm, positioned below inputs

### 2. Navigation Structure
**Desktop (≥1024px)**:
- Split view: Left sidebar (user profile, settings icon), middle (chat list), right (active conversation)
- Persistent navigation, no overlays

**Mobile (<1024px)**:
- Single-view stack: Chat list → Conversation (full screen transition)
- Top navigation bar: h-14 with back button, chat name, action icons
- Bottom input bar: Fixed positioning with safe-area-inset

### 3. Chat List Component
- Avatar: h-12 w-12 rounded-full (48px circles)
- List items: h-18 with p-4, border-b dividers
- Unread badges: Circular, h-5 min-w-5, text-xs, positioned top-right
- Three-line structure: Name (bold), last message preview (truncate), timestamp
- Swipe actions on mobile: Delete chat (80px swipe threshold)

### 4. Conversation View
**Message Bubbles**:
- Received: Aligned left, max-w-[75%]
- Sent: Aligned right, max-w-[75%]
- Padding: px-4 py-2, rounded-2xl (Telegram-style rounded corners)
- Timestamp: text-xs, positioned bottom-right inside bubble
- Image messages: max-h-80, rounded-xl, maintain aspect ratio

**Message Grouping**:
- Same sender within 2 minutes: Reduce top margin to mt-1
- Different sender or time gap: mt-4 separation

**Input Area**:
- Fixed bottom position with backdrop-blur
- Height: min-h-14, auto-expand for multiline (max 5 lines)
- Attachment button: h-10 w-10 icon button (left)
- Send button: h-10 w-10 icon button (right)
- Text input: flex-1, resize-none

### 5. Profile View
- Full-screen overlay (mobile) or right panel (desktop)
- Profile picture: h-32 w-32 centered
- Display name: text-2xl font-bold
- @username: text-sm text-gray-400
- Action buttons: w-full, h-12, gap-3 stacked
- Encryption fingerprint display: Monospace font, text-xs, grid layout

### 6. Modals & Overlays
- Full-screen on mobile, centered cards on desktop
- Backdrop: backdrop-blur-sm
- Action sheets: Slide up from bottom, rounded-t-3xl
- Confirmation dialogs: max-w-sm, p-6, button pairs

## Animations (Framer Motion)

**Limited, Purposeful Motion**:
- Page transitions: Slide animations (x: 100% to 0) for navigation stack
- Message send: Subtle scale + opacity (scale: 0.95 → 1, duration: 200ms)
- Modal entry: fadeIn + slide-up (y: 20 → 0, duration: 250ms)
- List updates: Layout animations only, no excessive motion

**Disabled Animations**:
- No hover effects on touch devices
- No continuous/looping animations
- No parallax or scroll-driven effects

## Responsive Breakpoints

- **Mobile**: Base styles (320px - 1023px)
- **Desktop**: lg: prefix (1024px+)

**Mobile-Specific**:
- Stack all views vertically
- Full-width buttons and inputs
- Swipe gestures for actions
- Bottom navigation/input bars with safe-area-inset-bottom

**Desktop-Specific**:
- Multi-column layout
- Hover states for list items
- Right-click context menus
- Keyboard shortcuts visual hints

## Accessibility

- Focus indicators: ring-2 ring-offset-2 on all interactive elements
- ARIA labels for icon-only buttons
- Semantic HTML: <nav>, <main>, <article> for messages
- Keyboard navigation: Tab order follows visual hierarchy
- Screen reader: Announce new messages, encryption status
- Touch targets: Minimum 44x44px for all buttons

## Visual States

**Encryption Indicators**:
- Padlock icon in conversation header
- "End-to-end encrypted" subtitle text
- Encryption fingerprint verification CTA in profile

**Message States**:
- Sending: Opacity 0.6 with spinner
- Sent: Single checkmark
- Delivered: Double checkmark
- Read: Blue double checkmark (if implementing read receipts)
- Failed: Red warning icon with retry button

**User Status**:
- Online indicator: h-3 w-3 green dot on avatar
- Typing indicator: Three animated dots in bubble style
- Last seen: text-xs below name in conversation header

## Privacy-First UI Elements

- No message previews in notifications (only "New message from @username")
- Screenshot detection warning modal
- "Delete for everyone" confirmation dialog
- Block user confirmation with clear consequences
- Encrypted attachments show file size but no server-side thumbnails

This design creates a professional, privacy-focused messaging experience that feels familiar (Telegram-inspired) while emphasizing encryption and anonymity through thoughtful UI patterns and AMOLED aesthetics.