-- Migration: Create user_prompts table
-- Description: Allow users to customize system prompts
-- Date: 2025-01-25

-- Create user_prompts table
CREATE TABLE IF NOT EXISTS user_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    prompt_type VARCHAR(50) NOT NULL, -- 'base-system', 'uniqueness', 'thread-context', 'direct-conversation'
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- Only one default per user per type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(user_id, prompt_type, is_default) WHERE is_default = TRUE,
    CHECK (prompt_type IN ('base-system', 'uniqueness', 'thread-context', 'direct-conversation'))
);

-- Add RLS policies
ALTER TABLE user_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own prompts
CREATE POLICY "Users can view own prompts" ON user_prompts
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: Users can insert their own prompts
CREATE POLICY "Users can insert own prompts" ON user_prompts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Users can update their own prompts
CREATE POLICY "Users can update own prompts" ON user_prompts
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Policy: Users can delete their own prompts
CREATE POLICY "Users can delete own prompts" ON user_prompts
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create index for performance
CREATE INDEX idx_user_prompts_user_type ON user_prompts(user_id, prompt_type);
CREATE INDEX idx_user_prompts_active ON user_prompts(user_id, prompt_type, is_active) WHERE is_active = TRUE;

-- Insert default prompts for existing functionality
-- Note: These will be used as fallbacks when users haven't created custom prompts
INSERT INTO user_prompts (user_id, prompt_type, title, content, is_default)
SELECT
    '00000000-0000-0000-0000-000000000001'::UUID, -- System user ID for defaults
    'base-system',
    'Default Base System',
    'You are one of several AI assistants in a coordinated group chat. Reply concisely and with high signal density. Avoid filler and restating the question. Prefer direct, practical guidance but with a jovial tone since this is a group chat at the end of the day.

Constraints:
- Max length: {{MAX_CHARS}} characters
- Response must be plain text only
- If unsure, say so briefly and suggest one concrete next step',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM user_prompts
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::UUID
    AND prompt_type = 'base-system'
);

INSERT INTO user_prompts (user_id, prompt_type, title, content, is_default)
SELECT
    '00000000-0000-0000-0000-000000000001'::UUID,
    'uniqueness',
    'Default Uniqueness',
    'You are an AI assistant in a group chat. Your goal is to provide a unique perspective versus prior assistant answers.

Rules:
- Do not repeat core ideas, conclusions, or primary examples already given.
- Offer a NEW angle, method, or tradeoff the others missed. If the previous messages have missed an important point you should address them - but do not mention "New perspective" or any variations of that in your output responses
- Stay within {{MAX_CHARS}} characters.
- Plain text only.

Context:
- Original user question: "{{USER_PROMPT}}"
- Previous assistant answers:
{{PRIOR_ANSWERS}}',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM user_prompts
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::UUID
    AND prompt_type = 'uniqueness'
);