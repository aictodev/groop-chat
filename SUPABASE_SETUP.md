# Supabase Setup Guide

This guide will help you set up Supabase for your AI Group Chat application.

## Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project
4. Choose a database password (save this securely)
5. Wait for project initialization (2-3 minutes)

## Step 2: Get Your Credentials

1. Go to your project dashboard
2. Click "Settings" in the sidebar
3. Click "API" tab
4. Copy these two values:
   - **Project URL** (looks like: `https://abcdefghij.supabase.co`)
   - **Anon public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`)

## Step 3: Configure Environment Variables

1. Create a `.env` file in the root directory (copy from `.env.example`)
2. Add your Supabase credentials:

```env
OPENROUTER_API_KEY=sk-or-your-api-key
PORT=7001

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Set Up Database Schema

1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the sidebar
3. Click "New query"
4. Copy and paste the entire contents of `backend/supabase_schema.sql`
5. Click "Run" to execute the SQL
6. Verify tables are created in "Database" > "Tables"

## Step 5: Test the Connection

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. You should see:
   ```
   Server is running on port 7001
   ✅ Database connection successful
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:7001/health
   ```

   Should return:
   ```json
   {
     "ok": true,
     "models": [...],
     "env": {
       "hasApiKey": true,
       "dbConnected": true
     },
     "version": "2.0.0"
   }
   ```

## Step 6: Start the Application

1. Start backend (in one terminal):
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

## Verifying Everything Works

1. Send a test message in the chat
2. Refresh the page - your message should still be there (persistence working!)
3. Check Supabase dashboard > Database > Table Editor > "messages" to see stored data

## Troubleshooting

### Database Connection Failed
- Double-check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
- Ensure you've run the schema SQL in Supabase SQL Editor
- Check that your Supabase project is active (not paused)

### Messages Not Persisting
- Check browser console for error messages
- Verify backend logs show successful database operations
- Check Supabase logs in the dashboard > Logs section

### API Key Issues
- Ensure your `OPENROUTER_API_KEY` is valid and has credits
- Test with a simple API call to verify the key works

## Free Tier Limits

Supabase free tier includes:
- Up to 500MB database storage
- 50GB bandwidth per month
- 50,000 monthly active users

This is more than sufficient for your testing and closed beta needs.

## Next Steps for Beta

When you're ready to invite friends:
1. Enable Row Level Security (RLS) in Supabase
2. Set up Supabase Auth for user registration
3. Add user management to the frontend
4. Configure proper access policies