## Build, Lint, and Test Commands

### Frontend

- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Run:** `npm run dev`

### Backend

- **Run:** `npm run dev`
- **Start for production:** `npm run start`

## Code Style Guidelines

- **Formatting:** Follow standard JavaScript/React formatting. Use Prettier with default settings if available.
- **Imports:** Use ES module imports (`import/export`).
- **Types:** This project does not use TypeScript. Use JSDoc for type annotations where necessary.
- **Naming Conventions:**
  - Components: `PascalCase`
  - Variables/Functions: `camelCase`
  - Constants: `UPPER_CASE`
- **Error Handling:** Use `try...catch` blocks for asynchronous operations and handle errors gracefully.
- **Linting:** Adhere to the rules in `eslint.config.js`. Unused variables are allowed if they start with an uppercase letter.

## Notes (2025-10-04)

- New landing/auth page lives at `frontend/src/components/Landing.jsx`; show it whenever `useAuth()` reports no session. Auth wiring depends on `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- Supabase email/password flows require confirmations unless you disable them — turn off “Confirm email” during local testing if instant login is needed.
- Backend now scopes conversations/messages by `conversation_participants`. Always pass the authenticated Supabase user ID to `database.getConversations(...)`, `createConversationForUser(...)`, etc., otherwise requests fall back to the sample data.
- `backend/supabase_schema.sql` seeds the model ladder with the exact IDs used in the app (Gemini 2.5 Flash, GPT-4o mini, Claude 3.5 Sonnet, Llama 3 8B Instruct, DeepSeek Chat, Qwen 2.5 7B Instruct, Moonshot Kimi K2). Keep Supabase `ai_models` in sync.
- When onboarding a new user programmatically, call `database.ensureUserExists` (already invoked by auth middleware) to auto-create their starter conversation and participant row.

## Notes (2025-10-12)

- Profile avatar uploads now go straight to Supabase Storage. Set `SUPABASE_SERVICE_ROLE_KEY` and optionally `SUPABASE_AVATAR_BUCKET` (defaults to `avatars`) so `/api/profile/avatar` can store the processed JPG in `profiles/<userId>/…`.
- Conversation management exposes `DELETE /api/conversations/:id?scope=me|all`. `scope=me` just removes the current user from `conversation_participants`; `scope=all` hard-deletes the conversation (and requires ownership).
- The React sidebar shows a three-dot menu on each chat with *Delete for me* (soft delete) and *Delete permanently* (hard delete) actions, and it now guards against horizontal overflow.
- Legacy conversations were backfilled to the real Supabase auth UID (`claude@codex.com`) so authenticated users only see their own history.
