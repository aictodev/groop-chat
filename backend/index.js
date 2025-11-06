require('dotenv').config({ path: '../.env' });
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const database = require('./database');
const { authenticateUser, optionalAuth } = require('./auth');

// Alias for consistency
const requireAuth = authenticateUser;

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for frontend communication

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const FALLBACK_USER_ID = '00000000-0000-0000-0000-000000000001';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Define the models participating in the chat
const ALL_MODELS = [
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3-8b-instruct",
    "deepseek/deepseek-chat",
    "qwen/qwen-2.5-7b-instruct",
    "moonshotai/kimi-k2"
];

// A simple mapping for model names and avatars for the frontend
const MODEL_DETAILS = {
    "google/gemini-2.5-flash": { name: "Gemini", avatar: " G " },
    "openai/gpt-4o-mini": { name: "GPT-4o mini", avatar: " O " },
    "anthropic/claude-3.5-sonnet": { name: "Claude", avatar: " A " },
    "meta-llama/llama-3-8b-instruct": { name: "Llama", avatar: " L " },
    "deepseek/deepseek-chat": { name: "DeepSeek Chat", avatar: " D " },
    "qwen/qwen-2.5-7b-instruct": { name: "Qwen", avatar: " Q " },
    "moonshotai/kimi-k2": { name: "Kimi K2", avatar: " K " }
};

// --- Load prompt templates ---
const PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
function loadTemplate(filename) {
    try {
        return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf8');
    } catch (e) {
        return '';
    }
}
const BASE_SYSTEM_TPL = loadTemplate('base-system.md');
const UNIQUENESS_TPL = loadTemplate('uniqueness.md');
const THREAD_CONTEXT_TPL = loadTemplate('thread-context.md');
const DIRECT_CONVERSATION_TPL = loadTemplate('direct-conversation.md');
function renderTemplate(template, vars) {
    let text = template || '';
    for (const [k, v] of Object.entries(vars || {})) {
        text = text.split(`{{${k}}}`).join(String(v));
    }
    return text;
}

// Get user's custom prompt or fall back to default template
async function getUserPromptOrDefault(userId, promptType) {
    try {
        // Try to get user's active prompt for this type
        const userPrompts = await database.getUserPrompts(userId, promptType);
        const activePrompt = userPrompts.find(p => p.is_active && p.is_default);

        if (activePrompt) {
            return activePrompt.content;
        }

        // Fall back to system default prompts
        const systemPrompts = await database.getUserPrompts('00000000-0000-0000-0000-000000000001', promptType);
        const systemDefault = systemPrompts.find(p => p.is_active && p.is_default);

        if (systemDefault) {
            return systemDefault.content;
        }

        // Final fallback to hardcoded templates
        switch (promptType) {
            case 'base-system':
                return BASE_SYSTEM_TPL;
            case 'uniqueness':
                return UNIQUENESS_TPL;
            case 'thread-context':
                return THREAD_CONTEXT_TPL;
            case 'direct-conversation':
                return DIRECT_CONVERSATION_TPL;
            default:
                return '';
        }
    } catch (error) {
        console.error(`Error getting prompt for type ${promptType}:`, error);
        // Return hardcoded template as fallback
        switch (promptType) {
            case 'base-system':
                return BASE_SYSTEM_TPL;
            case 'uniqueness':
                return UNIQUENESS_TPL;
            case 'thread-context':
                return THREAD_CONTEXT_TPL;
            case 'direct-conversation':
                return DIRECT_CONVERSATION_TPL;
            default:
                return '';
        }
    }
}

/**
 * Health check endpoint - now includes database health
 */
app.get('/health', async (req, res) => {
    const hasApiKey = Boolean(OPENROUTER_API_KEY);
    const dbHealth = await database.healthCheck();

    // Test conversations table directly
    let conversationCount = 0;
    try {
        const conversations = await database.getConversations();
        conversationCount = conversations.length;
    } catch (e) {
        console.error('Error testing conversations:', e);
    }

    res.json({
        ok: hasApiKey && dbHealth,
        models: ALL_MODELS,
        env: { hasApiKey, dbConnected: dbHealth },
        version: '2.0.0',
        debug: { conversationCount }
    });
});

