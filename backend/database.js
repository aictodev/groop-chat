const path = require('path');
const crypto = require('crypto');

const convexUrl = process.env.CONVEX_URL;
const convexAdminKey =
    process.env.CONVEX_ADMIN_KEY ||
    process.env.CONVEX_DEPLOY_KEY ||
    process.env.CONVEX_API_KEY;

let convex = null;
let api = null;

try {
    if (convexUrl) {
        const { ConvexHttpClient } = require('convex/browser');
        const apiPath = path.join(__dirname, '..', 'convex', '_generated', 'api_cjs.cjs');
        api = require(apiPath).api;
        convex = new ConvexHttpClient(convexUrl);
        if (convexAdminKey) {
            convex.setAdminAuth(convexAdminKey);
        }
        console.log('Convex database client initialized');
    } else {
        console.warn('CONVEX_URL missing, database operations will use fallback data');
    }
} catch (e) {
    console.error('Failed to initialize Convex client:', e);
}

const hasConvex = () => Boolean(convex && api);

const convexQuery = async (fn, args) => {
    if (!hasConvex()) {
        throw new Error('convex_unavailable');
    }
    return await convex.query(fn, args);
};

const convexMutation = async (fn, args) => {
    if (!hasConvex()) {
        throw new Error('convex_unavailable');
    }
    return await convex.mutation(fn, args);
};

// Fallback sample data used when Convex is unreachable
const SAMPLE_USER_ID = '00000000-0000-0000-0000-000000000001';
const SAMPLE_CONVERSATION_ID = '00000000-0000-0000-0000-000000000002';

