# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a group chat application that allows users to interact with multiple AI models simultaneously in a WhatsApp-like interface. The architecture consists of:

- **Frontend**: React + Vite app with Tailwind CSS styling and custom WhatsApp-like UI
- **Backend**: Node.js Express server that orchestrates conversations between multiple AI models via OpenRouter API
- **Database/Auth**: Convex (data + auth). Supabase is now only used for Storage (avatars).

## Development Commands

### Frontend (in `frontend/` directory)
- **Start development server**: `npm run dev`
- **Build for production**: `npm run build`  
- **Lint code**: `npm run lint`
- **Preview production build**: `npm run preview`

### Backend (in `backend/` directory)
- **Start development server**: `npm run dev`
- **Start production server**: `npm run start`

## Architecture

### Core Components

**Frontend (`frontend/src/App.jsx`)**:
- Single-page React app with all components in one file
- `App` - Main application component managing chat state and API calls
- `MessageBubble` - Renders individual chat messages with model attribution
- `ModelSelector` - Dropdown for choosing the first responder model
- `TypingIndicator` - Shows loading state during API calls

**Backend (`backend/api/index.js`)**:
- Express server with `/api/*` endpoints
- Integrates with OpenRouter API to access multiple LLM models
- Uses prompt templates from `prompts/` directory for system instructions
- Implements "first responder" pattern where one model answers first, then others provide unique perspectives
- Persists conversations/messages in Convex via `backend/database.js`

### Key Features

1. **Model Orchestration**: The backend ensures each AI model provides a unique response by using different prompts
2. **Prompt Templates**: Located in `prompts/` directory:
   - `base-system.md` - Base instructions for first responder
   - `uniqueness.md` - Instructions for subsequent models to avoid repetition
3. **WhatsApp UI**: Custom CSS in `frontend/src/whatsapp.css` provides authentic WhatsApp styling
4. **Staggered Responses**: Models respond with artificial delays to simulate realistic conversation flow

### Configuration

- **Environment**: Backend requires `OPENROUTER_API_KEY` in `.env` file
- **Convex (backend)**: `CONVEX_URL` plus `CONVEX_ADMIN_KEY` or `CONVEX_DEPLOY_KEY`
- **Convex (frontend)**: `VITE_CONVEX_URL`
- **Convex Auth envs**: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- **Models**: Configured in `ALL_MODELS` array in backend and `MODELS` array in frontend
- **API Endpoint**: Frontend connects to backend on port 7001 by default
- **Character Limits**: Responses limited to 280 characters for concise chat experience

### Code Style

- **No TypeScript**: Pure JavaScript project with JSDoc for type hints where needed
- **ESLint**: Frontend uses standard React ESLint rules with custom rule allowing unused vars starting with uppercase
- **Module Systems**: Frontend uses ES modules, backend uses CommonJS
- **Styling**: Tailwind CSS with custom WhatsApp theme overrides

### Key Patterns

1. **Single File Components**: Frontend keeps all React components in `App.jsx` 
2. **Template Rendering**: Backend uses simple string replacement for prompt templates
3. **Error Handling**: Graceful degradation when models fail - returns error message instead of throwing
4. **Response Formatting**: Each model response includes model name, avatar, and message text

## Recent Updates (2025-01-09)

### Reply-to-Message Feature Implementation
Successfully implemented WhatsApp-style reply functionality with direct conversation mode:

**Core Features Added:**
- **Reply Button**: Added "Reply" button to all AI messages that enables 1-on-1 conversations
- **Reply Preview**: Visual reply context bar (blue/green) showing original message snippet
- **Direct Conversation Mode**: Clicking reply switches from group mode to direct mode with specific AI model
- **Visual Reply Context**: Messages show reply context with sender name and message preview

**Technical Implementation:**

**Frontend (`frontend/src/App.jsx`):**
- Added `replyToMessage` and `conversationMode` state management
- `handleReplyToMessage()` function sets reply context and switches to direct mode
- `MessageBubble` component enhanced with reply button and reply context display
- Added UUID validation to prevent replies to temporary/invalid message IDs
- Reply preview component with cancel functionality

**Backend (`backend/index.js`):**
- Enhanced `/api/chat` endpoint with `replyToMessageId` and `conversationMode` parameters
- Direct conversation mode filters conversation history to only include user + target model messages
- Proper fallback handling when reply messages can't be found (gracefully switches to group mode)
- Fixed const assignment errors and improved error handling

