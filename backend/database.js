const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
    process.exit(1);
}

// Use service role key for backend operations to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
console.log('Database initialized with', supabaseServiceKey ? 'service role key' : 'anon key');

// Fallback sample data used when Supabase is unreachable
const SAMPLE_USER_ID = '00000000-0000-0000-0000-000000000001';
const SAMPLE_CONVERSATION_ID = '00000000-0000-0000-0000-000000000002';

const SAMPLE_MODEL_MAP = {
    'google/gemini-2.5-flash': { name: 'Gemini', avatar: ' G ' },
    'openai/gpt-4o-mini': { name: 'GPT-4o mini', avatar: ' O ' },
    'anthropic/claude-3.5-sonnet': { name: 'Claude', avatar: ' A ' },
    'meta-llama/llama-3-8b-instruct': { name: 'Llama', avatar: ' L ' },
    'deepseek/deepseek-chat': { name: 'DeepSeek Chat', avatar: ' D ' },
    'qwen/qwen-2.5-7b-instruct': { name: 'Qwen', avatar: ' Q ' },
    'moonshotai/kimi-k2': { name: 'Kimi K2', avatar: ' K ' },
    'x-ai/grok-4.1-fast:free': { name: 'Grok', avatar: ' X ' }
};

const DEFAULT_MODEL_IDS = Object.keys(SAMPLE_MODEL_MAP);

const SAMPLE_MESSAGES = [
    {
        id: 'sample-1',
        conversation_id: SAMPLE_CONVERSATION_ID,
        sender_type: 'user',
        user_id: SAMPLE_USER_ID,
        content: 'Hey team, could you walk me through the origins of traditional wrestling styles?',
        created_at: '2024-09-01T10:00:00Z'
    },
    {
        id: 'sample-2',
        conversation_id: SAMPLE_CONVERSATION_ID,
        sender_type: 'ai',
        user_id: SAMPLE_USER_ID,
        ai_model_id: 'openai/gpt-4o-mini',
        content: 'Absolutely! Pehlwani and Kushti draw from Persian and Mughal influences, blending physical training with yogic discipline.',
        created_at: '2024-09-01T10:00:10Z',
        ai_models: SAMPLE_MODEL_MAP['openai/gpt-4o-mini']
    },
    {
        id: 'sample-3',
        conversation_id: SAMPLE_CONVERSATION_ID,
        sender_type: 'ai',
        user_id: SAMPLE_USER_ID,
        ai_model_id: 'anthropic/claude-3.5-sonnet',
        content: 'Greco-Roman champions, meanwhile, focused on upper-body contests—no holds below the waist were allowed.',
        created_at: '2024-09-01T10:00:20Z',
        ai_models: SAMPLE_MODEL_MAP['anthropic/claude-3.5-sonnet']
    },
    {
        id: 'sample-4',
        conversation_id: SAMPLE_CONVERSATION_ID,
        sender_type: 'ai',
        user_id: SAMPLE_USER_ID,
        ai_model_id: 'google/gemini-2.5-flash',
        content: 'In Japan, sumo evolved as a Shinto ritual—bouts were offerings to the gods before they became a professional sport.',
        created_at: '2024-09-01T10:00:30Z',
        ai_models: SAMPLE_MODEL_MAP['google/gemini-2.5-flash']
    }
];

