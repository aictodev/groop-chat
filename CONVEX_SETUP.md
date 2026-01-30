# Convex Setup Guide (Option A - Express Backend)

This guide wires Convex as the database while keeping the existing Express API and Supabase Auth/Storage.

## 1) Install Convex

From the repo root:

```bash
npm install
cd backend && npm install
```

## 2) Initialize Convex

From the repo root:

```bash
npx convex dev
```

This will create Convex project configuration and generate `convex/_generated` API files.

## 3) Configure Environment Variables

Add these to your `.env` (root):

```env
CONVEX_URL=https://your-convex-instance.convex.cloud
CONVEX_ADMIN_KEY=your-convex-admin-key
```

> Note: `CONVEX_ADMIN_KEY` is required for the server-side Convex HTTP client.

## 4) Run the App

```bash
cd backend
npm run dev
```

In another terminal:

```bash
cd frontend
npm run dev
```

## Supabase Still Required (for now)

Option A keeps Supabase for:
- Auth (Supabase JWT validation in `backend/auth.js`)
- Storage (profile and conversation avatar uploads)

If you want to remove Supabase entirely, we can do this in Option B.