**Database (`backend/database.js`):**
- Schema-compatible implementation using existing database structure
- Reply information stored in `metadata` JSON field to avoid requiring new columns
- Added `getMessageById()` function for reply message lookup
- Proper error handling for UUID format validation

**Styling (`frontend/src/reply-styles.css`):**
- Complete reply UI styling matching WhatsApp design
- Light theme consistency for input area (removed dark mode elements)
- Fixed z-index issues that prevented button clicks (changed `.message` from `z-index: -1` to `z-index: 1`)
- Responsive reply button styling with hover effects

**Bug Fixes Resolved:**
1. **Z-index Click Issue**: Messages had `z-index: -1` making reply buttons unclickable
2. **UUID Format Errors**: Invalid message IDs were being sent to database causing PostgreSQL errors
3. **Const Assignment Errors**: Fixed variable scoping issues in conversation mode handling  
4. **Missing Message IDs**: Backend wasn't returning database IDs in API responses
5. **Mixed Model Outputs**: Direct conversation history now properly filtered per model
6. **Database Schema Compatibility**: Works with existing schema without requiring new columns

**Current Status:**
- ✅ Reply buttons are fully functional and clickable
- ✅ Reply preview displays correctly with proper WhatsApp-style UI
- ✅ Direct conversation mode works (only target model responds)
- ✅ Proper error handling and graceful fallbacks
- ✅ No more database or JavaScript errors
- ✅ Light theme consistency across interface

**Testing Notes:**
- Reply functionality works best with messages that have proper database UUIDs
- Temporary message IDs (generated during streaming) automatically fall back to group mode
- System gracefully handles missing reply messages and invalid UUIDs
- All error cases are properly handled without breaking the user experience

## Recent Updates (2025-10-04)

- Added a modern landing/auth experience (`frontend/src/components/Landing.jsx`) that gates the chat UI behind Supabase sessions, offers Google OAuth plus email/password, and surfaces auth errors inline.
- Wrapped the React app with `AuthProvider` (`frontend/src/main.jsx`) so every request carries a Supabase JWT; `VITE_BACKEND_URL` now drives the backend URL in production.
- Hardened the auth context (`frontend/src/AuthContext.jsx`) to auto-login after sign-up and better report Supabase failures; landing form wiring fixed to submit reliably.
- Refactored backend data access (`backend/database.js`, `backend/index.js`) to scope conversations and messages by `conversation_participants`, preventing cross-user leakage and returning 403 on unauthorized access.
- New users automatically receive a seeded conversation and default AI model ladder; all conversation mutations now verify participation before writing.
- Synced `ai_models` seed data in `backend/supabase_schema.sql` with the exact IDs used in the app (Gemini 2.5 Flash, GPT-4o mini, Claude 3.5 Sonnet, Llama 3 8B Instruct, DeepSeek Chat, Qwen 2.5 7B Instruct, Moonshot Kimi K2).

## Recent Updates (2025-10-12)

- Profile avatars are uploaded via `supabase.storage` (bucket defaults to `avatars`). The Express route now returns a CDN-friendly public URL and persists it with `database.updateUserAvatar`. Ensure `SUPABASE_SERVICE_ROLE_KEY` (and optionally `SUPABASE_AVATAR_BUCKET`) are available when running the backend.
- Added `DELETE /api/conversations/:conversationId` supporting `scope=me` (soft delete by clearing the participant) and `scope=all` (owner-only hard delete that cascades the row). Database helpers `softDeleteConversation` and `deleteConversation` guard access and fall back to sample data when Supabase is offline.
- Frontend sidebar includes a three-dot menu per conversation with *Delete for me* and *Delete permanently* options, reuses the new endpoint, and fixes overflow by tightening flex layout.
- Existing conversations/messages were reassigned to the real Supabase UID (`claude@codex.com`), and the backend now consistently passes the authenticated user ID when fetching metadata to avoid leaking other users’ chats.

## Recent Updates (2026-01-31)

- Migrated data layer and auth to Convex (`convex/schema.js`, `convex/db.js`, `convex/auth.js`, `convex/http.js`, `convex/auth.config.js`).
- Backend now authenticates against Convex tokens and uses Convex HTTP client (`backend/auth.js`, `backend/database.js`).
- Added one-off migration script `backend/migrate_supabase_to_convex.js`.
- Vercel frontend uses `VITE_CONVEX_URL`; backend uses `CONVEX_URL` with admin/deploy key.
- For Convex Auth, Google OAuth redirect must be `https://<deployment>.convex.site/api/auth/callback/google`, and Convex envs `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` must be set.
