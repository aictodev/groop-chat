# Database Schema Design

## Overview

This database schema is designed to support a group chat application that facilitates conversations between users and multiple AI models. The design supports both single-user testing and multi-user closed beta scenarios.

## Current Application Analysis

From examining the codebase:
- Multiple AI models responding to single prompts
- First responder pattern (one model leads, others follow with unique perspectives)
- Message attribution to specific models
- Character limits (280 chars)
- WhatsApp-like interface with conversation threads

## Database Schema

### Core Tables

#### 1. Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

#### 2. Conversations Table
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb -- Store conversation-specific settings
);
```

#### 3. AI Models Table
```sql
CREATE TABLE ai_models (
    id VARCHAR(100) PRIMARY KEY, -- e.g., "google/gemini-flash-1.5"
    name VARCHAR(100) NOT NULL, -- e.g., "Gemini"
    display_name VARCHAR(100),
    avatar VARCHAR(10), -- e.g., " G "
    provider VARCHAR(50), -- e.g., "google", "openai"
    is_active BOOLEAN DEFAULT true,
    capabilities JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. Messages Table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'user', 'ai', 'system'
    sender_id UUID REFERENCES users(id), -- NULL for AI/system messages
    ai_model_id VARCHAR(100) REFERENCES ai_models(id), -- NULL for user messages
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional data like token count, etc.
    parent_message_id UUID REFERENCES messages(id), -- For threading/replies
    is_first_responder BOOLEAN DEFAULT false
);
```

#### 5. Conversation Participants Table
```sql
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    is_active BOOLEAN DEFAULT true,
    UNIQUE(conversation_id, user_id)
);
```

#### 6. Conversation AI Models Table
```sql
CREATE TABLE conversation_ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    ai_model_id VARCHAR(100) REFERENCES ai_models(id),
    is_active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb, -- Model-specific settings per conversation
    UNIQUE(conversation_id, ai_model_id)
);
```

### Performance Indexes

```sql
-- Message queries
CREATE INDEX idx_messages_conversation_created_at ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);

-- Conversation queries  
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Participant queries
CREATE INDEX idx_participants_user_active ON conversation_participants(user_id, is_active);
CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
```

## Migration Strategy

### Phase 1: Current Single-User Testing
- Create all tables but focus on conversations, messages, and ai_models
- Use a default user record for testing
- All conversations belong to this test user

### Phase 2: Closed Beta Multi-User
- Implement user registration/authentication
- Add user management features
- Enable multiple users per conversation
- Add invitation system

## Key Design Decisions

### 1. Flexible Message Attribution
- `sender_type` distinguishes between user, AI, and system messages
- Separate fields for `sender_id` (users) and `ai_model_id` (AI models)
- Supports current pattern where AI models respond to user messages

### 2. Conversation-Centric Design
- Everything revolves around conversations (threads)
- Easy to add/remove AI models per conversation
- Supports "first responder" pattern via `is_first_responder` flag

### 3. JSONB for Flexibility
- Settings and metadata stored as JSONB for schema flexibility
- Easy to add new features without schema changes
- Good for storing model-specific configurations

### 4. Scalable Architecture
- UUID primary keys for distributed systems
- Proper foreign key relationships
- Designed to handle thousands of users and millions of messages

## Sample Data Population

```sql
-- Insert AI models from current setup
INSERT INTO ai_models (id, name, display_name, avatar, provider) VALUES
('google/gemini-flash-1.5', 'Gemini', 'Gemini Flash 1.5', ' G ', 'google'),
('openai/gpt-4o-mini', 'GPT-4o mini', 'GPT-4o Mini', ' O ', 'openai'),
('anthropic/claude-3.5-sonnet', 'Claude', 'Claude 3.5 Sonnet', ' A ', 'anthropic'),
('meta-llama/llama-3-8b-instruct', 'Llama', 'Llama 3 8B', ' L ', 'meta'),
('deepseek/deepseek-v2-coder', 'DeepSeek V2', 'DeepSeek V2 Coder', ' D ', 'deepseek'),
('qwen/qwen-2-7b-instruct', 'Qwen', 'Qwen 2 7B', ' Q ', 'qwen');

-- Create default test user
INSERT INTO users (id, username, display_name) VALUES
('00000000-0000-0000-0000-000000000001', 'test_user', 'Test User');
```

## Implementation Notes

- Use PostgreSQL for JSONB support and performance
- Consider connection pooling for production deployment
- Implement proper error handling for database operations
- Add database migrations for schema versioning
- Consider backup and recovery strategies for production use