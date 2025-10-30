# Archer - E2EE Messaging Application

## Overview
Archer is a production-ready, end-to-end encrypted chat application built with React, Express, and SQLite. The application implements client-side encryption using the WebCrypto API, ensuring zero-knowledge architecture where the server cannot read messages or attachments.

## Current State
**Status**: Production-ready, optimized codebase
**Last Updated**: October 30, 2025

### Completed Features
- ✅ Username/password authentication with JWT sessions
- ✅ Client-side E2EE using RSA-OAEP + AES-256-GCM
- ✅ Real-time encrypted messaging (text + images)
- ✅ User profiles with @username, display name, profile picture
- ✅ Message deletion (tombstone markers)
- ✅ User blocking functionality
- ✅ Chat deletion
- ✅ AMOLED black/white UI theme
- ✅ Framer Motion animations
- ✅ Fully responsive mobile + desktop layouts

## Project Architecture

### Technology Stack
**Frontend**:
- React 18 with TypeScript
- Wouter for routing
- TanStack Query for state management
- shadcn/ui components with Tailwind CSS
- Framer Motion for animations
- WebCrypto API for encryption

**Backend**:
- Express.js REST API
- SQLite (better-sqlite3) for data persistence
- bcrypt for password hashing
- JWT for session management
- Multer for file uploads

### Encryption Architecture
**Zero-Knowledge Design**: The server stores only encrypted message blobs and minimal routing metadata.

**Key Management**:
- RSA-2048 keypairs generated client-side on registration
- Public keys stored on server, private keys stored in localStorage
- Per-message AES-256-GCM symmetric keys
- Symmetric keys encrypted with recipient's RSA public key

**Message Flow**:
1. User A generates random AES-256 key
2. Message encrypted with AES-GCM
3. AES key encrypted with User B's RSA public key
4. Server stores: `{encryptedContent, encryptedKey, iv}`
5. User B decrypts AES key with private RSA key
6. User B decrypts message content with AES key

### Database Schema

**users**:
- `id`: Primary key (auto-increment)
- `username`: Unique username
- `passwordHash`: bcrypt hashed password
- `displayName`: User's display name
- `profilePicture`: Optional profile picture URL
- `publicKey`: RSA public key (base64)
- `encryptedPrivateKey`: Recovery key encrypted with passphrase

**messages**:
- `id`: Primary key
- `senderId`: Foreign key to users
- `recipientId`: Foreign key to users
- `encryptedContent`: Base64 encrypted message
- `senderEncryptedKey`: Base64 encrypted AES key for sender
- `recipientEncryptedKey`: Base64 encrypted AES key for recipient
- `iv`: Initialization vector for AES
- `type`: 'text' or 'image'
- `deleted`: Boolean tombstone marker
- `timestamp`: Message timestamp

**blocks**:
- `id`: Primary key
- `blockerId`: User who blocked
- `blockedId`: User who was blocked

### API Routes

**Authentication**:
- `POST /api/auth/register` - Register new user with public key
- `POST /api/auth/login` - Login and receive JWT token

**Messages**:
- `GET /api/messages/:userId` - Get encrypted messages with user
- `POST /api/messages` - Send encrypted message
- `DELETE /api/messages/:id` - Delete message (tombstone)

**Conversations**:
- `GET /api/conversations` - Get all conversations with last message
- `DELETE /api/conversations/:userId` - Delete all messages with user

**Users**:
- `GET /api/users/:id` - Get user profile and public key

**Blocks**:
- `GET /api/blocks/:userId` - Check if user is blocked
- `POST /api/blocks` - Block a user
- `DELETE /api/blocks/:userId` - Unblock a user

## Design System

### AMOLED Theme
- **Pure Blacks**: Background #000000 for AMOLED displays
- **High Contrast**: White text on black for maximum readability
- **Telegram-Inspired**: Familiar messaging patterns
- **Privacy-First**: Encryption indicators throughout UI

### Component Specifications
- **Chat List**: 48px avatars, compact spacing, unread badges
- **Message Bubbles**: Rounded corners (16px), max-width 75%
- **Input Area**: Min 44px height, auto-expand to 5 lines
- **Avatars**: Initials fallback for missing profile pictures
- **Animations**: Subtle, purposeful motion (200-300ms)

### Responsive Breakpoints
- **Mobile** (<1024px): Single-view stack navigation
- **Desktop** (≥1024px): Three-column layout (sidebar + chat list + conversation)

## Development Workflow

### Local Storage Keys
- `archer_token`: JWT authentication token
- `archer_user`: Current user object (JSON)
- `archer_keys_{username}`: User's RSA keypair (JSON)

### Security Considerations
- Private keys never sent to server
- Message content encrypted before transmission
- Server cannot decrypt messages (zero-knowledge)
- Password hashing with bcrypt (cost factor 10)
- JWT tokens for stateless authentication
- Mandatory SESSION_SECRET environment variable (no fallback)
- Rate limiting on authentication endpoints (5 attempts per 15 minutes)
- MIME type validation on file uploads (images only)
- Dual-key encryption ensures both sender and recipient can decrypt messages

## User Preferences
- **Theme**: AMOLED dark mode (permanently enabled)
- **Privacy**: End-to-end encryption mandatory
- **UX**: Telegram-inspired interface patterns
- **Performance**: Lightweight, minimal dependencies

## Recent Changes
- **Oct 30, 2025**: Complete codebase optimization and security hardening
  - Simplified database schema: removed unnecessary timestamp fields
  - Backend routes reduced from 349 to ~190 lines by eliminating duplication
  - Streamlined storage layer with cleaner method chaining
  - **Security improvements**:
    - Enforced SESSION_SECRET environment variable (no insecure fallback)
    - Added rate limiting for auth endpoints (5 attempts/15 minutes)
    - Implemented MIME type validation for file uploads (images only)
  - Preserved audit-ready crypto implementation (RSA-OAEP 2048, AES-256-GCM)
  - Architecture review: PASS with no blocking bugs
- **Oct 29, 2025**: Fixed critical E2EE security issues
  - Implemented dual-key encryption (sender + recipient encrypted keys)
  - Added SafeUser type to eliminate password hash exposure
  - All E2EE flows validated end-to-end
