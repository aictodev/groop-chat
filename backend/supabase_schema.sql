-- Group Chat Application Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Conversations Table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb
);

-- AI Models Table
CREATE TABLE ai_models (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    avatar VARCHAR(10),
    provider VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    capabilities JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'ai', 'system')),
    sender_id UUID REFERENCES users(id),
    ai_model_id VARCHAR(100) REFERENCES ai_models(id),
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    parent_message_id UUID REFERENCES messages(id),
    is_first_responder BOOLEAN DEFAULT false
);

-- Conversation Participants Table
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(conversation_id, user_id)
);

-- Conversation AI Models Table
CREATE TABLE conversation_ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    ai_model_id VARCHAR(100) REFERENCES ai_models(id),
    is_active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb,
    UNIQUE(conversation_id, ai_model_id)
);

-- Performance Indexes
CREATE INDEX idx_messages_conversation_created_at ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX idx_participants_user_active ON conversation_participants(user_id, is_active);
CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);

-- Insert AI models from current setup
INSERT INTO ai_models (id, name, display_name, avatar, provider) VALUES
('google/gemini-flash-1.5', 'Gemini', 'Gemini Flash 1.5', ' G ', 'google'),
('openai/gpt-4o-mini', 'GPT-4o mini', 'GPT-4o Mini', ' O ', 'openai'),
('anthropic/claude-3.5-sonnet', 'Claude', 'Claude 3.5 Sonnet', ' A ', 'anthropic'),
('meta-llama/llama-3-8b-instruct', 'Llama', 'Llama 3 8B', ' L ', 'meta'),
('deepseek/deepseek-chat', 'DeepSeek Chat', 'DeepSeek Chat V3.1', ' D ', 'deepseek'),
('qwen/qwen-2-7b-instruct', 'Qwen', 'Qwen 2 7B', ' Q ', 'qwen');

-- Create default test user (update username as needed)
INSERT INTO users (id, username, display_name) VALUES
('00000000-0000-0000-0000-000000000001', 'test_user', 'Test User');

-- Create a default conversation for testing
INSERT INTO conversations (id, title, created_by) VALUES
('00000000-0000-0000-0000-000000000002', 'AI Group Chat', '00000000-0000-0000-0000-000000000001');

-- Add test user as participant in default conversation
INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin');

-- Add all AI models to the default conversation
INSERT INTO conversation_ai_models (conversation_id, ai_model_id) VALUES
('00000000-0000-0000-0000-000000000002', 'google/gemini-flash-1.5'),
('00000000-0000-0000-0000-000000000002', 'openai/gpt-4o-mini'),
('00000000-0000-0000-0000-000000000002', 'anthropic/claude-3.5-sonnet'),
('00000000-0000-0000-0000-000000000002', 'meta-llama/llama-3-8b-instruct'),
('00000000-0000-0000-0000-000000000002', 'deepseek/deepseek-chat'),
('00000000-0000-0000-0000-000000000002', 'qwen/qwen-2-7b-instruct');

-- Add initial system message
INSERT INTO messages (id, conversation_id, sender_type, content, created_at) VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'system', 'Welcome to the AI Group Chat! Select a First Responder and ask a question to begin.', NOW());