const SAMPLE_CONVERSATIONS = [
    {
        id: SAMPLE_CONVERSATION_ID,
        title: 'Wrestling Origins Explored',
        created_at: '2024-09-01T10:00:00Z',
        updated_at: '2024-09-01T10:00:30Z',
        created_by: SAMPLE_USER_ID,
        last_message: {
            sender_type: 'ai',
            content: SAMPLE_MESSAGES[SAMPLE_MESSAGES.length - 1].content,
            ai_models: SAMPLE_MODEL_MAP[SAMPLE_MESSAGES[SAMPLE_MESSAGES.length - 1].ai_model_id]
        }
    }
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function updateSampleConversationSummary(conversationId, message) {
    const conversation = SAMPLE_CONVERSATIONS.find((conv) => conv.id === conversationId);
    if (!conversation) {
        return;
    }

    conversation.updated_at = new Date().toISOString();
    conversation.last_message = {
        sender_type: message.sender_type,
        content: message.content,
        ai_models: message.ai_model_id ? SAMPLE_MODEL_MAP[message.ai_model_id] : null
    };
}

let SAMPLE_USER_PROFILE = {
    id: SAMPLE_USER_ID,
    username: 'you',
    email: 'you@example.com',
    display_name: 'You',
    avatar_url: null,
    created_at: '2024-09-01T09:55:00Z',
    updated_at: '2024-09-01T09:55:00Z'
};

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
    async getMessages(conversationId = SAMPLE_CONVERSATION_ID, userId = null) {
        try {
            if (userId && conversationId) {
                await this.assertConversationAccess(conversationId, userId);
            }

            let query = supabase
                .from('messages')
                .select(`
                    *,
                    ai_models(name, avatar)
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            // Conversation access is already enforced above; returning all messages for this conversation
            const { data, error } = await query;

            if (error) {
                console.error('Error fetching messages:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                if (userId && userId !== SAMPLE_USER_ID) {
                    return [];
                }
                return clone(SAMPLE_MESSAGES.filter(msg => msg.conversation_id === conversationId));
            }

            return data;
        } catch (error) {
            if (error?.status === 403) {
                throw error;
            }
            console.warn('Falling back to sample messages due to Supabase error:', error?.message || error);
            return clone(SAMPLE_MESSAGES.filter(msg => msg.conversation_id === conversationId));
        }
    }

    // Get all messages for a specific user across all conversations
    async getAllMessagesForUser(userId) {
        console.log('getAllMessagesForUser called with userId:', userId);

        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    ai_models(name, avatar)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching user messages:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                if (userId && userId !== SAMPLE_USER_ID) {
                    return [];
                }
                return clone(SAMPLE_MESSAGES.filter(msg => msg.user_id === userId));
            }

            console.log(`getAllMessagesForUser found ${data?.length || 0} messages`);
            return data;
        } catch (err) {
            console.warn('Falling back to sample user messages due to Supabase error:', err?.message || err);
            return clone(SAMPLE_MESSAGES.filter(msg => msg.user_id === userId));
        }
    }

    // Create a new user message (compatible with existing schema)
    async createUserMessage(content, conversationId = '00000000-0000-0000-0000-000000000002', replyToMessageId = null, conversationMode = 'group', userId = '00000000-0000-0000-0000-000000000001') {
        // Validate required parameters
        if (!content || content.trim() === '') {
            throw new Error('Message content is required');
        }

        if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
            throw new Error('Valid conversation ID is required');
        }

        if (!userId || userId === 'null' || userId === 'undefined') {
            throw new Error('Valid user ID is required');
        }

        if (userId && conversationId) {
            await this.assertConversationAccess(conversationId, userId);
        }

        console.log('Creating user message with validated params:', {
            content: content.substring(0, 50) + '...',
            conversationId,
            userId,
            replyToMessageId,
            conversationMode
        });

        // Use only existing schema fields for now
        const insertData = {
            conversation_id: conversationId,
            sender_type: 'user',
            sender_id: userId,
            user_id: userId,
            content: content,
            created_at: new Date().toISOString()
        };

        // Store reply info in metadata field if it exists, otherwise skip
        const hasValidReplyId = replyToMessageId && replyToMessageId !== 'null' && replyToMessageId !== 'undefined';
        if (hasValidReplyId || conversationMode !== 'group') {
            try {
                const metadata = {
                    conversation_mode: conversationMode
                };
                // Only add reply_to_message_id if it's a valid UUID
                if (hasValidReplyId) {
                    metadata.reply_to_message_id = replyToMessageId;
                }
                insertData.metadata = JSON.stringify(metadata);
            } catch (e) {
                // If metadata field doesn't exist, continue without it
                console.log('Metadata field not available, skipping reply info');
            }
        }

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                throw error;
            }

            await this.updateConversationTimestamp(conversationId);
            return data;
        } catch (error) {
            console.warn('Error creating user message in Supabase, using fallback store:', error?.message || error);
            const fallbackMessage = {
                ...insertData,
                id: `sample-${Date.now()}`,
                ai_models: null
            };
            SAMPLE_MESSAGES.push(fallbackMessage);
            updateSampleConversationSummary(conversationId, fallbackMessage);
            return clone(fallbackMessage);
        }
    }

    // Create a new AI message (compatible with existing schema)
    async createAIMessage(content, modelId, isFirstResponder = false, conversationId = '00000000-0000-0000-0000-000000000002', replyToMessageId = null, conversationMode = 'group', userId = '00000000-0000-0000-0000-000000000001') {
        // Validate required parameters
        if (!content || content.trim() === '') {
            throw new Error('AI message content is required');
        }

        if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
            throw new Error('Valid conversation ID is required for AI message');
        }

        if (!userId || userId === 'null' || userId === 'undefined') {
            throw new Error('Valid user ID is required for AI message');
        }

        if (!modelId || modelId.trim() === '') {
            throw new Error('AI model ID is required');
        }

        if (userId && conversationId) {
            await this.assertConversationAccess(conversationId, userId);
        }

        console.log('Creating AI message with validated params:', {
            content: content.substring(0, 50) + '...',
            modelId,
            conversationId,
            userId,
            isFirstResponder,
            conversationMode
        });

        const insertData = {
            conversation_id: conversationId,
            sender_type: 'ai',
            ai_model_id: modelId,
            user_id: userId,
            content: content,
            is_first_responder: isFirstResponder,
            created_at: new Date().toISOString()
        };

        // Store reply info in metadata field if it exists, otherwise skip
        const hasValidReplyId = replyToMessageId && replyToMessageId !== 'null' && replyToMessageId !== 'undefined';
        if (hasValidReplyId || conversationMode !== 'group') {
            try {
                const metadata = {
                    conversation_mode: conversationMode,
                    is_direct_reply: conversationMode === 'direct'
                };
                // Only add reply_to_message_id if it's a valid UUID
                if (hasValidReplyId) {
                    metadata.reply_to_message_id = replyToMessageId;
                }
                insertData.metadata = JSON.stringify(metadata);
            } catch (e) {
                console.log('Metadata field not available, skipping reply info');
            }
        }

        try {
            const { data, error } = await supabase
                .from('messages')
                .insert(insertData)
                .select(`
                    *,
                    ai_models(name, avatar)
                `)
                .single();

            if (error) {
                throw error;
            }

            await this.updateConversationTimestamp(conversationId);
            return data;
        } catch (error) {
            console.warn('Error creating AI message in Supabase, using fallback store:', error?.message || error);
            const fallbackMessage = {
                ...insertData,
                id: `sample-${Date.now()}`,
                ai_models: SAMPLE_MODEL_MAP[modelId] || null
            };
            SAMPLE_MESSAGES.push(fallbackMessage);
            updateSampleConversationSummary(conversationId, fallbackMessage);
            return clone(fallbackMessage);
        }
    }

    // Update conversation timestamp
    async updateConversationTimestamp(conversationId) {
        try {
            const { error } = await supabase
                .from('conversations')
                .update({
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', conversationId);

            if (error) {
                throw error;
            }
        } catch (err) {
            console.warn('Error updating conversation timestamp in Supabase:', err?.message || err);
            updateSampleConversationSummary(conversationId, {
                sender_type: 'system',
                content: 'Conversation updated',
                ai_model_id: null
            });
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
    async getConversations(userId = SAMPLE_USER_ID) {
        try {
            if (!userId) {
                return clone(SAMPLE_CONVERSATIONS);
            }

            const { data: participantRows, error } = await supabase
                .from('conversation_participants')
                .select(`
                    role,
                    conversation_id,
                    conversations!inner (
                        id,
                        title,
                        created_by,
                        created_at,
                        updated_at,
                        settings
                    )
                `)
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('conversations(updated_at)', { ascending: false });

            if (error) {
                console.error('❌ Error fetching conversations for user:', userId, error);
                throw error;
            }

            if (!participantRows || participantRows.length === 0) {
                return clone(SAMPLE_CONVERSATIONS);
            }

            const conversations = participantRows
                .map((row) => {
                    if (!row.conversations) return null;
                    return {
                        ...row.conversations,
                        participant_role: row.role || 'member'
                    };
                })
                .filter(Boolean);

            const conversationIds = conversations.map((conv) => conv.id);

            const lastMessageMap = await this.getLastMessagesForConversations(conversationIds).catch((err) => {
                console.warn('Unable to fetch last messages:', err?.message || err);
                return {};
            });

            return conversations.map((conversation) => {
                const lastMessage = lastMessageMap[conversation.id];
                return {
                    ...conversation,
                    last_message: lastMessage
                        ? {
                            sender_type: lastMessage.sender_type,
                            content: lastMessage.content,
                            created_at: lastMessage.created_at,
                            ai_models: lastMessage.ai_models || (lastMessage.ai_model_id ? SAMPLE_MODEL_MAP[lastMessage.ai_model_id] : null)
                        }
                        : null
                };
            });
        } catch (e) {
            console.warn('Falling back to sample conversations due to Supabase error:', e?.message || e);
            return clone(SAMPLE_CONVERSATIONS);
        }
    }

    async getLastMessagesForConversations(conversationIds = []) {
        if (!conversationIds.length) {
            return {};
        }

        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    conversation_id,
                    sender_type,
                    content,
                    created_at,
                    ai_model_id,
                    ai_models(name, avatar)
                `)
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const map = {};
            for (const message of data || []) {
                if (!map[message.conversation_id]) {
                    map[message.conversation_id] = message;
                }
            }

            return map;
        } catch (err) {
            console.warn('Unable to load last messages, returning empty map:', err?.message || err);
            return {};
        }
    }

    // Create new conversation
    async createConversationForUser(userId = SAMPLE_USER_ID, title = 'New Chat', authToken = null) {
        const conversationId = crypto.randomUUID();

        try {
            const now = new Date().toISOString();

            let client = supabase;
            if (authToken) {
                client = createClient(supabaseUrl, supabaseAnonKey, {
                    global: {
                        headers: { Authorization: `Bearer ${authToken}` }
                    }
                });
            }

            const { data: conversation, error: convError } = await client
                .from('conversations')
                .insert({
                    id: conversationId,
                    title,
                    created_by: userId,
                    created_at: now,
                    updated_at: now
                })
                .select()
                .single();

            if (convError) {
                throw convError;
            }

            try {
                await client
                    .from('conversation_participants')
                    .insert({
                        conversation_id: conversationId,
                        user_id: userId,
                        role: 'admin',
                        joined_at: now
                    });
            } catch (participantError) {
                if (participantError?.code === '23505') {
                    // unique violation is fine, means the row already exists for this user
                } else {
                    console.error('Error adding conversation participant:', participantError);
                    throw participantError;
                }
            }

            try {
                const modelRows = DEFAULT_MODEL_IDS.map((modelId) => ({
                    conversation_id: conversationId,
                    ai_model_id: modelId,
                    is_active: true
                }));

                if (modelRows.length) {
                    await client
                        .from('conversation_ai_models')
                        .insert(modelRows, { upsert: false });
                }
            } catch (modelError) {
                console.warn('Unable to attach default models:', modelError?.message || modelError);
            }

            try {
                await client
                    .from('messages')
                    .insert({
                        conversation_id: conversationId,
                        sender_type: 'system',
                        content: 'Welcome to the AI Group Chat! Select a First Responder and ask a question to begin.',
                        created_at: now
                    });
            } catch (msgError) {
                console.error('Error creating welcome message:', msgError);
            }

            return conversation;
        } catch (error) {
            console.error('Error creating conversation in Supabase:', error?.message || error);
            throw error;
        }
    }


    async softDeleteConversation(conversationId, userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        try {
            const { data, error } = await supabase
                .from('conversation_participants')
                .update({ is_active: false })
                .eq('conversation_id', conversationId)
                .eq('user_id', userId)
                .select('id');

            if (error) {
                throw error;
            }

            if (!data || data.length === 0) {
                const err = new Error('Conversation not found');
                err.status = 404;
                throw err;
            }

            return true;
        } catch (error) {
            if (error?.status === 403 || error?.status === 404) {
                throw error;
            }
            console.warn('Unable to soft delete conversation in Supabase, falling back:', error?.message || error);

            if (userId === SAMPLE_USER_ID) {
                const conversationIndex = SAMPLE_CONVERSATIONS.findIndex(conv => conv.id === conversationId);
                if (conversationIndex !== -1) {
                    SAMPLE_CONVERSATIONS.splice(conversationIndex, 1);
                }
                for (let i = SAMPLE_MESSAGES.length - 1; i >= 0; i -= 1) {
                    if (SAMPLE_MESSAGES[i].conversation_id === conversationId) {
                        SAMPLE_MESSAGES.splice(i, 1);
                    }
                }
            }

            return true;
        }
    }

    async deleteConversation(conversationId, userId) {
        try {
            await this.assertConversationAccess(conversationId, userId);

            const { data: conversation, error: fetchError } = await supabase
                .from('conversations')
                .select('created_by')
                .eq('id', conversationId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            if (conversation?.created_by && conversation.created_by !== userId) {
                const err = new Error('Only the conversation owner can delete it permanently');
                err.status = 403;
                throw err;
            }

            const { error: deleteError } = await supabase
                .from('conversations')
                .delete()
                .eq('id', conversationId);

            if (deleteError) {
                throw deleteError;
            }

            return true;
        } catch (error) {
            if (error?.status === 403) {
                throw error;
            }
            console.warn('Unable to delete conversation in Supabase, falling back:', error?.message || error);

            const sampleIndex = SAMPLE_CONVERSATIONS.findIndex(conv => conv.id === conversationId);
            if (sampleIndex !== -1) {
                SAMPLE_CONVERSATIONS.splice(sampleIndex, 1);
                for (let i = SAMPLE_MESSAGES.length - 1; i >= 0; i -= 1) {
                    if (SAMPLE_MESSAGES[i].conversation_id === conversationId) {
                        SAMPLE_MESSAGES.splice(i, 1);
                    }
                }
                return true;
            }

            throw error;
        }
    }

    async ensureDefaultConversation(userId, authToken = null) {
        if (!userId || userId === SAMPLE_USER_ID) {
            return;
        }

        try {
            const { data, error } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', userId)
                .eq('is_active', true)
                .limit(1);

            if (error) {
                throw error;
            }

            if (data && data.length > 0) {
                return;
            }

            await this.createConversationForUser(userId, 'New Chat', authToken);
        } catch (err) {
            console.warn('Unable to ensure default conversation:', err?.message || err);
        }
    }

    async assertConversationAccess(conversationId, userId) {
        if (!userId || userId === SAMPLE_USER_ID) {
            return true;
        }

        const { data, error } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            const err = new Error('conversation_access_denied');
            err.status = 403;
            throw err;
        }

        return true;
    }

    // Get conversation context (recent messages for context)
    async getConversationContext(conversationId, limit = 10, userId = null) {
        try {
            if (userId && conversationId) {
                await this.assertConversationAccess(conversationId, userId);
            }

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
                throw error;
            }

            return (data || []).reverse();
        } catch (err) {
            if (err?.status === 403) {
                throw err;
            }
            console.warn('Falling back to sample conversation context:', err?.message || err);
            if (userId && userId !== SAMPLE_USER_ID) {
                return [];
            }
            return clone(SAMPLE_MESSAGES
                .filter(msg => msg.conversation_id === conversationId)
                .slice(-limit));
        }
    }

    // Get message by ID (for reply context)
    async getMessageById(messageId) {
        try {
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
                throw error;
            }

            return data;
        } catch (err) {
            const fallback = SAMPLE_MESSAGES.find(msg => msg.id === messageId);
            if (!fallback) {
                return null;
            }
            return clone(fallback);
        }
    }

    // Update conversation mode and active model (fallback to existing schema)
    async updateConversationMode(conversationId, mode, activeModelId = null, threadStage = 'ongoing') {
        // Only update timestamp since schema doesn't have mode fields
        const updateData = {
            updated_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from('conversations')
                .update(updateData)
                .eq('id', conversationId);

            if (error) {
                throw error;
            }
        } catch (err) {
            console.warn('Supabase unavailable while updating conversation mode:', err?.message || err);
            updateSampleConversationSummary(conversationId, {
                sender_type: 'system',
                content: 'Conversation updated',
                ai_model_id: null
            });
        }

    }

    // Get conversation details (fallback to existing schema)
    async getConversationDetails(conversationId, userId = null) {
        try {
            if (userId && conversationId) {
                await this.assertConversationAccess(conversationId, userId);
            }

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
                throw error;
            }

            return {
                ...data,
                conversation_mode: 'group',
                active_model_id: null,
                thread_stage: 'initial'
            };
        } catch (err) {
            if (err?.status === 403) {
                throw err;
            }
            console.warn('Falling back to sample conversation details:', err?.message || err);
            if (userId && userId !== SAMPLE_USER_ID) {
                return null;
            }
            const conversation = SAMPLE_CONVERSATIONS.find(conv => conv.id === conversationId);
            if (!conversation) {
                return null;
            }
            return {
                ...clone(conversation),
                conversation_mode: 'group',
                active_model_id: null,
                thread_stage: 'initial'
            };
        }
    }

    // Health check
    async healthCheck() {
        try {
            const { data, error } = await supabase
                .from('ai_models')
                .select('count')
                .limit(1);
            if (error) {
                console.error('Database health check error:', error);
                throw error;
            }
            return true;
        } catch (err) {
            console.warn('Supabase unavailable during health check, using fallback data:', err?.message || err);
            return true;
        }
    }

    // User Prompts Management Methods

    // Get user's custom prompts for a specific type
    async getUserPrompts(userId, promptType = null) {
        try {
            let query = supabase
                .from('user_prompts')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (promptType) {
                query = query.eq('prompt_type', promptType);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching user prompts:', error);
                throw new Error('Failed to fetch user prompts');
            }

            return data || [];
        } catch (err) {
            console.error('Exception in getUserPrompts:', err);
            throw err;
        }
    }

    // Get user's active prompt for a specific type (returns default if none exists)
    async getUserActivePrompt(userId, promptType) {
        try {
            // First, try to get user's custom active prompt
            const { data: userPrompt, error: userError } = await supabase
                .from('user_prompts')
                .select('*')
                .eq('user_id', userId)
                .eq('prompt_type', promptType)
                .eq('is_active', true)
                .eq('is_default', true)
                .single();

            if (!userError && userPrompt) {
                return userPrompt;
            }

            // If no custom prompt, get system default
            const { data: defaultPrompt, error: defaultError } = await supabase
                .from('user_prompts')
                .select('*')
                .eq('user_id', '00000000-0000-0000-0000-000000000001')
                .eq('prompt_type', promptType)
                .eq('is_default', true)
                .single();

            if (defaultError) {
                console.error('Error fetching default prompt:', defaultError);
                throw new Error(`No prompt found for type: ${promptType}`);
            }

            return defaultPrompt;
        } catch (err) {
            console.error('Exception in getUserActivePrompt:', err);
            throw err;
        }
    }

    // Create a new user prompt
    async createUserPrompt(userId, promptType, title, content, isDefault = false) {
        try {
            // If setting as default, unset other defaults for this user/type
            if (isDefault) {
                await supabase
                    .from('user_prompts')
                    .update({ is_default: false })
                    .eq('user_id', userId)
                    .eq('prompt_type', promptType)
                    .eq('is_default', true);
            }

            const promptData = {
                user_id: userId,
                prompt_type: promptType,
                title,
                content,
                is_default: isDefault,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('user_prompts')
                .insert(promptData)
                .select()
                .single();

            if (error) {
                console.error('Error creating user prompt:', error);
                throw new Error('Failed to create user prompt');
            }

            return data;
        } catch (err) {
            console.error('Exception in createUserPrompt:', err);
            throw err;
        }
    }

    // Create or update user prompt (Legacy - keeping for reference if needed)
    async saveUserPrompt(userId, promptType, title, content, isDefault = false) {
        try {
            // If setting as default, unset other defaults for this user/type
            if (isDefault) {
                await supabase
                    .from('user_prompts')
                    .update({ is_default: false })
                    .eq('user_id', userId)
                    .eq('prompt_type', promptType)
                    .eq('is_default', true);
            }

            const promptData = {
                user_id: userId,
                prompt_type: promptType,
                title,
                content,
                is_default: isDefault,
                is_active: true,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('user_prompts')
                .insert(promptData)
                .select()
                .single();

            if (error) {
                console.error('Error saving user prompt:', error);
                throw new Error('Failed to save user prompt');
            }

            return data;
        } catch (err) {
            console.error('Exception in saveUserPrompt:', err);
            throw err;
        }
    }

    // Update existing user prompt
    async updateUserPrompt(userId, promptId, updates) {
        try {
            // If setting as default, unset other defaults for this user/type
            if (updates.is_default === true) {
                const { data: existingPrompt } = await supabase
                    .from('user_prompts')
                    .select('prompt_type')
                    .eq('id', promptId)
                    .eq('user_id', userId)
                    .single();

                if (existingPrompt) {
                    await supabase
                        .from('user_prompts')
                        .update({ is_default: false })
                        .eq('user_id', userId)
                        .eq('prompt_type', existingPrompt.prompt_type)
                        .eq('is_default', true);
                }
            }

            const { data, error } = await supabase
                .from('user_prompts')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', promptId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error updating user prompt:', error);
                throw new Error('Failed to update user prompt');
            }

            return data;
        } catch (err) {
            console.error('Exception in updateUserPrompt:', err);
            throw err;
        }
    }

    // Delete user prompt
    async deleteUserPrompt(userId, promptId) {
        try {
            const { data, error } = await supabase
                .from('user_prompts')
                .delete()
                .eq('id', promptId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error deleting user prompt:', error);
                throw new Error('Failed to delete user prompt');
            }

            return data;
        } catch (err) {
            console.error('Exception in deleteUserPrompt:', err);
            throw err;
        }
    }

    // Ensure user exists in our custom users table (for Supabase Auth users)
    async ensureUserExists(authUser, authToken = null) {
        try {
            const { data: existingUser, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (existingUser && !fetchError) {
                await this.ensureDefaultConversation(existingUser.id, authToken);
                return existingUser;
            }

            const userData = {
                id: authUser.id,
                username: authUser.email?.split('@')[0] || `user_${authUser.id.slice(0, 8)}`,
                email: authUser.email,
                display_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                avatar_url: authUser.user_metadata?.avatar_url || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_active: true
            };

            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert(userData)
                .select()
                .single();

            if (createError) {
                throw createError;
            }

            console.log('✅ Created new user record:', newUser.id, newUser.email);
            await this.ensureDefaultConversation(newUser.id, authToken);
            return newUser;
        } catch (err) {
            console.warn('Falling back to sample user profile:', err?.message || err);
            return clone(SAMPLE_USER_PROFILE);
        }
    }
    // Update user avatar URL
    async updateUserAvatar(userId, avatarUrl) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select('*')
                .single();

            if (error) {
                throw error;
            }

            SAMPLE_USER_PROFILE.avatar_url = avatarUrl;
            SAMPLE_USER_PROFILE.updated_at = new Date().toISOString();
            return data;
        } catch (err) {
            console.warn('Falling back when updating user avatar:', err?.message || err);
            SAMPLE_USER_PROFILE.avatar_url = avatarUrl;
            SAMPLE_USER_PROFILE.updated_at = new Date().toISOString();
            return clone(SAMPLE_USER_PROFILE);
        }
    }

    // Update user display name
    async updateUserDisplayName(userId, displayName) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                    display_name: displayName,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select('*')
                .single();

            if (error) {
                throw error;
            }

            SAMPLE_USER_PROFILE.display_name = displayName;
            SAMPLE_USER_PROFILE.updated_at = new Date().toISOString();
            return data;
        } catch (err) {
            console.warn('Falling back when updating display name:', err?.message || err);
            SAMPLE_USER_PROFILE.display_name = displayName;
            SAMPLE_USER_PROFILE.updated_at = new Date().toISOString();
            return clone(SAMPLE_USER_PROFILE);
        }
    }

    // Get user profile information
    async getUserProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, email, display_name, avatar_url, created_at')
                .eq('id', userId)
                .single();

            if (error) {
                throw error;
            }

            SAMPLE_USER_PROFILE = {
                ...SAMPLE_USER_PROFILE,
                ...data,
            };

            return data;
        } catch (err) {
            console.warn('Falling back to sample profile:', err?.message || err);
            return clone(SAMPLE_USER_PROFILE);
        }
    }

    // Update conversation avatar
    async updateConversationAvatar(conversationId, avatarUrl) {
        // Get current settings
        const { data: conversation, error: fetchError } = await supabase
            .from('conversations')
            .select('settings')
            .eq('id', conversationId)
            .single();

        if (fetchError) {
            console.error('Error fetching conversation:', fetchError);
            throw new Error('Failed to fetch conversation');
        }

        // Update settings with avatar URL
        const currentSettings = conversation.settings || {};
        const updatedSettings = {
            ...currentSettings,
            avatar_url: avatarUrl
        };

        const { data, error } = await supabase
            .from('conversations')
            .update({
                settings: updatedSettings,
                updated_at: new Date().toISOString()
            })
            .eq('id', conversationId)
            .select('*')
            .single();

        if (error) {
            console.error('Error updating conversation avatar:', error);
            throw new Error('Failed to update conversation avatar');
        }

        return data;
    }

    // Get conversation messages for AI image generation
    async getConversationMessages(conversationId) {
        const { data, error } = await supabase
            .from('messages')
            .select('id, sender_type, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching conversation messages:', error);
            throw new Error('Failed to fetch conversation messages');
        }

        return data;
    }
}

module.exports = new Database();