/**
 * Debug endpoint to test database tables
 */
app.get('/debug/tables', async (req, res) => {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    try {
        // Test each table individually
        const results = {};

        // Test conversations table
        try {
            const { data: conversations, error: convError } = await supabase
                .from('conversations')
                .select('*')
                .limit(5);

            results.conversations = {
                success: !convError,
                error: convError?.message,
                count: conversations?.length || 0,
                sample: conversations?.slice(0, 2) || []
            };
        } catch (e) {
            results.conversations = { success: false, error: e.message };
        }

        // Test messages table
        try {
            const { data: messages, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .limit(5);

            results.messages = {
                success: !msgError,
                error: msgError?.message,
                count: messages?.length || 0,
                sample: messages?.slice(0, 2) || []
            };
        } catch (e) {
            results.messages = { success: false, error: e.message };
        }

        // Test ai_models table
        try {
            const { data: models, error: modelError } = await supabase
                .from('ai_models')
                .select('*')
                .limit(5);

            results.ai_models = {
                success: !modelError,
                error: modelError?.message,
                count: models?.length || 0,
                sample: models?.slice(0, 2) || []
            };
        } catch (e) {
            results.ai_models = { success: false, error: e.message };
        }

        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get conversation messages
 */
app.get('/api/messages', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id;

        let messages;
        if (userId) {
            messages = await database.getAllMessagesForUser(userId);
            console.log(`Found ${messages.length} messages for user ${userId}`);
        } else {
            messages = await database.getMessages();
            console.log(`Loaded ${messages.length} messages from default conversation`);
        }

        // Transform messages to match frontend format
        const transformedMessages = messages.map(msg => {
            const baseMsg = {
                id: msg.id, // Include the database ID!
                sender: msg.sender_type,
                text: msg.content,
                time: new Date(msg.created_at)
            };

            if (msg.sender_type === 'ai' && msg.ai_models) {
                baseMsg.model = msg.ai_models.name;
                baseMsg.avatar = msg.ai_models.avatar;
            }

            return baseMsg;
        });
        
        res.json(transformedMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * Get all conversations for the user
 */
app.get('/api/conversations', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || FALLBACK_USER_ID;
        const conversations = await database.getConversations(userId);
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * Create a new conversation
 */
app.post('/api/conversations', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.id || FALLBACK_USER_ID;
        console.log('Creating conversation for user', userId);
        const conversation = await database.createConversationForUser(userId, 'New Chat', req.authToken);
        res.json(conversation);
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

app.delete('/api/conversations/:conversationId', authenticateUser, async (req, res) => {
    const { conversationId } = req.params;
    const scope = req.query.scope === 'all' ? 'all' : 'me';
    const userId = req.user?.id || FALLBACK_USER_ID;

    try {
        if (scope === 'all') {
            await database.deleteConversation(conversationId, userId);
        } else {
            await database.softDeleteConversation(conversationId, userId);
        }

        res.json({ success: true, scope });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        if (error?.status === 403) {
            return res.status(403).json({ error: error.message || 'Not allowed to delete this conversation' });
        }
        if (error?.status === 404) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});


/**
 * Get messages for a specific conversation
 */
app.get('/api/conversations/:conversationId/messages', optionalAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.id || null;
        const messages = await database.getMessages(conversationId, userId);

        // Transform messages to match frontend format
        const transformedMessages = messages.map(msg => {
            const baseMsg = {
                id: msg.id, // Include the database ID!
                sender: msg.sender_type,
                text: msg.content,
                time: new Date(msg.created_at),
                metadata: msg.metadata // Include metadata for frontend processing
            };

            if (msg.sender_type === 'ai' && msg.ai_models) {
                baseMsg.model = msg.ai_models.name;
                baseMsg.avatar = msg.ai_models.avatar;
            }


            return baseMsg;
        });
        
        res.json(transformedMessages);
    } catch (error) {
        console.error('Error fetching conversation messages:', error);
        if (error?.status === 403) {
            return res.status(403).json({ error: 'Conversation not found' });
        }
        res.status(500).json({ error: 'Failed to fetch conversation messages' });
    }
});

/**
 * Generate conversation title based on messages
 */
app.post('/api/generate-title', async (req, res) => {
    const { conversationId } = req.body;
    
    try {
        if (!conversationId) {
            return res.json({ title: 'New Chat' });
        }

        const messages = await database.getMessages(conversationId);
        
        // Get the first few user messages to generate a title
        const userMessages = messages
            .filter(msg => msg.sender_type === 'user')
            .slice(0, 3)
            .map(msg => msg.content)
            .join(' ');
        
        if (!userMessages.trim()) {
            return res.json({ title: 'New Chat' });
        }
        
        // Use Gemini 2.0 Flash to generate a concise summary title
        const titlePrompt = `Create a brief, descriptive 2-4 word summary title for this conversation topic: "${userMessages}". 

Examples:
- "What is machine learning?" → "Machine Learning Basics"
- "Best restaurants in Paris" → "Paris Restaurants"
- "How to cook pasta?" → "Pasta Cooking Tips"

Return ONLY the title, no quotes or extra text.`;
        
        const title = await callOpenRouter('google/gemini-2.5-flash', titlePrompt, [], 60, 'You are a helpful assistant that creates concise conversation titles.');
        
        // Clean up the title (remove quotes, limit length, capitalize properly)
        let cleanTitle = title.replace(/['"]/g, '').trim().substring(0, 35);
        
        // Capitalize first letter of each word
        cleanTitle = cleanTitle.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        
        // Update the conversation title in database
        if (conversationId && cleanTitle !== 'New Chat') {
            await database.updateConversationTitle(conversationId, cleanTitle);
        }
        
        res.json({ title: cleanTitle || 'New Chat' });
    } catch (error) {
        console.error('Error generating title:', error);
        res.json({ title: 'New Chat' });
    }
});

/**
 * Enhanced chat endpoint with conversation modes and reply support
 */
app.post('/api/chat', optionalAuth, async (req, res) => {
    const { prompt, firstResponder, conversationId, replyToMessageId, characterLimit, selectedModels } = req.body;
    let conversationMode = req.body.conversationMode || 'group';

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    const userId = req.user?.id || FALLBACK_USER_ID;

    // Determine which models to use based on new selectedModels parameter
    let modelsToUse = [];
    if (conversationMode === 'group') {
        if (selectedModels && Array.isArray(selectedModels) && selectedModels.length > 0) {
            // Use the custom selected models in the specified order
            modelsToUse = selectedModels.filter(model => ALL_MODELS.includes(model));
            if (modelsToUse.length === 0) {
                return res.status(400).json({ error: 'No valid models in selectedModels.' });
            }
        } else if (firstResponder) {
            // Fall back to legacy firstResponder + all other models
            if (!ALL_MODELS.includes(firstResponder)) {
                return res.status(400).json({ error: 'Invalid firstResponder model.' });
            }
            modelsToUse = [firstResponder, ...ALL_MODELS.filter(m => m !== firstResponder)];
        } else {
            return res.status(400).json({ error: 'Either selectedModels or firstResponder is required for group mode.' });
        }
    }

    if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: missing OPENROUTER_API_KEY' });
    }

    // Set up Server-Sent Events for streaming responses
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
    });

    try {
        // Get the conversation ID, or use the first available conversation if none provided
        let targetConversationId = conversationId;
        if (!targetConversationId) {
            const conversations = await database.getConversations(userId);
            if (conversations.length > 0) {
                targetConversationId = conversations[0].id;
            } else {
                // If no conversations exist, create a new one
                const newConv = await database.createConversationForUser(userId, 'New Chat', req.authToken);
                targetConversationId = newConv.id;
            }
        }
        const maxChars = characterLimit || 280;

        // Get conversation details and context
        const conversationDetails = await database.getConversationDetails(targetConversationId, userId);
        if (!conversationDetails) {
            throw new Error('Conversation not found');
        }
        const conversationContext = await database.getConversationContext(targetConversationId, 10, userId);

        // Save user message to database
        console.log('Creating user message with:', {
            userId,
            conversationId: targetConversationId,
            replyToMessageId,
            conversationMode
        });

        const userMessage = await database.createUserMessage(prompt, targetConversationId, replyToMessageId, conversationMode, userId);

        // For AI replies: target the user's new message, not the original replyToMessageId
        const aiReplyTargetId = userMessage.id;

        if (conversationMode === 'direct' && replyToMessageId) {
            // Handle direct conversation mode (1-on-1)
            try {
                const replyMessage = await database.getMessageById(replyToMessageId);
                if (!replyMessage || !replyMessage.ai_model_id) {
                    conversationMode = 'group';
                }
                
                if (conversationMode === 'direct' && replyMessage) {
                    const targetModel = replyMessage.ai_model_id;
                    const modelDetails = MODEL_DETAILS[targetModel] || { name: targetModel, avatar: '?' };

                    // Update conversation to direct mode (non-critical if it fails)
                    try {
                        await database.updateConversationMode(targetConversationId, 'direct', targetModel);
                    } catch (e) {
                    }

                    // Send typing indicator
                    res.write(`data: ${JSON.stringify({ 
                        type: 'typing', 
                        model: modelDetails.name,
                        avatar: modelDetails.avatar
                    })}\n\n`);

                    // Format conversation history for direct mode - only include messages from user and this specific model
                    const directConversationHistory = conversationContext
                        .filter(msg => msg.sender_type === 'user' || msg.ai_model_id === targetModel)
                        .map(msg => {
                            const sender = msg.sender_type === 'user' ? 'User' : 
                                         msg.sender_type === 'ai' ? (msg.ai_models?.name || targetModel) : 'System';
                            return `${sender}: "${msg.content}"`;
                        }).join('\n');

                    // Use direct conversation prompt
                    const systemPrompt = renderTemplate(DIRECT_CONVERSATION_TPL, {
                        MAX_CHARS: maxChars,
                        USER_PROMPT: prompt,
                        CONVERSATION_HISTORY: directConversationHistory
                    });

                    const response = await callOpenRouter(targetModel, prompt, [], maxChars, systemPrompt);
                    await database.createAIMessage(response, targetModel, false, targetConversationId, aiReplyTargetId, 'direct', userId);
                    
                    res.write(`data: ${JSON.stringify({ 
                        type: 'message',
                        model: modelDetails.name, 
                        avatar: modelDetails.avatar, 
                        text: response,
                        isDirectReply: true
                    })}\n\n`);
                    
                    // Send completion signal and end for direct replies
                    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
                    res.end();
                    return;
                }
            } catch (e) {
                conversationMode = 'group';
            }
        }
        
        // Handle group conversation mode (fallback or initial)  
        {
            // Handle group conversation mode
            const chatHistory = [];
            const isOngoingThread = conversationContext.length > 1; // Has previous messages
            
            // Update conversation mode and thread stage
            const threadStage = isOngoingThread ? 'ongoing' : 'initial';
            await database.updateConversationMode(targetConversationId, 'group', null, threadStage);

            // Format conversation history for context
            const conversationHistory = conversationContext.map(msg => {
                const sender = msg.sender_type === 'user' ? 'User' : 
                             msg.sender_type === 'ai' ? (msg.ai_models?.name || 'AI') : 'System';
                return `${sender}: "${msg.content}"`;
            }).join('\n');

            // Choose system prompt based on thread stage
            const promptType = isOngoingThread ? 'thread-context' : 'base-system';
            const systemPromptTemplate = await getUserPromptOrDefault(userId, promptType);
            const systemPrompt = renderTemplate(systemPromptTemplate, {
                MAX_CHARS: maxChars,
                USER_PROMPT: prompt,
                CONVERSATION_HISTORY: conversationHistory
            });

            // Process models in the specified order
            const firstModel = modelsToUse[0];
            const firstModelDetails = MODEL_DETAILS[firstModel] || { name: firstModel, avatar: '?' };

            // Send typing indicator for first model
            res.write(`data: ${JSON.stringify({
                type: 'typing',
                model: firstModelDetails.name,
                avatar: firstModelDetails.avatar
            })}\n\n`);

            // First model response
            const firstResponderResponse = await callOpenRouter(firstModel, prompt, [], maxChars, systemPrompt);
            await database.createAIMessage(firstResponderResponse, firstModel, true, targetConversationId, aiReplyTargetId, 'group', userId);
            
            res.write(`data: ${JSON.stringify({
                type: 'message',
                model: firstModelDetails.name,
                avatar: firstModelDetails.avatar,
                text: firstResponderResponse
            })}\n\n`);

            chatHistory.push({ role: 'assistant', content: firstResponderResponse });

            // Remaining models: sequential responses with enhanced context
            const remainingModels = modelsToUse.slice(1);
            for (const model of remainingModels) {
                const modelDetails = MODEL_DETAILS[model] || { name: model, avatar: '?' };
                
                // Send typing indicator
                res.write(`data: ${JSON.stringify({ 
                    type: 'typing', 
                    model: modelDetails.name,
                    avatar: modelDetails.avatar
                })}\n\n`);

                // Create enhanced uniqueness prompt with conversation context
                const prior = chatHistory.map(msg => `- "${msg.content}"`).join('\n');
                const uniquenessPromptType = isOngoingThread ? 'thread-context' : 'uniqueness';
                const uniquenessPromptTemplate = await getUserPromptOrDefault(userId, uniquenessPromptType);

                const uniquenessPrompt = renderTemplate(uniquenessPromptTemplate, {
                    MAX_CHARS: maxChars,
                    USER_PROMPT: prompt,
                    PRIOR_ANSWERS: prior,
                    CONVERSATION_HISTORY: conversationHistory
                });

                const newResponse = await callOpenRouter(model, uniquenessPrompt, chatHistory, maxChars, systemPrompt);
                await database.createAIMessage(newResponse, model, false, targetConversationId, aiReplyTargetId, 'group', userId);
                
                res.write(`data: ${JSON.stringify({ 
                    type: 'message',
                    model: modelDetails.name, 
                    avatar: modelDetails.avatar, 
                    text: newResponse 
                })}\n\n`);

                chatHistory.push({ role: 'assistant', content: newResponse });
            }
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();

    } catch (error) {
        const accessDenied = error?.status === 403;
        console.error('Error processing chat:', error.response ? error.response.data : error.message);

        res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: accessDenied ? 'You do not have access to this conversation.' : error.message 
        })}\n\n`);
        res.end();
    }
});

/**
 * Helper function to call the OpenRouter API
 * @param {string} model - The model to call (e.g., "google/gemini-pro")
 * @param {string} prompt - The user prompt or the constructed uniqueness prompt
 * @param {Array} history - The conversation history for context
 * @param {number} maxLength - The maximum number of characters for the response
 * @param {string} systemPrompt - Optional system message to prepend
 * @returns {Promise<string>} - The text response from the model
 */
async function callOpenRouter(model, prompt, history = [], maxLength = 280, systemPrompt = '') {
    try {
        const messages = [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...history,
            { role: 'user', content: prompt }
        ];

        const headers = {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_REFERER || 'http://localhost:5173',
            'X-Title': process.env.APP_TITLE || 'AI Group Chat',
        };

        if (process.env.DEBUG_OPENROUTER === '1') {
            const redactedLen = OPENROUTER_API_KEY ? OPENROUTER_API_KEY.length : 0;
            const debugHeaders = { ...headers };
            delete debugHeaders.Authorization;
            console.log('[OpenRouter] debug: keyLen=', redactedLen, 'headers=', debugHeaders);
        }

        const response = await axios.post(API_URL, {
            model: model,
            messages,
            max_tokens: Math.ceil(maxLength / 4), // Rough estimation: 1 token ~ 4 chars
        }, { headers });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        if (error.response) {
            console.error(`Error calling model ${model}: status=${error.response.status}`, error.response.data);
        } else {
            console.error(`Error calling model ${model}:`, error.message);
        }
        // Return a graceful error message instead of throwing
        return `Error: Could not get a response from ${model}.`;
    }
}

// ===== USER PROMPTS API ENDPOINTS =====

// Get user prompts (optionally filtered by type)
app.get('/api/prompts', requireAuth, async (req, res) => {
    try {
        const { type } = req.query;
        const prompts = await database.getUserPrompts(req.user.id, type);
        res.json(prompts);
    } catch (error) {
        console.error('Error fetching user prompts:', error);
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});

// Create a new user prompt
app.post('/api/prompts', requireAuth, async (req, res) => {
    try {
        const { prompt_type, title, content, is_default } = req.body;

        if (!prompt_type || !title || !content) {
            return res.status(400).json({ error: 'prompt_type, title, and content are required' });
        }

        const validTypes = ['base-system', 'uniqueness', 'thread-context', 'direct-conversation'];
        if (!validTypes.includes(prompt_type)) {
            return res.status(400).json({ error: 'Invalid prompt_type' });
        }

        const prompt = await database.createUserPrompt(req.user.id, prompt_type, title, content, is_default);
        res.status(201).json(prompt);
    } catch (error) {
        console.error('Error creating user prompt:', error);
        res.status(500).json({ error: 'Failed to create prompt' });
    }
});

// Update a user prompt
app.put('/api/prompts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const prompt = await database.updateUserPrompt(req.user.id, id, updates);
        res.json(prompt);
    } catch (error) {
        console.error('Error updating user prompt:', error);
        res.status(500).json({ error: 'Failed to update prompt' });
    }
});

// Delete a user prompt
app.delete('/api/prompts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await database.deleteUserPrompt(req.user.id, id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user prompt:', error);
        res.status(500).json({ error: 'Failed to delete prompt' });
    }
});

// Profile picture upload endpoint
app.post('/api/profile/avatar', optionalAuth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const userId = req.user?.id || FALLBACK_USER_ID;

        if (!supabase || !supabaseServiceKey || !supabaseUrl) {
            return res.status(500).json({ error: 'Supabase storage is not configured on the server' });
        }

        const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';

        const fileName = `${userId}_${uuidv4()}.jpg`;

        const processedBuffer = await sharp(req.file.buffer)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toBuffer();

        const uploadPath = `profiles/${userId}/${fileName}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from(bucket)
            .upload(uploadPath, processedBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (storageError) {
            console.error('Error uploading avatar to Supabase storage:', storageError);
            return res.status(500).json({ error: 'Failed to upload profile picture' });
        }

        let publicUrl = null;
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storageData.path);
        publicUrl = urlData?.publicUrl || null;

        if (!publicUrl) {
            const origin = supabaseUrl.replace(/\/auth.*$/, '').replace(/\/$/, '');
            publicUrl = `${origin}/storage/v1/object/public/${bucket}/${storageData.path}`;
        }

        await database.updateUserAvatar(userId, publicUrl);

        res.json({
            success: true,
            avatarUrl: publicUrl,
            message: 'Profile picture updated successfully'
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

// Get user profile information
app.get('/api/profile', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || FALLBACK_USER_ID;
        const profile = await database.getUserProfile(userId);
        res.json(profile);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user display name
app.put('/api/profile/display-name', optionalAuth, async (req, res) => {
    try {
        const { displayName } = req.body;
        const userId = req.user?.id || FALLBACK_USER_ID;

        if (!displayName || typeof displayName !== 'string') {
            return res.status(400).json({ error: 'Display name is required and must be a string' });
        }

        if (displayName.length > 100) {
            return res.status(400).json({ error: 'Display name must be less than 100 characters' });
        }

        const updatedProfile = await database.updateUserDisplayName(userId, displayName.trim());
        res.json({
            success: true,
            displayName: updatedProfile.display_name,
            message: 'Display name updated successfully'
        });
    } catch (error) {
        console.error('Error updating display name:', error);
        res.status(500).json({ error: 'Failed to update display name' });
    }
});

// Conversation image upload endpoint
app.post('/api/conversations/:conversationId/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const { conversationId } = req.params;
        const fileName = `${conversationId}_${uuidv4()}.jpg`;
        const filePath = path.join(__dirname, 'uploads', 'conversations', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Process and save image using sharp
        await sharp(req.file.buffer)
            .resize(150, 150, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toFile(filePath);

        // Update conversation avatar in settings
        const avatarUrl = `/uploads/conversations/${fileName}`;
        await database.updateConversationAvatar(conversationId, avatarUrl);

        res.json({
            success: true,
            avatarUrl: avatarUrl,
            message: 'Conversation image updated successfully'
        });

    } catch (error) {
        console.error('Error uploading conversation image:', error);
        res.status(500).json({ error: 'Failed to upload conversation image' });
    }
});

// AI-generated conversation image endpoint
app.post('/api/conversations/:conversationId/generate-avatar', requireAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Get conversation summary
        const messages = await database.getConversationMessages(conversationId);
        if (!messages.length) {
            return res.status(400).json({ error: 'No messages found to generate image from' });
        }

        // Create a summary prompt for image generation
        const recentMessages = messages.slice(-10); // Last 10 messages
        const messageText = recentMessages
            .filter(msg => msg.sender_type === 'user' || msg.sender_type === 'ai')
            .map(msg => msg.content)
            .join(' ')
            .slice(0, 500); // Limit to 500 chars

        // Generate a concise visual prompt
        const imagePrompt = await generateImagePrompt(messageText);

        // For now, we'll create a placeholder image with the prompt text
        // In a production environment, you would integrate with DALL-E, Midjourney, or Stable Diffusion
        const fileName = `${conversationId}_generated_${uuidv4()}.jpg`;
        const filePath = path.join(__dirname, 'uploads', 'conversations', fileName);

        // Create a placeholder image with conversation theme
        await createPlaceholderImage(imagePrompt, filePath);

        const avatarUrl = `/uploads/conversations/${fileName}`;
        await database.updateConversationAvatar(conversationId, avatarUrl);

        res.json({
            success: true,
            avatarUrl: avatarUrl,
            prompt: imagePrompt,
            message: 'AI-generated conversation image created successfully'
        });

    } catch (error) {
        console.error('Error generating conversation image:', error);
        res.status(500).json({ error: 'Failed to generate conversation image' });
    }
});

// Helper function to generate image prompt from conversation
async function generateImagePrompt(conversationText) {
    try {
        const prompt = `Based on this conversation snippet: "${conversationText}", create a short, visual description (max 50 words) for an abstract, colorful image that represents the conversation theme. Focus on mood, colors, and simple visual elements.`;

        // Use OpenRouter API to generate the image prompt
        const response = await axios.post(API_URL, {
            model: "openai/gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that creates concise visual descriptions for image generation. Keep descriptions under 50 words and focus on abstract, colorful, artistic elements."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 100,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:7001',
                'X-Title': 'AI Group Chat'
            }
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error generating image prompt:', error);
        return "Colorful abstract conversation bubbles floating in space";
    }
}

// Helper function to create placeholder image
async function createPlaceholderImage(prompt, filePath) {
    // Create a colorful gradient placeholder image with the prompt overlay
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Create a simple colored circle as placeholder
    const svg = `
        <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${randomColor};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${randomColor}80;stop-opacity:1" />
                </linearGradient>
            </defs>
            <circle cx="75" cy="75" r="70" fill="url(#grad1)" />
            <text x="75" y="80" font-family="Arial, sans-serif" font-size="12" fill="white" text-anchor="middle">AI</text>
        </svg>
    `;

    await sharp(Buffer.from(svg))
        .jpeg({ quality: 85 })
        .toFile(filePath);
}

const PORT = process.env.PORT || 7001;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Test database connection on startup
    const dbHealth = await database.healthCheck();
    if (dbHealth) {
        console.log('✅ Database connection successful');
    } else {
        console.log('❌ Database connection failed - check your Supabase credentials');
    }
});
