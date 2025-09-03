const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Database operations
class Database {
    // Get or create default conversation for testing
    async getDefaultConversation() {
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', '00000000-0000-0000-0000-000000000002')
            .single();
        
        if (error) {
            console.error('Error fetching default conversation:', error);
            throw new Error('Failed to fetch default conversation');
        }
        
        return data;
    }

    // Get all messages for a conversation
    async getMessages(conversationId = '00000000-0000-0000-0000-000000000002') {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                ai_models(name, avatar)
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Error fetching messages:', error);
            throw new Error('Failed to fetch messages');
        }
        
        return data;
    }

    // Create a new user message (compatible with existing schema)
    async createUserMessage(content, conversationId = '00000000-0000-0000-0000-000000000002', replyToMessageId = null, conversationMode = 'group') {
        // Use only existing schema fields for now
        const insertData = {
            conversation_id: conversationId,
            sender_type: 'user',
            sender_id: '00000000-0000-0000-0000-000000000001', // Default test user
            content: content,
            created_at: new Date().toISOString()
        };
        
        // Store reply info in metadata field if it exists, otherwise skip
        if (replyToMessageId || conversationMode !== 'group') {
            try {
                insertData.metadata = JSON.stringify({
                    reply_to_message_id: replyToMessageId,
                    conversation_mode: conversationMode
                });
            } catch (e) {
                // If metadata field doesn't exist, continue without it
                console.log('Metadata field not available, skipping reply info');
            }
        }
        
        const { data, error } = await supabase
            .from('messages')
            .insert(insertData)
            .select()
            .single();
        
        if (error) {
            console.error('Error creating user message:', error);
            throw new Error('Failed to create user message');
        }
        
        // Update conversation last_message_at
        await this.updateConversationTimestamp(conversationId);
        
        return data;
    }

    // Create a new AI message (compatible with existing schema)
    async createAIMessage(content, modelId, isFirstResponder = false, conversationId = '00000000-0000-0000-0000-000000000002', replyToMessageId = null, conversationMode = 'group') {
        const insertData = {
            conversation_id: conversationId,
            sender_type: 'ai',
            ai_model_id: modelId,
            content: content,
            is_first_responder: isFirstResponder,
            created_at: new Date().toISOString()
        };
        
        // Store reply info in metadata field if it exists, otherwise skip
        if (replyToMessageId || conversationMode !== 'group') {
            try {
                insertData.metadata = JSON.stringify({
                    reply_to_message_id: replyToMessageId,
                    conversation_mode: conversationMode,
                    is_direct_reply: conversationMode === 'direct'
                });
            } catch (e) {
                console.log('Metadata field not available, skipping reply info');
            }
        }
        
        const { data, error } = await supabase
            .from('messages')
            .insert(insertData)
            .select(`
                *,
                ai_models(name, avatar)
            `)
            .single();
        
        if (error) {
            console.error('Error creating AI message:', error);
            throw new Error('Failed to create AI message');
        }
        
        // Update conversation last_message_at
        await this.updateConversationTimestamp(conversationId);
        
        return data;
    }

    // Update conversation timestamp
    async updateConversationTimestamp(conversationId) {
        const { error } = await supabase
            .from('conversations')
            .update({ 
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        
        if (error) {
            console.error('Error updating conversation timestamp:', error);
        }
    }

    // Update conversation title
    async updateConversationTitle(conversationId, title) {
        const { error } = await supabase
            .from('conversations')
            .update({ 
                title: title,
                updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);
        
        if (error) {
            console.error('Error updating conversation title:', error);
            throw new Error('Failed to update conversation title');
        }
    }

    // Get AI models that are active in a conversation
    async getConversationAIModels(conversationId = '00000000-0000-0000-0000-000000000002') {
        const { data, error } = await supabase
            .from('conversation_ai_models')
            .select(`
                ai_models(*)
            `)
            .eq('conversation_id', conversationId)
            .eq('is_active', true);
        
        if (error) {
            console.error('Error fetching conversation AI models:', error);
            throw new Error('Failed to fetch conversation AI models');
        }
        
        return data.map(item => item.ai_models);
    }

    // Get AI model details
    async getAIModel(modelId) {
        const { data, error } = await supabase
            .from('ai_models')
            .select('*')
            .eq('id', modelId)
            .single();
        
        if (error) {
            console.error('Error fetching AI model:', error);
            throw new Error('Failed to fetch AI model');
        }
        
        return data;
    }

    // Create system message
    async createSystemMessage(content, conversationId = '00000000-0000-0000-0000-000000000002') {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_type: 'system',
                content: content,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating system message:', error);
            throw new Error('Failed to create system message');
        }
        
        return data;
    }

    // Get all conversations for user with last message preview
    async getConversations() {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                last_message:messages(content, sender_type, ai_models(name))
            `)
            .eq('created_by', '00000000-0000-0000-0000-000000000001') // Default test user
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching conversations:', error);
            throw new Error('Failed to fetch conversations');
        }
        
        // Process conversations to get the actual last message
        const processedConversations = await Promise.all(
            data.map(async (conversation) => {
                // Get the most recent message for this conversation
                const { data: lastMessage } = await supabase
                    .from('messages')
                    .select(`
                        content,
                        sender_type,
                        ai_models(name)
                    `)
                    .eq('conversation_id', conversation.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                return {
                    ...conversation,
                    last_message: lastMessage && lastMessage[0] ? lastMessage[0] : null
                };
            })
        );
        
        return processedConversations;
    }

    // Create new conversation
    async createConversation() {
        const conversationId = crypto.randomUUID();
        
        // Create conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                id: conversationId,
                title: 'New Chat',
                created_by: '00000000-0000-0000-0000-000000000001', // Default test user
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (convError) {
            console.error('Error creating conversation:', convError);
            throw new Error('Failed to create conversation');
        }
        
        // Add test user as participant
        await supabase
            .from('conversation_participants')
            .insert({
                conversation_id: conversationId,
                user_id: '00000000-0000-0000-0000-000000000001',
                role: 'admin'
            });
        
        // Add all AI models to the conversation
        const aiModelInserts = [
            'google/gemini-2.5-flash',
            'openai/gpt-4o-mini', 
            'anthropic/claude-3.5-sonnet',
            'meta-llama/llama-3-8b-instruct',
            'deepseek/deepseek-chat',
            'qwen/qwen-2.5-7b-instruct'
        ].map(modelId => ({
            conversation_id: conversationId,
            ai_model_id: modelId
        }));
        
        await supabase
            .from('conversation_ai_models')
            .insert(aiModelInserts);
        
        // Add welcome system message
        await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_type: 'system',
                content: 'Welcome to the AI Group Chat! Select a First Responder and ask a question to begin.',
                created_at: new Date().toISOString()
            });
        
        return conversation;
    }

    // Get conversation context (recent messages for context)
    async getConversationContext(conversationId, limit = 10) {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                sender_type,
                ai_models(name),
                created_at
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('Error fetching conversation context:', error);
            return [];
        }
        
        return data.reverse(); // Return in chronological order
    }

    // Get message by ID (for reply context)
    async getMessageById(messageId) {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                sender_type,
                ai_model_id,
                ai_models(name, avatar),
                created_at
            `)
            .eq('id', messageId)
            .single();
        
        if (error) {
            console.error('Error fetching message:', error);
            return null;
        }
        
        return data;
    }

    // Update conversation mode and active model (fallback to existing schema)
    async updateConversationMode(conversationId, mode, activeModelId = null, threadStage = 'ongoing') {
        // Only update timestamp since schema doesn't have mode fields
        const updateData = {
            updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('conversations')
            .update(updateData)
            .eq('id', conversationId);
        
        if (error) {
            console.error('Error updating conversation timestamp:', error);
        }
        
        // Log the mode info for debugging (since we can't store it in DB)
        console.log(`Conversation ${conversationId} mode: ${mode}, model: ${activeModelId}, stage: ${threadStage}`);
    }

    // Get conversation details (fallback to existing schema)
    async getConversationDetails(conversationId) {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                id,
                title,
                created_by,
                created_at,
                updated_at
            `)
            .eq('id', conversationId)
            .single();
        
        if (error) {
            console.error('Error fetching conversation details:', error);
            return null;
        }
        
        // Add default values for missing schema fields
        return {
            ...data,
            conversation_mode: 'group',
            active_model_id: null,
            thread_stage: 'initial'
        };
    }

    // Health check
    async healthCheck() {
        try {
            const { data, error } = await supabase
                .from('ai_models')
                .select('count')
                .limit(1);
            
            return !error;
        } catch (err) {
            return false;
        }
    }
}

module.exports = new Database();