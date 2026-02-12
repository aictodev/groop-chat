const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const multer = require('multer');
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('Failed to load sharp:', e);
}
const { randomUUID } = require('crypto');
let database;
let authenticateUser;
let optionalAuth;

try {
    database = require('../database');
} catch (e) {
    console.error('Failed to load database module:', e);
    database = {
        healthCheck: async () => false,
        getConversations: async () => [],
        getUserPrompts: async () => []
    };
}

try {
    const authModule = require('../auth');
    authenticateUser = authModule.authenticateUser;
    optionalAuth = authModule.optionalAuth;
} catch (e) {
    console.error('Failed to load auth module:', e);
    authenticateUser = (req, res, next) => next();
    optionalAuth = (req, res, next) => next();
}

// const { handleCouncilRequest } = require('../controllers/council');

// Global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    // Keep running if possible
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Alias for consistency
const requireAuth = authenticateUser;

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for frontend communication

// Root route for health check/verification
app.get('/', (req, res) => {
    res.send('Backend is running!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 4.5 * 1024 * 1024, // 4.5MB limit for Vercel
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
let supabase = null;
try {
    if (supabaseUrl && supabaseServiceKey) {
        supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
} catch (e) {
    console.error('Failed to initialize Supabase client:', e);
}

// Define the models participating in the chat
const ALL_MODELS = [
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3-8b-instruct",
    "deepseek/deepseek-v3.2-speciale",
    "qwen/qwen3-max-thinking",
    "moonshotai/kimi-k2.5",
    "x-ai/grok-4.1-fast"
];

// A simple mapping for model names and avatars for the frontend
const MODEL_DETAILS = {
    "google/gemini-2.5-flash": { name: "Gemini", avatar: " G " },
    "openai/gpt-4o-mini": { name: "GPT-4o mini", avatar: " O " },
    "anthropic/claude-3.5-sonnet": { name: "Claude", avatar: " A " },
    "meta-llama/llama-3-8b-instruct": { name: "Llama", avatar: " L " },
    "deepseek/deepseek-v3.2-speciale": { name: "DeepSeek V3.2", avatar: " D " },
    "qwen/qwen3-max-thinking": { name: "Qwen3 Max", avatar: " Q " },
    "moonshotai/kimi-k2.5": { name: "Kimi K2.5", avatar: " K " },
    "x-ai/grok-4.1-fast": { name: "Grok 4.1 Fast", avatar: " X " }
};

let modelsSeeded = false;
async function ensureRuntimeModels() {
    if (modelsSeeded) {
        return;
    }
    try {
        if (database && database.ensureAiModels) {
            await database.ensureAiModels();
        }
        modelsSeeded = true;
    } catch (error) {
        console.warn('Unable to seed AI models before request:', error?.message || error);
    }
}

// --- Load prompt templates ---
const PROMPTS_DIR = path.join(__dirname, '../prompts');
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
app.get('/', async (req, res) => {
    const hasApiKey = Boolean(OPENROUTER_API_KEY);
    let dbHealth = false;
    let dbError = null;

    try {
        if (database && database.healthCheck) {
            dbHealth = await database.healthCheck();
        }
    } catch (e) {
        dbError = e.message;
    }

    // Test conversations table directly
    let conversationCount = 0;
    let conversationError = null;
    try {
        if (database && database.getConversations) {
            const conversations = await database.getConversations();
            conversationCount = conversations ? conversations.length : 0;
        }
    } catch (e) {
        console.error('Error testing conversations:', e);
        conversationError = e.message;
    }

    res.json({
        status: 'Backend is running',
        ok: hasApiKey && dbHealth,
        models: ALL_MODELS,
        env: {
            hasApiKey,
            dbConnected: dbHealth,
            supabaseUrlConfigured: Boolean(supabaseUrl),
            supabaseKeyConfigured: Boolean(supabaseServiceKey)
        },
        diagnostics: {
            dbError,
            conversationError,
            promptsDir: PROMPTS_DIR,
            promptsLoaded: {
                baseSystem: Boolean(BASE_SYSTEM_TPL),
                uniqueness: Boolean(UNIQUENESS_TPL)
            }
        },
        version: '2.1.0'
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

app.patch('/api/conversations/:conversationId/title', authenticateUser, async (req, res) => {
    try {
        const { conversationId } = req.params;
        let { title } = req.body || {};
        const userId = req.user?.id || FALLBACK_USER_ID;

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Title is required' });
        }

        title = title.trim().slice(0, 80);
        if (!title) {
            return res.status(400).json({ error: 'Title cannot be empty' });
        }

        await database.assertConversationAccess(conversationId, userId);
        await database.updateConversationTitle(conversationId, title);
        res.json({ success: true, title });
    } catch (error) {
        console.error('Error renaming conversation:', error);
        if (error?.status === 403) {
            return res.status(403).json({ error: 'You do not have access to this conversation' });
        }
        res.status(500).json({ error: 'Failed to rename conversation' });
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
 * LLM Council Endpoint
 */
// --- LLM Council Logic (Inlined for Vercel Compatibility) ---

const normalizeContentText = (content) => {
    if (typeof content === 'string') {
        const trimmed = content.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(content)) {
        const text = content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (!part || typeof part !== 'object') return '';
                if (typeof part.text === 'string') return part.text;
                if (part.text && typeof part.text === 'object' && typeof part.text.value === 'string') {
                    return part.text.value;
                }
                if (part.type === 'text' && typeof part.value === 'string') return part.value;
                return '';
            })
            .join('')
            .trim();
        return text.length > 0 ? text : null;
    }

    if (content && typeof content === 'object') {
        if (typeof content.text === 'string') {
            const trimmed = content.text.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
        if (content.text && typeof content.text.value === 'string') {
            const trimmed = content.text.value.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
    }

    return null;
};

const extractOpenRouterText = (responseData) => {
    const choice = responseData?.choices?.[0];
    if (!choice) return null;

    const content = choice?.message?.content ?? choice?.text ?? null;
    return normalizeContentText(content);
};

// Helper: Call OpenRouter (Replicated for isolation)
async function callOpenRouterForCouncil(model, prompt, history = [], maxLength = 2000, systemPrompt = '') {
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

        const payload = {
            model: model,
            messages,
        };

        if (typeof maxLength === 'number' && Number.isFinite(maxLength) && maxLength > 0) {
            payload.max_tokens = Math.max(1, Math.ceil(maxLength / 4));
        }

        const response = await axios.post(API_URL, payload, { headers });
        const text = extractOpenRouterText(response.data);
        if (!text) {
            console.warn(`Model ${model} returned an empty council response`);
            return null;
        }
        return text;
    } catch (error) {
        console.error(`Error calling model ${model}:`, error.message);
        return null;
    }
}

// Stage 1: Collect individual responses
async function stage1_collect_responses(userQuery, models, history, res, conversationId, userId, userMessageId, councilSessionId) {
    res.write(`data: ${JSON.stringify({ type: 'stage1_start', models })}\n\n`);

    const promises = models.map(async (model) => {
        const response = await callOpenRouterForCouncil(model, userQuery, history, 2000);
        if (response) {
            res.write(`data: ${JSON.stringify({
                type: 'stage1_result',
                model,
                response
            })}\n\n`);
            try {
                await database.createAIMessage(
                    response,
                    model,
                    false,
                    conversationId,
                    userMessageId,
                    'council',
                    userId,
                    { stage: 1, council_session_id: councilSessionId, is_council_hidden: true }
                );
            } catch (err) {
                console.warn('Failed to persist Stage 1 council message:', err?.message || err);
            }
            return { model, response };
        }
        return null;
    });

    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
}

// Stage 2: Review and Rank
async function stage2_collect_rankings(userQuery, stage1Results, res, conversationId, userId, councilSessionId) {
    res.write(`data: ${JSON.stringify({ type: 'stage2_start' })}\n\n`);

    const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const labelToModel = {};
    stage1Results.forEach((result, i) => {
        labelToModel[`Response ${labels[i]}`] = result.model;
    });

    const responsesText = stage1Results.map((result, i) =>
        `Response ${labels[i]}:\n${result.response}`
    ).join('\n\n');

    const rankingPrompt = `You are evaluating different responses to the following question:

Question: ${userQuery}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:`;

    const participatingModels = stage1Results.map(r => r.model);

    const promises = participatingModels.map(async (model) => {
        const response = await callOpenRouterForCouncil(model, rankingPrompt, [], 2000);
        if (response) {
            res.write(`data: ${JSON.stringify({
                type: 'stage2_result',
                model,
                ranking: response
            })}\n\n`);
            try {
                await database.createAIMessage(
                    response,
                    model,
                    false,
                    conversationId,
                    null,
                    'council',
                    userId,
                    { stage: 2, council_session_id: councilSessionId, is_council_hidden: true }
                );
            } catch (err) {
                console.warn('Failed to persist Stage 2 council ranking:', err?.message || err);
            }
            return { model, ranking: response };
        }
        return null;
    });

    const results = await Promise.all(promises);
    return {
        rankings: results.filter(r => r !== null),
        labelToModel
    };
}

// Stage 3: Synthesize
async function stage3_synthesize_final(userQuery, stage1Results, stage2Results, res, conversationId, userId, userMessageId, chairmanModel, councilSessionId) {
    res.write(`data: ${JSON.stringify({ type: 'stage3_start' })}\n\n`);

    const stage1Text = stage1Results.map(r =>
        `Model: ${r.model}\nResponse: ${r.response}`
    ).join('\n\n');

    const stage2Text = stage2Results.map(r =>
        `Model: ${r.model}\nRanking: ${r.ranking}`
    ).join('\n\n');

    const CHAIRMAN_MODEL = chairmanModel || 'openai/gpt-4o-mini';
    const chairmanPrompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${userQuery}

STAGE 1 - Individual Responses:
${stage1Text}

STAGE 2 - Peer Rankings:
${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;

    const response = await callOpenRouterForCouncil(CHAIRMAN_MODEL, chairmanPrompt, [], 4000);

    if (response) {
        res.write(`data: ${JSON.stringify({
            type: 'stage3_result',
            model: CHAIRMAN_MODEL,
            chairmanModel: CHAIRMAN_MODEL,
            response
        })}\n\n`);
        try {
            await database.createAIMessage(
                response,
                CHAIRMAN_MODEL,
                false,
                conversationId,
                userMessageId,
                'council',
                userId,
                { stage: 3, council_session_id: councilSessionId, is_council_hidden: false }
            );
        } catch (err) {
            console.warn('Failed to persist Stage 3 council synthesis:', err?.message || err);
        }
    } else {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            message: 'Chairman failed to synthesize response.'
        })}\n\n`);
    }
}

// Main Council Handler
async function handleCouncilRequest(req, res) {
    console.log('[Council] Request received');
    const { prompt, selectedModels, conversationId } = req.body;
    const userId = req.user?.id || FALLBACK_USER_ID;
    const councilSessionId = randomUUID();

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!selectedModels || selectedModels.length < 2) {
        return res.status(400).json({ error: 'At least 2 models are required for a council.' });
    }

    await ensureRuntimeModels();

    const chairmanModel = Array.isArray(selectedModels) && selectedModels.length > 0
        ? selectedModels[0]
        : 'openai/gpt-4o-mini';

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    try {
        let targetConversationId = conversationId;
        if (!targetConversationId) {
            const newConv = await database.createConversationForUser(userId, 'New Chat', req.authToken);
            targetConversationId = newConv?.id;
        }

        let userMessageId = null;
        try {
            const userMsg = await database.createUserMessage(
                prompt,
                targetConversationId,
                null,
                'council',
                userId
            );
            userMessageId = userMsg?.id || null;
        } catch (err) {
            console.warn('Failed to persist council user message:', err?.message || err);
        }

        let history = [];
        if (targetConversationId) {
            try {
                const context = await database.getConversationContext(targetConversationId, 10, userId);
                history = context.map(msg => ({
                    role: msg.sender_type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }));
            } catch (err) {
                console.warn('Failed to fetch conversation context for council:', err);
            }
        }

        const stage1Results = await stage1_collect_responses(
            prompt,
            selectedModels,
            history,
            res,
            targetConversationId,
            userId,
            userMessageId,
            councilSessionId
        );

        if (stage1Results.length === 0) {
            throw new Error('All models failed to respond in Stage 1.');
        }

        const { rankings: stage2Results, labelToModel } = await stage2_collect_rankings(
            prompt,
            stage1Results,
            res,
            targetConversationId,
            userId,
            councilSessionId
        );

        await stage3_synthesize_final(
            prompt,
            stage1Results,
            stage2Results,
            res,
            targetConversationId,
            userId,
            userMessageId,
            chairmanModel,
            councilSessionId
        );

        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Council Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
}

/**
 * LLM Council Endpoint
 */
app.post('/api/council', optionalAuth, handleCouncilRequest);

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
    await ensureRuntimeModels();

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
        const parsedLimit = Number(characterLimit);
        const maxChars = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 280;

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
                        MAX_CHARS: 'Unlimited',
                        USER_PROMPT: prompt,
                        CONVERSATION_HISTORY: directConversationHistory
                    });

                    const response = await callOpenRouter(targetModel, prompt, [], null, systemPrompt);
                    if (response) {
                        try {
                            await database.createAIMessage(response, targetModel, false, targetConversationId, aiReplyTargetId, 'direct', userId);
                        } catch (persistError) {
                            console.warn('Failed to persist direct AI message:', persistError?.message || persistError);
                        }
                    }

                    res.write(`data: ${JSON.stringify({
                        type: 'message',
                        model: modelDetails.name,
                        avatar: modelDetails.avatar,
                        text: response || `No response from ${modelDetails.name}.`,
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
            if (firstResponderResponse) {
                try {
                    await database.createAIMessage(firstResponderResponse, firstModel, true, targetConversationId, aiReplyTargetId, 'group', userId);
                } catch (persistError) {
                    console.warn('Failed to persist first model response:', persistError?.message || persistError);
                }
            }

            res.write(`data: ${JSON.stringify({
                type: 'message',
                model: firstModelDetails.name,
                avatar: firstModelDetails.avatar,
                text: firstResponderResponse || `No response from ${firstModelDetails.name}.`
            })}\n\n`);

            if (firstResponderResponse) {
                chatHistory.push({ role: 'assistant', content: firstResponderResponse });
            }

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
                if (newResponse) {
                    try {
                        await database.createAIMessage(newResponse, model, false, targetConversationId, aiReplyTargetId, 'group', userId);
                    } catch (persistError) {
                        console.warn(`Failed to persist response for model ${model}:`, persistError?.message || persistError);
                    }
                }

                res.write(`data: ${JSON.stringify({
                    type: 'message',
                    model: modelDetails.name,
                    avatar: modelDetails.avatar,
                    text: newResponse || `No response from ${modelDetails.name}.`
                })}\n\n`);

                if (newResponse) {
                    chatHistory.push({ role: 'assistant', content: newResponse });
                }
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

        const payload = {
            model: model,
            messages,
        };

        if (typeof maxLength === 'number' && Number.isFinite(maxLength) && maxLength > 0) {
            payload.max_tokens = Math.max(1, Math.ceil(maxLength / 4)); // Rough estimation: 1 token ~ 4 chars
        }

        const response = await axios.post(API_URL, payload, { headers });
        const text = extractOpenRouterText(response.data);
        if (!text) {
            console.warn(`Model ${model} returned an empty response`);
            return null;
        }
        return text;
    } catch (error) {
        if (error.response) {
            console.error(`Error calling model ${model}: status=${error.response.status}`, error.response.data);
        } else {
            console.error(`Error calling model ${model}:`, error.message);
        }
        return null;
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

        const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'profile_pic';

        const fileName = `${userId}_${randomUUID()}.jpg`;

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
            return res.status(500).json({ error: `Storage error: ${storageError.message}` });
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
        res.status(500).json({ error: `Upload failed: ${error.message}` });
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
        const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'profile_pic'; // Reuse existing bucket or use a new one
        const fileName = `conversations/${conversationId}_${randomUUID()}.jpg`;

        // Process image using sharp
        const processedBuffer = await sharp(req.file.buffer)
            .resize(150, 150, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toBuffer();

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from(bucket)
            .upload(fileName, processedBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (storageError) {
            console.error('Error uploading conversation image to Supabase:', storageError);
            return res.status(500).json({ error: `Storage error: ${storageError.message}` });
        }

        // Get Public URL
        let publicUrl = null;
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storageData.path);
        publicUrl = urlData?.publicUrl || null;

        if (!publicUrl) {
            const origin = supabaseUrl.replace(/\/auth.*$/, '').replace(/\/$/, '');
            publicUrl = `${origin}/storage/v1/object/public/${bucket}/${storageData.path}`;
        }

        // Update conversation avatar in settings
        await database.updateConversationAvatar(conversationId, publicUrl);

        res.json({
            success: true,
            avatarUrl: publicUrl,
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

        // Generate placeholder image buffer
        const imageBuffer = await createPlaceholderImageBuffer(imagePrompt);

        const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'profile_pic';
        const fileName = `conversations/${conversationId}_generated_${randomUUID()}.jpg`;

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from(bucket)
            .upload(fileName, imageBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (storageError) {
            console.error('Error uploading generated avatar to Supabase:', storageError);
            return res.status(500).json({ error: `Storage error: ${storageError.message}` });
        }

        // Get Public URL
        let publicUrl = null;
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storageData.path);
        publicUrl = urlData?.publicUrl || null;

        if (!publicUrl) {
            const origin = supabaseUrl.replace(/\/auth.*$/, '').replace(/\/$/, '');
            publicUrl = `${origin}/storage/v1/object/public/${bucket}/${storageData.path}`;
        }

        await database.updateConversationAvatar(conversationId, publicUrl);

        res.json({
            success: true,
            avatarUrl: publicUrl,
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

// Helper function to create placeholder image buffer
async function createPlaceholderImageBuffer(prompt) {
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

    return await sharp(Buffer.from(svg))
        .jpeg({ quality: 85 })
        .toBuffer();
}

// Catch-all route for debugging 404s
app.use((req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

const PORT = process.env.PORT || 7001;

// Only listen if not running in Vercel (Vercel handles the server)
if (require.main === module) {
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
}

module.exports = app;
