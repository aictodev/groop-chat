require('dotenv').config({ path: '../.env' });
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const database = require('./database');

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for frontend communication

const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Define the models participating in the chat
const ALL_MODELS = [
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3-8b-instruct",
    "deepseek/deepseek-chat",
    "qwen/qwen-2.5-7b-instruct"
];

// A simple mapping for model names and avatars for the frontend
const MODEL_DETAILS = {
    "google/gemini-2.5-flash": { name: "Gemini", avatar: " G " },
    "openai/gpt-4o-mini": { name: "GPT-4o mini", avatar: " O " },
    "anthropic/claude-3.5-sonnet": { name: "Claude", avatar: " A " },
    "meta-llama/llama-3-8b-instruct": { name: "Llama", avatar: " L " },
    "deepseek/deepseek-chat": { name: "DeepSeek Chat", avatar: " D " },
    "qwen/qwen-2.5-7b-instruct": { name: "Qwen", avatar: " Q " }
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

/**
 * Health check endpoint - now includes database health
 */
app.get('/health', async (req, res) => {
    const hasApiKey = Boolean(OPENROUTER_API_KEY);
    const dbHealth = await database.healthCheck();
    res.json({ 
        ok: hasApiKey && dbHealth, 
        models: ALL_MODELS, 
        env: { hasApiKey, dbConnected: dbHealth }, 
        version: '2.0.0' 
    });
});

/**
 * Get conversation messages
 */
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await database.getMessages();
        console.log('Raw messages from DB:', messages.slice(0, 2)); // Debug first 2 messages
        
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
app.get('/api/conversations', async (req, res) => {
    try {
        const conversations = await database.getConversations();
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * Create a new conversation
 */
app.post('/api/conversations', async (req, res) => {
    try {
        const conversation = await database.createConversation();
        res.json(conversation);
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

/**
 * Get messages for a specific conversation
 */
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const messages = await database.getMessages(conversationId);
        
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
        console.error('Error fetching conversation messages:', error);
        res.status(500).json({ error: 'Failed to fetch conversation messages' });
    }
});

/**
 * Generate conversation title based on messages
 */
app.post('/api/generate-title', async (req, res) => {
    const { conversationId } = req.body;
    
    try {
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
app.post('/api/chat', async (req, res) => {
    const { prompt, firstResponder, conversationId, replyToMessageId } = req.body;
    let conversationMode = req.body.conversationMode || 'group';

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    if (conversationMode === 'group' && !firstResponder) {
        return res.status(400).json({ error: 'FirstResponder is required for group mode.' });
    }

    if (conversationMode === 'group' && !ALL_MODELS.includes(firstResponder)) {
        return res.status(400).json({ error: 'Invalid firstResponder model.' });
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
        const targetConversationId = conversationId || '00000000-0000-0000-0000-000000000002';
        const maxChars = 280;

        // Get conversation details and context
        const conversationDetails = await database.getConversationDetails(targetConversationId);
        const conversationContext = await database.getConversationContext(targetConversationId, 10);
        
        // Save user message to database
        await database.createUserMessage(prompt, targetConversationId, replyToMessageId, conversationMode);

        if (conversationMode === 'direct' && replyToMessageId) {
            // Handle direct conversation mode (1-on-1)
            try {
                const replyMessage = await database.getMessageById(replyToMessageId);
                if (!replyMessage || !replyMessage.ai_model_id) {
                    console.log('Could not find reply message, falling back to group mode');
                    conversationMode = 'group';
                }
                
                if (conversationMode === 'direct' && replyMessage) {
                    const targetModel = replyMessage.ai_model_id;
                    const modelDetails = MODEL_DETAILS[targetModel] || { name: targetModel, avatar: '?' };

                    // Update conversation to direct mode (non-critical if it fails)
                    try {
                        await database.updateConversationMode(targetConversationId, 'direct', targetModel);
                    } catch (e) {
                        console.log('Could not update conversation mode, continuing with direct reply');
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
                        ORIGINAL_MESSAGE: replyMessage.content,
                        CONVERSATION_HISTORY: directConversationHistory
                    });

                    const response = await callOpenRouter(targetModel, prompt, [], maxChars, systemPrompt);
                    await database.createAIMessage(response, targetModel, false, targetConversationId, replyToMessageId, 'direct');
                    
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
                console.log('Error in direct conversation mode, falling back to group:', e.message);
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
            const systemPromptTemplate = isOngoingThread ? THREAD_CONTEXT_TPL : BASE_SYSTEM_TPL;
            const systemPrompt = renderTemplate(systemPromptTemplate, {
                MAX_CHARS: maxChars,
                USER_PROMPT: prompt,
                CONVERSATION_HISTORY: conversationHistory
            });

            // Send typing indicator for first responder
            const firstResponderDetails = MODEL_DETAILS[firstResponder] || { name: firstResponder, avatar: '?' };
            res.write(`data: ${JSON.stringify({ 
                type: 'typing', 
                model: firstResponderDetails.name,
                avatar: firstResponderDetails.avatar
            })}\n\n`);

            // First responder
            const firstResponderResponse = await callOpenRouter(firstResponder, prompt, [], maxChars, systemPrompt);
            await database.createAIMessage(firstResponderResponse, firstResponder, true, targetConversationId, replyToMessageId, 'group');
            
            res.write(`data: ${JSON.stringify({ 
                type: 'message',
                model: firstResponderDetails.name, 
                avatar: firstResponderDetails.avatar, 
                text: firstResponderResponse 
            })}\n\n`);

            chatHistory.push({ role: 'assistant', content: firstResponderResponse });

            // Other models: sequential responses with enhanced context
            const otherModels = ALL_MODELS.filter(m => m !== firstResponder);
            for (const model of otherModels) {
                const modelDetails = MODEL_DETAILS[model] || { name: model, avatar: '?' };
                
                // Send typing indicator
                res.write(`data: ${JSON.stringify({ 
                    type: 'typing', 
                    model: modelDetails.name,
                    avatar: modelDetails.avatar
                })}\n\n`);

                // Create enhanced uniqueness prompt with conversation context
                const prior = chatHistory.map(msg => `- "${msg.content}"`).join('\n');
                const uniquenessPromptTemplate = isOngoingThread ? THREAD_CONTEXT_TPL : UNIQUENESS_TPL;
                
                const uniquenessPrompt = renderTemplate(uniquenessPromptTemplate, {
                    MAX_CHARS: maxChars,
                    USER_PROMPT: prompt,
                    PRIOR_ANSWERS: prior,
                    CONVERSATION_HISTORY: conversationHistory
                });

                const newResponse = await callOpenRouter(model, uniquenessPrompt, chatHistory, maxChars, systemPrompt);
                await database.createAIMessage(newResponse, model, false, targetConversationId, replyToMessageId, 'group');
                
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
        console.error('Error processing chat:', error.response ? error.response.data : error.message);
        
        res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error.message 
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