const SAMPLE_MODEL_MAP = {
    'google/gemini-2.5-flash': { name: 'Gemini', avatar: ' G ', display_name: 'Gemini 2.5 Flash', provider: 'google' },
    'openai/gpt-4o-mini': { name: 'GPT-4o mini', avatar: ' O ', display_name: 'GPT-4o Mini', provider: 'openai' },
    'anthropic/claude-3.5-sonnet': { name: 'Claude', avatar: ' A ', display_name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    'meta-llama/llama-3-8b-instruct': { name: 'Llama', avatar: ' L ', display_name: 'Llama 3 8B Instruct', provider: 'meta' },
    'deepseek/deepseek-chat': { name: 'DeepSeek Chat', avatar: ' D ', display_name: 'DeepSeek Chat', provider: 'deepseek' },
    'qwen/qwen-2.5-7b-instruct': { name: 'Qwen', avatar: ' Q ', display_name: 'Qwen 2.5 7B Instruct', provider: 'qwen' },
    'moonshotai/kimi-k2': { name: 'Kimi K2', avatar: ' K ', display_name: 'Moonshot Kimi K2', provider: 'moonshotai' },
    'x-ai/grok-4.1-fast:free': { name: 'Grok', avatar: ' X ', display_name: 'Grok 4.1 Fast', provider: 'x-ai' }
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

const buildModelSeed = () =>
    Object.entries(SAMPLE_MODEL_MAP).map(([id, info]) => ({
        id,
        name: info.name,
        display_name: info.display_name || info.name,
        avatar: info.avatar,
        provider: info.provider || id.split('/')[0]
    }));

// Database operations
class Database {
    async ensureAiModels() {
        if (!hasConvex()) {
            return false;
        }
        try {
            await convexMutation(api.db.upsertAiModels, { models: buildModelSeed() });
            return true;
        } catch (err) {
            console.warn('Failed to ensure AI models in Convex:', err?.message || err);
            return false;
        }
    }

    // Get or create default conversation for testing
    async getDefaultConversation() {
        try {
            const conversation = await convexQuery(api.db.getConversationDetails, {
                conversationId: SAMPLE_CONVERSATION_ID
            });
            if (!conversation) {
                throw new Error('Failed to fetch default conversation');
            }
            return conversation;
        } catch (error) {
            console.warn('Using sample default conversation:', error?.message || error);
            return clone(SAMPLE_CONVERSATIONS[0]);
        }
    }

    // Get all messages for a conversation
    async getMessages(conversationId = SAMPLE_CONVERSATION_ID, userId = null) {
        try {
            const data = await convexQuery(api.db.getMessages, {
                conversationId,
                userId: userId || undefined
            });

            if (!data || data.length === 0) {
                if (userId && userId !== SAMPLE_USER_ID) {
                    return [];
                }
                return clone(SAMPLE_MESSAGES.filter(msg => msg.conversation_id === conversationId));
            }

            return data;
        } catch (error) {
            if (error?.message === 'conversation_access_denied') {
                throw error;
            }
            console.warn('Falling back to sample messages due to Convex error:', error?.message || error);
            return clone(SAMPLE_MESSAGES.filter(msg => msg.conversation_id === conversationId));
        }
    }

    // Get all messages for a specific user across all conversations
    async getAllMessagesForUser(userId) {
        console.log('getAllMessagesForUser called with userId:', userId);

        try {
            const data = await convexQuery(api.db.getAllMessagesForUser, { userId });

            if (!data || data.length === 0) {
                if (userId && userId !== SAMPLE_USER_ID) {
                    return [];
                }
                return clone(SAMPLE_MESSAGES.filter(msg => msg.user_id === userId));
            }

            console.log(`getAllMessagesForUser found ${data?.length || 0} messages`);
            return data;
        } catch (err) {
            console.warn('Falling back to sample user messages due to Convex error:', err?.message || err);
            return clone(SAMPLE_MESSAGES.filter(msg => msg.user_id === userId));
        }
    }

    // Create a new user message (compatible with existing schema)
    async createUserMessage(content, conversationId = SAMPLE_CONVERSATION_ID, replyToMessageId = null, conversationMode = 'group', userId = SAMPLE_USER_ID) {
        if (!content || content.trim() === '') {
            throw new Error('Message content is required');
        }

        if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
            throw new Error('Valid conversation ID is required');
        }

        if (!userId || userId === 'null' || userId === 'undefined') {
            throw new Error('Valid user ID is required');
        }

        const insertData = {
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            sender_type: 'user',
            sender_id: userId,
            user_id: userId,
            content: content,
            created_at: new Date().toISOString()
        };

        const hasValidReplyId = replyToMessageId && replyToMessageId !== 'null' && replyToMessageId !== 'undefined';
        if (hasValidReplyId || conversationMode !== 'group') {
            insertData.metadata = {
                conversation_mode: conversationMode
            };
            if (hasValidReplyId) {
                insertData.metadata.reply_to_message_id = replyToMessageId;
            }
        }

        try {
            await convexMutation(api.db.createUserMessage, insertData);
            await this.updateConversationTimestamp(conversationId);
            return insertData;
        } catch (error) {
            console.warn('Error creating user message in Convex, using fallback store:', error?.message || error);
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
    async createAIMessage(content, modelId, isFirstResponder = false, conversationId = SAMPLE_CONVERSATION_ID, replyToMessageId = null, conversationMode = 'group', userId = SAMPLE_USER_ID, extraMetadata = {}) {
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

        const insertData = {
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            sender_type: 'ai',
            ai_model_id: modelId,
            user_id: userId,
            content: content,
            is_first_responder: isFirstResponder,
            created_at: new Date().toISOString()
        };

        const hasValidReplyId = replyToMessageId && replyToMessageId !== 'null' && replyToMessageId !== 'undefined';
        insertData.metadata = {
            conversation_mode: conversationMode,
            is_direct_reply: conversationMode === 'direct',
            ...extraMetadata
        };
        if (hasValidReplyId) {
            insertData.metadata.reply_to_message_id = replyToMessageId;
        }

        try {
            await convexMutation(api.db.createAIMessage, insertData);
            await this.updateConversationTimestamp(conversationId);
            const model = await this.getAIModel(modelId).catch(() => null);
            return {
                ...insertData,
                ai_models: model ? { name: model.name, avatar: model.avatar } : SAMPLE_MODEL_MAP[modelId] || null
            };
        } catch (error) {
            console.warn('Error creating AI message in Convex, using fallback store:', error?.message || error);
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
            await convexMutation(api.db.updateConversationTimestamp, { conversationId });
        } catch (err) {
            console.warn('Error updating conversation timestamp in Convex:', err?.message || err);
            updateSampleConversationSummary(conversationId, {
                sender_type: 'system',
                content: 'Conversation updated',
                ai_model_id: null
            });
        }
    }

    // Update conversation title
    async updateConversationTitle(conversationId, title) {
        try {
            await convexMutation(api.db.updateConversationTitle, { conversationId, title });
        } catch (error) {
            console.error('Error updating conversation title:', error);
            throw new Error('Failed to update conversation title');
        }
    }

    // Get AI models that are active in a conversation
    async getConversationAIModels(conversationId = SAMPLE_CONVERSATION_ID) {
        try {
            return await convexQuery(api.db.getConversationAIModels, { conversationId });
        } catch (error) {
            console.error('Error fetching conversation AI models:', error);
            throw new Error('Failed to fetch conversation AI models');
        }
    }

    // Get AI model details
    async getAIModel(modelId) {
        try {
            return await convexQuery(api.db.getAIModel, { modelId });
        } catch (error) {
            console.error('Error fetching AI model:', error);
            throw new Error('Failed to fetch AI model');
        }
    }

    // Create system message
    async createSystemMessage(content, conversationId = SAMPLE_CONVERSATION_ID) {
        const payload = {
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            content: content,
            created_at: new Date().toISOString()
        };

        try {
            await convexMutation(api.db.createSystemMessage, payload);
            return payload;
        } catch (error) {
            console.error('Error creating system message:', error);
            throw new Error('Failed to create system message');
        }
    }

    // Get all conversations for user with last message preview
    async getConversations(userId = SAMPLE_USER_ID) {
        try {
            if (!userId) {
                return clone(SAMPLE_CONVERSATIONS);
            }

            const conversations = await convexQuery(api.db.getConversationsForUser, { userId });

            if (!conversations || conversations.length === 0) {
                return clone(SAMPLE_CONVERSATIONS);
            }

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
            console.warn('Falling back to sample conversations due to Convex error:', e?.message || e);
            return clone(SAMPLE_CONVERSATIONS);
        }
    }

    async getLastMessagesForConversations(conversationIds = []) {
        if (!conversationIds.length) {
            return {};
        }

        try {
            return await convexQuery(api.db.getLastMessagesForConversations, { conversationIds });
        } catch (err) {
            console.warn('Unable to load last messages, returning empty map:', err?.message || err);
            return {};
        }
    }

    // Create new conversation
    async createConversationForUser(userId = SAMPLE_USER_ID, title = 'New Chat') {
        const conversationId = crypto.randomUUID();

        try {
            await this.ensureAiModels();
            const conversation = await convexMutation(api.db.createConversationForUser, {
                conversationId,
                userId,
                title,
                defaultModelIds: DEFAULT_MODEL_IDS
            });
            return conversation;
        } catch (error) {
            console.error('Error creating conversation in Convex:', error?.message || error);
            throw error;
        }
    }

    async softDeleteConversation(conversationId, userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        try {
            await convexMutation(api.db.softDeleteConversation, { conversationId, userId });
            return true;
        } catch (error) {
            if (error?.message === 'conversation_not_found') {
                const err = new Error('Conversation not found');
                err.status = 404;
                throw err;
            }
            console.warn('Unable to soft delete conversation in Convex, falling back:', error?.message || error);

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
            await convexMutation(api.db.deleteConversation, { conversationId, userId });
            return true;
        } catch (error) {
            if (error?.message === 'conversation_delete_forbidden') {
                const err = new Error('Only the conversation owner can delete it permanently');
                err.status = 403;
                throw err;
            }
            if (error?.message === 'conversation_not_found') {
                const err = new Error('Conversation not found');
                err.status = 404;
                throw err;
            }
            if (error?.status === 403) {
                throw error;
            }
            console.warn('Unable to delete conversation in Convex, falling back:', error?.message || error);

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

    async ensureDefaultConversation(userId) {
        if (!userId || userId === SAMPLE_USER_ID) {
            return;
        }

        try {
            const conversations = await convexQuery(api.db.getConversationsForUser, { userId });
            if (conversations && conversations.length > 0) {
                return;
            }
            await this.createConversationForUser(userId, 'New Chat');
        } catch (err) {
            console.warn('Unable to ensure default conversation:', err?.message || err);
        }
    }

    async assertConversationAccess(conversationId, userId) {
        if (!userId || userId === SAMPLE_USER_ID) {
            return true;
        }

        try {
            await convexQuery(api.db.getConversationDetails, { conversationId, userId });
            return true;
        } catch (error) {
            if (error?.message === 'conversation_access_denied') {
                const err = new Error('conversation_access_denied');
                err.status = 403;
                throw err;
            }
            throw error;
        }
    }

    // Get conversation context (recent messages for context)
    async getConversationContext(conversationId, limit = 10, userId = null) {
        try {
            const data = await convexQuery(api.db.getConversationContext, {
                conversationId,
                limit,
                userId: userId || undefined
            });
            return data || [];
        } catch (err) {
            if (err?.message === 'conversation_access_denied') {
                const error = new Error('conversation_access_denied');
                error.status = 403;
                throw error;
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
            const data = await convexQuery(api.db.getMessageById, { messageId });
            return data || null;
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
        try {
            await convexMutation(api.db.updateConversationMode, { conversationId });
        } catch (err) {
            console.warn('Convex unavailable while updating conversation mode:', err?.message || err);
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
            const data = await convexQuery(api.db.getConversationDetails, {
                conversationId,
                userId: userId || undefined
            });
            if (!data) {
                throw new Error('Conversation not found');
            }
            return {
                ...data,
                conversation_mode: 'group',
                active_model_id: null,
                thread_stage: 'initial'
            };
        } catch (err) {
            if (err?.message === 'conversation_access_denied') {
                const error = new Error('conversation_access_denied');
                error.status = 403;
                throw error;
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
            await convexQuery(api.db.healthCheck, {});
            return true;
        } catch (err) {
            console.warn('Convex unavailable during health check, using fallback data:', err?.message || err);
            return true;
        }
    }

    // User Prompts Management Methods

    async getUserPrompts(userId, promptType = null) {
        try {
            return await convexQuery(api.db.getUserPrompts, {
                userId,
                promptType: promptType || undefined
            });
        } catch (err) {
            console.error('Exception in getUserPrompts:', err);
            throw err;
        }
    }

    // Get user's active prompt for a specific type (returns default if none exists)
    async getUserActivePrompt(userId, promptType) {
        try {
            const prompts = await this.getUserPrompts(userId, promptType);
            const activePrompt = prompts.find(p => p.is_active && p.is_default);
            if (activePrompt) {
                return activePrompt;
            }

            const systemPrompts = await this.getUserPrompts(SAMPLE_USER_ID, promptType);
            const systemDefault = systemPrompts.find(p => p.is_active && p.is_default);
            if (systemDefault) {
                return systemDefault;
            }

            throw new Error(`No prompt found for type: ${promptType}`);
        } catch (err) {
            console.error('Exception in getUserActivePrompt:', err);
            throw err;
        }
    }

    // Create a new user prompt
    async createUserPrompt(userId, promptType, title, content, isDefault = false) {
        try {
            const promptData = {
                id: crypto.randomUUID(),
                user_id: userId,
                prompt_type: promptType,
                title,
                content,
                is_default: isDefault,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await convexMutation(api.db.createUserPrompt, promptData);
            return promptData;
        } catch (err) {
            console.error('Exception in createUserPrompt:', err);
            throw err;
        }
    }

    // Create or update user prompt (Legacy - keeping for reference if needed)
    async saveUserPrompt(userId, promptType, title, content, isDefault = false) {
        return await this.createUserPrompt(userId, promptType, title, content, isDefault);
    }

    // Update existing user prompt
    async updateUserPrompt(userId, promptId, updates) {
        try {
            await convexMutation(api.db.updateUserPrompt, { userId, promptId, updates });
            return true;
        } catch (err) {
            console.error('Exception in updateUserPrompt:', err);
            throw err;
        }
    }

    // Delete user prompt
    async deleteUserPrompt(userId, promptId) {
        try {
            await convexMutation(api.db.deleteUserPrompt, { userId, promptId });
            return true;
        } catch (err) {
            console.error('Exception in deleteUserPrompt:', err);
            throw err;
        }
    }

    // Ensure user exists in our custom users table (for Supabase Auth users)
    async ensureUserExists(authUser) {
        try {
            const existingUser = await convexQuery(api.db.getUserById, { userId: authUser.id });

            if (existingUser) {
                await this.ensureDefaultConversation(existingUser.id);
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

            await convexMutation(api.db.createUser, userData);
            console.log('✅ Created new user record:', userData.id, userData.email);
            await this.ensureDefaultConversation(userData.id);
            return userData;
        } catch (err) {
            console.warn('Falling back to sample user profile:', err?.message || err);
            return clone(SAMPLE_USER_PROFILE);
        }
    }

    // Update user avatar URL
    async updateUserAvatar(userId, avatarUrl) {
        try {
            await convexMutation(api.db.updateUserAvatar, { userId, avatarUrl });
            SAMPLE_USER_PROFILE.avatar_url = avatarUrl;
            SAMPLE_USER_PROFILE.updated_at = new Date().toISOString();
            return clone(SAMPLE_USER_PROFILE);
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
            await convexMutation(api.db.updateUserDisplayName, { userId, displayName });
            SAMPLE_USER_PROFILE.display_name = displayName;
            SAMPLE_USER_PROFILE.updated_at = new Date().toISOString();
            return clone(SAMPLE_USER_PROFILE);
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
            const data = await convexQuery(api.db.getUserProfile, { userId });
            if (!data) {
                throw new Error('User not found');
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
        try {
            await convexMutation(api.db.updateConversationAvatar, { conversationId, avatarUrl });
            return true;
        } catch (err) {
            console.error('Error updating conversation avatar:', err);
            throw new Error('Failed to update conversation avatar');
        }
    }

    // Get conversation messages for AI image generation
    async getConversationMessages(conversationId) {
        try {
            return await convexQuery(api.db.getConversationMessages, { conversationId });
        } catch (err) {
            console.error('Error fetching conversation messages:', err);
            throw new Error('Failed to fetch conversation messages');
        }
    }
}

module.exports = new Database();
