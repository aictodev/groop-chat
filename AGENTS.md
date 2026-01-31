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

- New landing/auth page lives at `frontend/src/components/Landing.jsx`; show it whenever `useAuth()` reports no session. Auth wiring depends on `VITE_BACKEND_URL` and `VITE_CONVEX_URL`.
- Backend now scopes conversations/messages by `conversation_participants`. Always pass the authenticated user ID to `database.getConversations(...)`, `createConversationForUser(...)`, etc., otherwise requests fall back to the sample data.
- `backend/supabase_schema.sql` seeds the model ladder with the exact IDs used in the app (Gemini 2.5 Flash, GPT-4o mini, Claude 3.5 Sonnet, Llama 3 8B Instruct, DeepSeek Chat, Qwen 2.5 7B Instruct, Moonshot Kimi K2). Keep Convex `ai_models` in sync with these IDs.
- When onboarding a new user programmatically, the auth middleware calls `db.ensureUserProfile` in Convex and then `database.ensureDefaultConversation` to create a starter chat.

## Notes (2025-10-12)

- Profile avatar uploads now go straight to Supabase Storage. Set `SUPABASE_SERVICE_ROLE_KEY` and optionally `SUPABASE_AVATAR_BUCKET` (defaults to `avatars`) so `/api/profile/avatar` can store the processed JPG in `profiles/<userId>/…`.
- Conversation management exposes `DELETE /api/conversations/:id?scope=me|all`. `scope=me` just removes the current user from `conversation_participants`; `scope=all` hard-deletes the conversation (and requires ownership).
- The React sidebar shows a three-dot menu on each chat with *Delete for me* (soft delete) and *Delete permanently* (hard delete) actions, and it now guards against horizontal overflow.
- Legacy conversations were backfilled to the real Supabase auth UID (`claude@codex.com`) so authenticated users only see their own history.

## Notes (2026-01-31)

- Auth + database now run on Convex (Supabase remains only for Storage/avatars).
- Convex auth files live in `convex/auth.js`, `convex/http.js`, and `convex/auth.config.js`.
- Required Convex env vars: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (do not set `CONVEX_SITE_URL` manually; it is built-in).
- Google OAuth redirect URI must be `https://<deployment>.convex.site/api/auth/callback/google`.
- Frontend auth uses `ConvexAuthProvider` and reads `VITE_CONVEX_URL`.
- Backend uses `CONVEX_URL` plus `CONVEX_ADMIN_KEY` or `CONVEX_DEPLOY_KEY`; it falls back to `anyApi` if `convex/_generated` is missing, and Vercel `postinstall` runs `npx convex codegen --commonjs`.

## Agent Activity (Updated 2025-11-07 14:58 PST)

- **14:57 PST · 17d4028** – Added frontend IndexedDB cache + warm-up pings so conversations/messages are available instantly while Render wakes.
- **14:00 PST · f46403a** – Bolded single-model mentions in user bubbles and removed direct-reply character limits (frontend + backend prompt changes).
- **09:30 PST · cfcd69f** – Enabled inline conversation title editing in both the chat header and sidebar.

## Troubleshooting Log: Mobile Input Visibility (2025-11-25)

**Issue:** The chat input field was persistently cut off or hidden behind the mobile browser's bottom navigation bar (address bar) on iOS/Safari and Chrome.

**Attempts & Fixes:**

1.  **Viewport Meta Tag Update (11:50 PST)**
    *   *Action:* Added `viewport-fit=cover` to `index.html`.
    *   *Rationale:* Required to activate `env(safe-area-inset-bottom)` CSS variable on iOS. Without this, the safe area is treated as 0.

2.  **Safe Area Padding (12:00 PST)**
    *   *Action:* Added `padding-bottom: calc(1rem + env(safe-area-inset-bottom))` to `.chat-composer` in `index.css`.
    *   *Result:* Insufficient. Input still partially cut off.

3.  **Increased Bottom Padding (12:15 PST)**
    *   *Action:* Increased padding to `calc(2rem + env(safe-area-inset-bottom))`.
    *   *Result:* Better, but input still obscured when browser address bar was visible/expanded.

4.  **Visual Viewport API (12:30 PST)**
    *   *Action:* Implemented a `useEffect` hook in `App.jsx` to listen to `visualViewport` resize events and set a `--app-height` CSS variable.
    *   *Action:* Updated `.chat-shell` to use `height: var(--app-height, 100dvh)`.
    *   *Rationale:* `100dvh` in CSS is unreliable on iOS when the address bar expands/collapses. JavaScript provides the exact visible pixel height.

5.  **Top Anchoring (12:45 PST)**
    *   *Action:* Changed `.chat-shell` from `inset: 0` to `top: 0; left: 0`.
    *   *Rationale:* `inset: 0` tries to stretch the element to the bottom, which conflicts with the calculated height when the address bar is at the top. Anchoring to the top ensures the app flows downwards exactly as much as the calculated height allows.

6.  **Global Height Constraints (13:00 PST)**
    *   *Action:* Enforced `height: 100%`, `width: 100%`, and `overflow: hidden` on `html`, `body`, and `#root`.
    *   *Action:* Added `position: fixed; inset: 0` to `body`.
    *   *Rationale:* Prevents "elastic scrolling" of the entire page body, forcing the browser to treat the web page as a fixed app container. This is the most robust way to prevent the address bar from shifting the layout unexpectedly.
- **[2025-11-26 11:45]**
  - **Attempt**:
    1.  **Mobile Layout**: Switched `.chat-composer` to `position: fixed` on mobile and increased `.chat-history` padding to `160px`.
    2.  **Duplicate Welcome Messages**: Removed `setMessages` call in `loadMessages` catch block; implemented conditional rendering for welcome message.
    3.  **History Leak**: Prevented `loadMessages` from fetching global `api/messages` when no conversation ID is present.
  - **Rationale**: The flexbox layout was proving fragile on mobile. Fixed positioning guarantees visibility. Logic bugs in `App.jsx` were causing state pollution.
  - **Outcome**: Pending user verification. This should resolve the missing input field and the "ghost" messages.
```
