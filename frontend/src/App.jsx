import React, { useState, useEffect, useRef } from 'react';
import './reply-styles.css';
import { useAuth } from './AuthContext';
import ModelManager from './components/ModelManager';
import ProfilePictureUpload from './components/ProfilePictureUpload';
import EditableDisplayName from './components/EditableDisplayName';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// --- Configuration ---
const MODELS = [
    { id: "google/gemini-2.5-flash", name: "Gemini" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude" },
    { id: "meta-llama/llama-3-8b-instruct", name: "Llama" },
    { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
    { id: "qwen/qwen-2.5-7b-instruct", name: "Qwen" },
    { id: "moonshotai/kimi-k2", name: "Kimi K2" },
];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:7001';

const createAliasKey = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const buildModelAliases = (model) => {
    const variants = new Set();
    variants.add(model.name);
    variants.add(model.name.replace(/\s+/g, ''));

    const nameParts = model.name.split(/\s+/);
    if (nameParts.length > 0) {
        variants.add(nameParts[0]);
    }
    if (nameParts.length > 1) {
        variants.add(nameParts[0] + nameParts[1]);
    }

    const slug = model.id.split('/').pop();
    variants.add(slug);
    variants.add(slug.replace(/-/g, ''));

    return Array.from(variants).filter(Boolean);
};

const MODEL_ALIAS_METADATA = MODELS.map((model) => ({
    ...model,
    aliases: buildModelAliases(model),
}));

const MODEL_LOOKUP = MODEL_ALIAS_METADATA.reduce((acc, model) => {
    acc[model.id] = model;
    return acc;
}, {});

const MODEL_ALIAS_INDEX = MODEL_ALIAS_METADATA.reduce((acc, model) => {
    model.aliases.forEach((variant) => {
        const key = createAliasKey(variant);
        if (key && !acc[key]) {
            acc[key] = model.id;
        }
    });
    return acc;
}, {});

const MENTION_REGEX = /@([a-zA-Z0-9][a-zA-Z0-9-_]*)/g;

const findMentionedModel = (text) => {
    if (!text) {
        return null;
    }

    const matches = text.matchAll(MENTION_REGEX);
    for (const match of matches) {
        const aliasKey = createAliasKey(match[1]);
        if (!aliasKey) continue;

        const modelId = MODEL_ALIAS_INDEX[aliasKey];
        if (modelId) {
            return {
                id: modelId,
                name: MODEL_LOOKUP[modelId]?.name || modelId,
                mentionToken: match[0],
            };
        }
    }

    return null;
};

// --- Main App Component ---
function App() {
    const { user, signOut, session } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [firstResponder] = useState(MODELS[0].id);
    const [isLoading, setIsLoading] = useState(false);
    const [typingModel, setTypingModel] = useState(null);
    const [conversationTitle, setConversationTitle] = useState('AI Group Chat');
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [conversationMode, setConversationMode] = useState('group');
    const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'profile' - ensure always starts in chat
    const [userPrompts, setUserPrompts] = useState([]);
    const [editingPrompt, setEditingPrompt] = useState(null);
    const [characterLimit, setCharacterLimit] = useState(280);
    const [selectedModels, setSelectedModels] = useState(MODELS.map(m => m.id));
    const [mentionTarget, setMentionTarget] = useState(null);
    const [mentionSuggestions, setMentionSuggestions] = useState([]);
    const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
    const [activeMentionRange, setActiveMentionRange] = useState(null);
    const [mentionSelectionIndex, setMentionSelectionIndex] = useState(0);
    const [userProfile, setUserProfile] = useState(null);
    const chatContainerRef = useRef(null);
    const composerInputRef = useRef(null);

    const getConversationById = (conversationId) => {
        if (!conversationId) {
            return null;
        }
        return conversations.find((conversation) => conversation.id === conversationId) || null;
    };

    const getConversationAvatarUrl = (conversation) => {
        if (!conversation) {
            return null;
        }

        const storedAvatar = conversation.settings?.avatar_url;
        if (!storedAvatar) {
            return null;
        }

        return storedAvatar.startsWith('http')
            ? storedAvatar
            : `${BACKEND_URL}${storedAvatar}`;
    };

    // Helper function to get auth headers
    const getAuthHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
        }
        return headers;
    };

    // Load existing messages on component mount
    useEffect(() => {
        const initializeApp = async () => {
            await loadConversations();
            await loadMessages();
            if (user) {
                await loadUserProfile();
            }
        };
        initializeApp();
    }, [user]);

    // Load messages when active conversation changes
    useEffect(() => {
        if (activeConversationId && conversations.length > 0) {
            loadMessages();
        }
    }, [activeConversationId, conversations]);

    // Auto-scroll to the latest message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (conversationMode === 'direct') {
            setMentionTarget(null);
        }
    }, [conversationMode]);


    const loadUserProfile = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/profile`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const profile = await response.json();
                setUserProfile(profile);
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    };

    const handleAvatarUpdate = (avatarUrl) => {
        setUserProfile(prev => ({
            ...prev,
            avatar_url: avatarUrl.replace('http://localhost:7001', '')
        }));
    };

    const loadConversations = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/conversations`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const loadedConversations = await response.json();
                setConversations(loadedConversations);

                // If no active conversation is set and we have conversations, set the first one as active
                if (!activeConversationId && loadedConversations.length > 0) {
                    setActiveConversationId(loadedConversations[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    };

    const loadMessages = async () => {
        try {
            const url = activeConversationId 
                ? `${BACKEND_URL}/api/conversations/${activeConversationId}/messages`
                : `${BACKEND_URL}/api/messages`;
            
            console.log('Loading messages from:', url);
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const loadedMessages = await response.json();
                console.log('Loaded messages:', loadedMessages.length);
                
                // Ensure messages have IDs and proper format
                const processedMessages = loadedMessages.map(msg => {
                    const processed = {
                        ...msg,
                        id: msg.id || `temp_${Date.now()}_${Math.random()}`, // Temporary ID for messages without DB ID
                        sender: msg.sender_type || msg.sender, // Handle both formats
                        text: msg.content || msg.text, // Handle both formats
                        time: new Date(msg.created_at || msg.time), // Handle both formats
                        model: msg.ai_models?.name || msg.model // Handle model name
                    };

                    // Parse metadata for reply information
                    if (msg.metadata) {
                        try {
                            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                            console.log('📖 Processing message metadata for msg', msg.id, ':', metadata);
                            if (metadata.reply_to_message_id) {
                                processed.replyToMessageId = metadata.reply_to_message_id;
                                console.log('🔗 Found reply relationship:', processed.replyToMessageId);
                            }
                            if (metadata.conversation_mode === 'direct' || metadata.is_direct_reply) {
                                processed.isDirectReply = true;
                                console.log('💬 Marked as direct reply');
                            }
                        } catch (e) {
                            console.warn('Failed to parse message metadata:', e);
                        }
                    }

                    console.log('Processed message:', processed);
                    return processed;
                });

                // Second pass: resolve reply relationships
                const messagesWithReplies = processedMessages.map(msg => {
                    if (msg.replyToMessageId) {
                        // Find the message this is replying to
                        const replyToMessage = processedMessages.find(m => m.id === msg.replyToMessageId);
                        console.log('🔍 Looking for reply target:', msg.replyToMessageId, 'found:', !!replyToMessage);
                        if (replyToMessage) {
                            msg.replyTo = {
                                id: replyToMessage.id,
                                text: replyToMessage.text,
                                model: replyToMessage.model,
                                sender: replyToMessage.sender
                            };
                        }
                    }
                    return msg;
                });

                setMessages(messagesWithReplies);

                // Update conversation title based on active conversation
                const activeConv = conversations.find(c => c.id === activeConversationId);
                if (activeConv) {
                    setConversationTitle(activeConv.title || 'AI Group Chat');
                }
                
                // Generate title if we have user messages and no custom title
                const hasUserMessages = processedMessages.some(msg => msg.sender === 'user');
                if (hasUserMessages && (!activeConv || activeConv.title === 'New Chat')) {
                    generateTitle();
                }
            } else {
                console.error('Failed to load messages, status:', response.status, response.statusText);
                // Try fallback to old API
                const fallbackResponse = await fetch(`${BACKEND_URL}/api/messages`);
                if (fallbackResponse.ok) {
                    const loadedMessages = await fallbackResponse.json();
                    const processedMessages = loadedMessages.map(msg => {
                        const processed = {
                            ...msg,
                            id: msg.id || Date.now() + Math.random(),
                            sender: msg.sender_type || msg.sender,
                            text: msg.content || msg.text,
                            time: new Date(msg.created_at || msg.time)
                        };

                        // Parse metadata for reply information (fallback)
                        if (msg.metadata) {
                            try {
                                const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                                if (metadata.reply_to_message_id) {
                                    processed.replyToMessageId = metadata.reply_to_message_id;
                                }
                                if (metadata.conversation_mode === 'direct' || metadata.is_direct_reply) {
                                    processed.isDirectReply = true;
                                }
                            } catch (e) {
                                console.warn('Failed to parse fallback message metadata:', e);
                            }
                        }

                        return processed;
                    });

                    // Resolve reply relationships for fallback messages
                    const messagesWithReplies = processedMessages.map(msg => {
                        if (msg.replyToMessageId) {
                            const replyToMessage = processedMessages.find(m => m.id === msg.replyToMessageId);
                            if (replyToMessage) {
                                msg.replyTo = {
                                    id: replyToMessage.id,
                                    text: replyToMessage.text,
                                    model: replyToMessage.model,
                                    sender: replyToMessage.sender
                                };
                            }
                        }
                        return msg;
                    });
                    setMessages(messagesWithReplies);
                }
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            // Fallback to default welcome message if loading fails
            setMessages([
                { id: 'welcome', sender: 'system', text: 'Welcome to the AI Group Chat! Select a First Responder and ask a question to begin.', time: new Date() }
            ]);
        }
    };

    const createNewConversation = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/conversations`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const newConversation = await response.json();
                setActiveConversationId(newConversation.id);
                await loadConversations(); // Refresh conversation list
            }
        } catch (error) {
            console.error('Failed to create new conversation:', error);
        }
    };

    const generateTitle = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/generate-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: activeConversationId })
            });
            if (response.ok) {
                const { title } = await response.json();
                setConversationTitle(title);
                // Refresh conversations to show updated title in sidebar
                await loadConversations();
            }
        } catch (error) {
            console.error('Failed to generate title:', error);
        }
    };

    const handleReplyToMessage = (message) => {
        
        // Don't allow replies to temporary IDs or invalid UUID formats (not stored in database)
        const messageId = message.id && message.id.toString();
        const isValidUUID = messageId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
        const isTempId = messageId && messageId.startsWith('temp_');
        
        if (!isValidUUID || isTempId) {
            setReplyToMessage(null);
            setConversationMode('group');
            return;
        }
        
        setReplyToMessage(message);
        if (message.sender === 'ai') {
            setConversationMode('direct');
        }
    };

    const clearReply = () => {
        setReplyToMessage(null);
        setConversationMode('group');
    };

    const handleStreamEvent = (data) => {
        switch (data.type) {
            case 'typing': {
                setTypingModel({
                    model: data.model,
                    avatar: data.avatar
                });
                break;
            }

            case 'message': {
                setTypingModel(null);
                const aiMessage = {
                    id: `temp_ai_${Date.now()}_${Math.random()}`,
                    sender: 'ai',
                    model: data.model,
                    avatar: data.avatar,
                    text: data.text,
                    time: new Date(),
                    isDirectReply: data.isDirectReply || false
                };
                setMessages(prev => [...prev, aiMessage]);

                if (data.isDirectReply) {
                    setReplyToMessage(null);
                    setConversationMode('group');
                }
                break;
            }

            case 'complete': {
                setTypingModel(null);
                setIsLoading(false);
                setTimeout(() => generateTitle(), 1000);
                break;
            }

            case 'error': {
                setTypingModel(null);
                setIsLoading(false);
                setMessages(prev => [...prev, {
                    sender: 'system',
                    text: `Error: ${data.message}`,
                    time: new Date()
                }]);
                break;
            }
        }
    };

    const resetMentionState = () => {
        setMentionSuggestions([]);
        setIsMentionMenuOpen(false);
        setActiveMentionRange(null);
        setMentionSelectionIndex(0);
    };

    const handleInputChange = (event) => {
        const value = event.target.value;
        const caretPosition = event.target.selectionStart ?? value.length;

        setInput(value);

        if (conversationMode === 'direct') {
            setMentionTarget(null);
            resetMentionState();
            return;
        }

        const textBeforeCaret = value.slice(0, caretPosition);
        const mentionMatch = textBeforeCaret.match(/@([a-zA-Z0-9-_]*)$/);

        if (mentionMatch) {
            const query = mentionMatch[1];
            const mentionStart = textBeforeCaret.lastIndexOf('@');
            const aliasKey = createAliasKey(query);

            const availableModels = MODEL_ALIAS_METADATA.filter((meta) => selectedModels.includes(meta.id));
            const filtered = availableModels.filter((meta) => {
                if (!aliasKey) return true;
                return meta.aliases.some((alias) => createAliasKey(alias).startsWith(aliasKey));
            });

            if (filtered.length > 0) {
                setMentionSuggestions(filtered);
                setIsMentionMenuOpen(true);
                setActiveMentionRange({ start: mentionStart, end: caretPosition });
                setMentionSelectionIndex((prev) => Math.min(prev, filtered.length - 1));
            } else {
                resetMentionState();
            }
        } else {
            resetMentionState();
        }

        const mention = findMentionedModel(value);
        setMentionTarget(mention);
    };

    const applyMentionSelection = (modelMeta) => {
        if (!activeMentionRange) return;

        const { start, end } = activeMentionRange;
        const before = input.slice(0, start);
        const after = input.slice(end);
        const mentionLabel = modelMeta.name.split(/\s+/)[0];
        const replacement = `@${mentionLabel} `;
        const nextValue = `${before}${replacement}${after}`;

        setInput(nextValue);
        setMentionTarget({ id: modelMeta.id, name: modelMeta.name, mentionToken: replacement.trim() });
        resetMentionState();

        requestAnimationFrame(() => {
            const inputEl = composerInputRef.current;
            if (inputEl) {
                const caret = before.length + replacement.length;
                inputEl.setSelectionRange(caret, caret);
                inputEl.focus();
            }
        });
    };

    const handleInputKeyDown = (event) => {
        if (isMentionMenuOpen && mentionSuggestions.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setMentionSelectionIndex((prev) => (prev + 1) % mentionSuggestions.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setMentionSelectionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                applyMentionSelection(mentionSuggestions[mentionSelectionIndex] || mentionSuggestions[0]);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                resetMentionState();
                return;
            }
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            handleSend();
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const promptToSend = input;
        const replyToId = replyToMessage?.id;
        const mentionOverride = conversationMode === 'direct' ? null : findMentionedModel(promptToSend);
        const currentMode = mentionOverride ? 'group' : conversationMode;
        const modelsForRequest = mentionOverride
            ? [mentionOverride.id]
            : selectedModels;
        
        setInput('');
        setMentionTarget(null);
        resetMentionState();
        setIsLoading(true);
        setTypingModel(null);

        // Add user message immediately with reply context
        const userMessage = { 
            id: Date.now() + Math.random(), // Temporary ID
            sender: 'user', 
            text: promptToSend, 
            time: new Date(),
            replyTo: replyToMessage
        };
        setMessages(prev => [...prev, userMessage]);

        // Clear reply after sending
        if (replyToMessage) {
            setReplyToMessage(null);
        }

        try {
            // Use fetch with streaming instead of EventSource for POST data
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    prompt: promptToSend,
                    firstResponder,
                    conversationId: activeConversationId,
                    replyToMessageId: replyToId,
                    conversationMode: currentMode,
                    characterLimit: characterLimit,
                    selectedModels: modelsForRequest
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            handleStreamEvent(data);
                        } catch {
                            console.warn('Failed to parse SSE data:', line);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Failed to connect to backend:", error);
            setIsLoading(false);
            setTypingModel(null);
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                sender: 'system', 
                text: `Error: ${error.message}`, 
                time: new Date() 
            }]);
        }
    };

    // ===== PROMPT MANAGEMENT FUNCTIONS =====

    const loadPrompts = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/prompts`, {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const prompts = await response.json();
                setUserPrompts(prompts);
            } else {
                console.error('Failed to load prompts:', response.status);
            }
        } catch (error) {
            console.error('Error loading prompts:', error);
        }
    };

    const savePrompt = async (prompt) => {
        try {
            const url = prompt.id
                ? `${BACKEND_URL}/api/prompts/${prompt.id}`
                : `${BACKEND_URL}/api/prompts`;

            const method = prompt.id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(prompt)
            });

            if (response.ok) {
                await loadPrompts(); // Reload prompts
                setEditingPrompt(null);
            } else {
                console.error('Failed to save prompt:', response.status);
            }
        } catch (error) {
            console.error('Error saving prompt:', error);
        }
    };

    const deletePrompt = async (promptId) => {
        if (!confirm('Are you sure you want to delete this prompt?')) {
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/prompts/${promptId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                await loadPrompts(); // Reload prompts
            } else {
                console.error('Failed to delete prompt:', response.status);
            }
        } catch (error) {
            console.error('Error deleting prompt:', error);
        }
    };

    // Force start in chat view on app load
    useEffect(() => {
        setCurrentView('chat');
    }, []);

    // Load prompts when user changes or view changes to profile
    useEffect(() => {
        if (user && currentView === 'profile') {
            loadPrompts();
        }
    }, [user, currentView]);

    const activeConversation = getConversationById(activeConversationId);
    const activeConversationName = activeConversation?.title || conversationTitle;
    const activeConversationAvatar = getConversationAvatarUrl(activeConversation);
    const conversationStatus = conversationMode === 'direct' && replyToMessage
        ? `Direct with ${replyToMessage?.model || 'Model'}`
        : 'Online';

    return (
        <div className="chat-shell">
            <Sidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onConversationSelect={setActiveConversationId}
                onNewConversation={createNewConversation}
                onProfileClick={() => setCurrentView(currentView === 'profile' ? 'chat' : 'profile')}
                userProfile={userProfile || user}
                signOut={signOut}
                resolveAvatarUrl={getConversationAvatarUrl}
            />

            <div className="chat-main">
                <div className="chat-main__layer">
                    {currentView === 'profile' ? (
                        <ProfileView
                            userPrompts={userPrompts}
                            onSave={savePrompt}
                            onDelete={deletePrompt}
                            editingPrompt={editingPrompt}
                            setEditingPrompt={setEditingPrompt}
                            user={user}
                            userProfile={userProfile}
                            setUserProfile={setUserProfile}
                            onAvatarUpdate={handleAvatarUpdate}
                            onBack={() => setCurrentView('chat')}
                        />
                    ) : (
                        <>
                            <header className="chat-header">
                                <div className="chat-header__info">
                                    <ConversationAvatar
                                        name={activeConversationName}
                                        imageSrc={activeConversationAvatar}
                                        fallbackSeed={activeConversationId || activeConversationName}
                                        className="h-12 w-12"
                                    />
                                    <div>
                                        <p className="chat-header__title">{activeConversationName}</p>
                                        <p className="chat-header__status">{conversationStatus}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ModelManager
                                        selectedModels={selectedModels}
                                        setSelectedModels={setSelectedModels}
                                        disabled={conversationMode === 'direct' || isLoading}
                                    />
                                </div>
                            </header>

                            <div className="chat-history" ref={chatContainerRef}>
                                <div className="chat-history__stack">
                                    {messages.map((msg) => (
                                        <MessageBubble
                                            key={msg.id || `${msg.sender}-${msg.time}-${msg.model}`}
                                            msg={msg}
                                            onReply={handleReplyToMessage}
                                        />
                                    ))}
                                    {isLoading && typingModel && (
                                        <TypingIndicator model={typingModel} />
                                    )}
                                </div>
                            </div>

                            <div className="chat-composer">
                                <div className="flex-1 space-y-2">
                                    {replyToMessage && (
                                        <ReplyPreview
                                            message={replyToMessage}
                                            onClear={clearReply}
                                        />
                                    )}
                                    <div className="flex items-start gap-3">
                                        {conversationMode === 'direct' && (
                                            <span className="rounded-full bg-whatsapp-accent-soft px-3 py-1 text-xs font-semibold text-whatsapp-ink-soft">
                                                Direct with {replyToMessage?.model || 'model'}
                                            </span>
                                        )}
                                        {conversationMode !== 'direct' && mentionTarget && (
                                            <span className="rounded-full bg-whatsapp-accent-soft px-3 py-1 text-xs font-semibold text-whatsapp-ink-soft">
                                                Direct call: {mentionTarget.name}
                                            </span>
                                        )}
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                value={input}
                                                ref={composerInputRef}
                                                onChange={handleInputChange}
                                                onKeyDown={handleInputKeyDown}
                                                placeholder={replyToMessage ? `Replying to ${replyToMessage.model || 'User'}...` : 'Type a message'}
                                                className="chat-composer__input"
                                                disabled={isLoading}
                                            />
                                            <div className="chat-composer__input-controls">
                                                <label className="flex items-center gap-2 text-xs text-whatsapp-ink-soft">
                                                    Limit
                                                    <input
                                                        type="number"
                                                        min="50"
                                                        max="2000"
                                                        value={characterLimit}
                                                        onChange={(e) => setCharacterLimit(parseInt(e.target.value, 10) || 280)}
                                                        className="w-20 rounded-md border border-whatsapp-divider bg-white/90 px-2 py-1 text-xs text-whatsapp-ink focus:border-whatsapp-accent focus:outline-none"
                                                    />
                                                </label>
                                                <Button
                                                    variant="whatsapp-icon"
                                                    size="whatsapp-icon"
                                                    onClick={handleSend}
                                                    disabled={isLoading || !input.trim()}
                                                >
                                                    <SendIcon />
                                                </Button>
                                            </div>
                                            {isMentionMenuOpen && mentionSuggestions.length > 0 && (
                                                <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 max-h-60 w-full overflow-y-auto rounded-2xl border border-whatsapp-divider bg-white shadow-panel">
                                                    {mentionSuggestions.map((model, index) => {
                                                        const isActive = index === mentionSelectionIndex;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={model.id}
                                                                onMouseDown={(event) => {
                                                                    event.preventDefault();
                                                                    applyMentionSelection(model);
                                                                }}
                                                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${isActive ? 'bg-whatsapp-panel-muted text-whatsapp-ink' : 'text-whatsapp-ink-soft hover:bg-whatsapp-panel-muted hover:text-whatsapp-ink'}`}
                                                            >
                                                                <ProviderIcon modelId={model.id} size={18} />
                                                                <span className="font-medium">{model.name}</span>
                                                                <span className="ml-auto text-xs text-whatsapp-ink-subtle">@{model.name.split(/\s+/)[0]}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- UI Components ---

// Provider icon component with fallback
const ProviderIcon = ({ modelId, size = 24 }) => {
    const [iconError, setIconError] = useState(false);
    
    // Map model IDs to provider names
    const getProviderFromModel = (modelId) => {
        if (modelId.startsWith('google/')) return 'google';
        if (modelId.startsWith('openai/')) return 'openai';
        if (modelId.startsWith('anthropic/')) return 'anthropic';
        if (modelId.startsWith('meta-llama/')) return 'meta';
        if (modelId.startsWith('deepseek/')) return 'deepseek';
        if (modelId.startsWith('qwen/')) return 'qwen';
        if (modelId.startsWith('moonshotai/')) return 'moonshot';
        return 'default';
    };

    const provider = getProviderFromModel(modelId);
    const iconPath = `/icons/${provider}.svg`;

    if (iconError || provider === 'default') {
        // Fallback to text avatar
        const initial = provider.charAt(0).toUpperCase();
        const colors = {
            'google': '#4285F4',
            'openai': '#00A67E',
            'anthropic': '#D97757',
            'meta': '#1877F2',
            'deepseek': '#6366F1',
            'qwen': '#EF4444',
            'default': '#6B7280'
        };
        
        return (
            <div 
                className="provider-icon fallback"
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    backgroundColor: colors[provider],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: Math.max(10, size * 0.4)
                }}
            >
                {initial}
            </div>
        );
    }

    return (
        <img 
            src={iconPath}
            alt={`${provider} icon`}
            className="provider-icon"
            style={{ width: size, height: size, borderRadius: '50%' }}
            onError={() => setIconError(true)}
        />
    );
};

const ReplyPreview = ({ message, onClear }) => (
        <div className="chat-reply-preview">
            <div className="chat-message__reply-bar" />
            <div className="min-w-0 flex-1 chat-message__reply-text">
                <p className="text-xs font-semibold text-whatsapp-ink">
                    {message.model || 'You'}
                </p>
                <p className="text-xs text-whatsapp-ink-soft">
                    {message.text}
                </p>
            </div>
            <button
                type="button"
                onClick={onClear}
                className="text-xs font-semibold text-whatsapp-ink-subtle transition hover:text-whatsapp-ink"
            >
                Cancel
            </button>
        </div>
);

const Sidebar = ({
    conversations,
    activeConversationId,
    onConversationSelect,
    onNewConversation,
    onProfileClick,
    userProfile,
    signOut,
    resolveAvatarUrl,
}) => {
    const userAvatar = userProfile?.avatar_url
        ? (userProfile.avatar_url.startsWith('http')
            ? userProfile.avatar_url
            : `${BACKEND_URL}${userProfile.avatar_url}`)
        : null;

    return (
        <aside className="chat-sidebar">
            <div className="chat-sidebar__header">
                <div className="chat-sidebar__profile">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" className="focus:outline-none">
                                <ConversationAvatar
                                    name={userProfile?.full_name || userProfile?.email || 'You'}
                                    imageSrc={userAvatar}
                                    fallbackSeed={userProfile?.id || userProfile?.email}
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 rounded-xl border border-whatsapp-divider bg-white p-2 shadow-panel">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none text-whatsapp-ink">
                                        {userProfile?.full_name || 'Profile'}
                                    </p>
                                    <p className="text-xs text-whatsapp-ink-subtle">Manage your account</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-whatsapp-divider" />
                            <DropdownMenuItem onClick={onProfileClick} className="cursor-pointer text-sm text-whatsapp-ink">
                                Profile &amp; Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-whatsapp-divider" />
                            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-sm text-red-600 focus:text-red-600">
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div>
                        <p className="chat-sidebar__title">Chats</p>
                        <p className="chat-sidebar__subtitle">Coordinate multiple models</p>
                    </div>
                </div>
                <div className="chat-sidebar__actions">
                    <Button
                        variant="whatsapp-icon"
                        size="whatsapp-icon"
                        onClick={onNewConversation}
                        title="Start new chat"
                    >
                        <span className="text-lg leading-none">+</span>
                    </Button>
                </div>
            </div>

            <div className="chat-sidebar__search">
                <Input
                    placeholder="Search or start new chat"
                    className="h-11 rounded-2xl border border-whatsapp-divider bg-white text-sm text-whatsapp-ink placeholder:text-whatsapp-ink-subtle"
                />
            </div>

            <div className="chat-sidebar__list">
                {conversations.map((conversation) => {
                    let lastMessage = 'Click to open conversation';
                    if (conversation.last_message) {
                        const msg = conversation.last_message;
                        if (msg.sender_type === 'user') {
                            lastMessage = msg.content.length > 60 ? `${msg.content.slice(0, 60)}…` : msg.content;
                        } else if (msg.sender_type === 'ai' && msg.ai_models) {
                            const content = msg.content.length > 48 ? `${msg.content.slice(0, 48)}…` : msg.content;
                            lastMessage = `${msg.ai_models.name}: ${content}`;
                        } else if (msg.sender_type === 'system') {
                            lastMessage = msg.content.length > 60 ? `${msg.content.slice(0, 60)}…` : msg.content;
                        }
                    }

                    const avatarUrl = resolveAvatarUrl ? resolveAvatarUrl(conversation) : null;
                    const isActive = conversation.id === activeConversationId;

                    return (
                        <button
                            type="button"
                            key={conversation.id}
                            onClick={() => onConversationSelect(conversation.id)}
                            className={cn('chat-sidebar__item', isActive && 'chat-sidebar__item--active')}
                        >
                            <ConversationAvatar
                                name={conversation.title || 'New Chat'}
                                imageSrc={avatarUrl}
                                fallbackSeed={conversation.id}
                                className="chat-sidebar__avatar"
                            />
                            <div className="chat-sidebar__meta">
                                <p className="chat-sidebar__meta-title">{conversation.title || 'New Chat'}</p>
                                <p className="chat-sidebar__meta-last">{lastMessage}</p>
                            </div>
                            <span className="chat-sidebar__time">
                                {conversation.updated_at ? formatConversationTime(conversation.updated_at) : ''}
                            </span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};



const ChatHeader = () => (
    <header className="flex items-center justify-between px-4 py-2 bg-[#202c33] text-white select-none">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-lg font-bold text-white">
                AI
            </div>
            <div>
                <h1 className="text-base font-semibold leading-tight">AI Group Chat</h1>
                <p className="text-[13px] text-gray-300 leading-tight">Gemini, GPT, Claude, Llama</p>
            </div>
        </div>
        <div className="flex items-center gap-4 opacity-80">
            <HeaderIcon title="Search">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M21.53 20.47l-3.66-3.66a8.5 8.5 0 10-1.06 1.06l3.66 3.66a.75.75 0 101.06-1.06zM10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z"/></svg>
            </HeaderIcon>
            <HeaderIcon title="Menu">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
            </HeaderIcon>
        </div>
    </header>
);

const HeaderIcon = ({ children, title }) => (
    <button title={title} className="p-2 rounded-full hover:bg-white/10 transition-colors">
        {children}
    </button>
);

const ChatWindow = ({ messages, isLoading, chatEndRef }) => (
    <main
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 bg-[length:400px_400px]"
        style={{
            backgroundImage:
                "url('data:image/svg+xml;utf8, %3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22 viewBox=%220 0 100 100%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.04%22%3E%3Ccircle cx=%225%22 cy=%225%22 r=%223%22/%3E%3Ccircle cx=%2255%22 cy=%2255%22 r=%223%22/%3E%3Ccircle cx=%2295%22 cy=%2290%22 r=%222%22/%3E%3Ccircle cx=%2225%22 cy=%2275%22 r=%222%22/%3E%3C/g%3E%3C/svg%3E')",
            backgroundColor: '#111b21'
        }}
    >
        <div className="max-w-3xl mx-auto space-y-1">
            {messages.map((msg, index) => <MessageBubble key={index} msg={msg} />)}
            {isLoading && <TypingIndicator />}
            <div ref={chatEndRef} />
        </div>
    </main>
);

const MessageBubble = ({ msg, onReply }) => {
    if (msg.sender === 'system') {
        return (
            <div className="chat-message chat-message--system">
                {msg.text}
                <div className="mt-2 text-[11px] text-whatsapp-ink-subtle">{formatTime(msg.time)}</div>
            </div>
        );
    }

    const isUser = msg.sender === 'user';
    const bubbleClasses = cn(
        'chat-message',
        isUser ? 'chat-message--outgoing' : 'chat-message--incoming',
        msg.isDirectReply && !isUser && 'ring-1 ring-whatsapp-accent/40'
    );

    const providerId = !isUser
        ? (MODELS.find((m) => m.name === msg.model)?.id || msg.model)
        : null;

    const truncatedReply = msg.replyTo?.text && msg.replyTo.text.length > 60
        ? `${msg.replyTo.text.slice(0, 60)}…`
        : msg.replyTo?.text;

    return (
        <div className={bubbleClasses}>
            {!isUser && (
                <div className="chat-message__header">
                    <ProviderIcon modelId={providerId} size={20} />
                    <span className="font-semibold text-whatsapp-ink">{msg.model}</span>
                    {msg.isDirectReply && (
                        <span className="text-[11px] font-medium text-whatsapp-ink-soft">• Direct reply</span>
                    )}
                </div>
            )}

            {msg.replyTo && msg.isDirectReply && (
                <div className="chat-message__reply">
                    <div className="chat-message__reply-bar" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-whatsapp-ink">
                            {msg.replyTo.model || 'You'}
                        </p>
                        <p className="truncate text-[11px] text-whatsapp-ink-subtle">
                            {truncatedReply}
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-2 whitespace-pre-line text-[0.95rem] leading-relaxed">
                {msg.text}
            </div>

            <div className="chat-message__meta">
                <span>{formatTime(msg.time)}</span>
                {!isUser && (
                    <button
                        type="button"
                        className="text-xs font-medium text-whatsapp-ink-soft transition hover:text-whatsapp-ink"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (onReply) {
                                onReply(msg);
                            }
                        }}
                    >
                        Reply
                    </button>
                )}
            </div>
        </div>
    );
};

const TypingIndicator = ({ model }) => (
    <div className="chat-message chat-message--incoming">
        <div className="chat-message__header">
            <span className="font-semibold text-whatsapp-ink">{model?.model}</span>
            <span className="text-whatsapp-ink-soft">is typing…</span>
        </div>
        <div className="chat-typing-indicator">
            <div className="chat-typing-indicator__dots">
                <span />
                <span />
                <span />
            </div>
        </div>
    </div>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

// ===== PROFILE VIEW COMPONENT =====
const ProfileView = ({ userPrompts, onSave, onDelete, editingPrompt, setEditingPrompt, user, userProfile, setUserProfile, onAvatarUpdate, onBack }) => {
    const promptTypes = [
        { key: 'base-system', label: 'Base System Prompt', description: 'Primary guidance for the first responder model in group chats.' },
        { key: 'uniqueness', label: 'Uniqueness Prompt', description: 'Coaches following models to add entirely new angles.' },
        { key: 'thread-context', label: 'Thread Context Prompt', description: 'Keeps long-running discussions coherent.' },
        { key: 'direct-conversation', label: 'Direct Conversation Prompt', description: 'Shapes one-on-one conversations when replying directly to a model.' },
    ];

    const getPromptsForType = (type) => userPrompts.filter((p) => p.prompt_type === type);

    const getDefaultPromptForType = (type) => {
        const systemDefaults = {
            'base-system': `You are one of several AI assistants in a coordinated group chat. Reply concisely with high signal. Avoid filler and restating the question. Prefer practical guidance with a warm tone.

Constraints:
- Max length: {{MAX_CHARS}} characters
- Response must be plain text only
- If unsure, say so briefly and offer one concrete next step`,
            'uniqueness': `You are an AI assistant in a group chat. Provide a fresh perspective beyond what previous assistants covered.

Rules:
- Do not repeat core ideas or examples already given.
- Add a new angle, trade-off, or tactic.
- Stay within {{MAX_CHARS}} characters and use plain text only.

Context:
- Original user question: "{{USER_PROMPT}}"
- Previous assistant answers:
{{PRIOR_ANSWERS}}`,
            'thread-context': `You are continuing an ongoing thread. Keep your reply concise, contextual, and additive.

Context:
{{CONVERSATION_HISTORY}}

Constraints:
- Max length: {{MAX_CHARS}} characters
- Plain text only
- Reference prior context when it sharpens your guidance`,
            'direct-conversation': `You are in a direct 1-on-1 conversation with the user. Offer focused, personal guidance.

Constraints:
- Max length: {{MAX_CHARS}} characters
- Plain text only
- Maintain a conversational tone`,
        };
        return systemDefaults[type] || '';
    };

    return (
        <div className="profile-panel">
            <div className="profile-panel__header">
                <div className="flex items-center gap-3">
                    <Button
                        variant="whatsapp-secondary"
                        size="sm"
                        onClick={onBack}
                        className="rounded-full px-3"
                    >
                        ← Back
                    </Button>
                    <div>
                        <h2 className="text-xl font-semibold text-whatsapp-ink">Profile &amp; Settings</h2>
                        <p className="text-sm text-whatsapp-ink-soft">{user?.email}</p>
                    </div>
                </div>
            </div>

            <section className="profile-panel__section space-y-6">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-whatsapp-ink">Profile identity</h3>
                    <p className="text-sm text-whatsapp-ink-soft">Update how you show up across conversations.</p>
                </div>

                <div className="flex flex-col items-center gap-6">
                    <ProfilePictureUpload user={userProfile || user} onAvatarUpdate={onAvatarUpdate} />
                    <div className="w-full rounded-2xl border border-whatsapp-divider bg-whatsapp-surface p-5 text-sm text-whatsapp-ink shadow-sm">
                        <div className="space-y-2">
                            <p className="font-medium">Email</p>
                            <p className="text-whatsapp-ink-soft">{user?.email}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                            <p className="font-medium">Display name</p>
                            <EditableDisplayName
                                displayName={userProfile?.display_name}
                                onDisplayNameUpdate={(newDisplayName) => {
                                    setUserProfile((prev) => ({
                                        ...prev,
                                        display_name: newDisplayName,
                                    }));
                                }}
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="profile-panel__section space-y-6">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-whatsapp-ink">Custom AI prompts</h3>
                    <p className="text-sm text-whatsapp-ink-soft">Override the stock instructions each model receives so the chat behaves exactly how you need.</p>
                </div>

                <div className="space-y-4">
                    {promptTypes.map((type) => {
                        const typePrompts = getPromptsForType(type.key);
                        const activePrompt = typePrompts.find((p) => p.is_active && p.is_default);

                        return (
                            <div key={type.key} className="rounded-2xl border border-whatsapp-divider bg-whatsapp-surface p-5 shadow-sm">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="space-y-2">
                                        <h4 className="text-base font-semibold text-whatsapp-ink">{type.label}</h4>
                                        <p className="max-w-xl text-sm text-whatsapp-ink-soft">{type.description}</p>
                                    </div>
                                    <Button
                                        variant="whatsapp"
                                        size="sm"
                                        onClick={() => setEditingPrompt({
                                            prompt_type: type.key,
                                            title: `My ${type.label}`,
                                            content: '',
                                            is_default: true,
                                        })}
                                        className="self-start whitespace-nowrap"
                                    >
                                        + Add custom
                                    </Button>
                                </div>

                                {activePrompt ? (
                                    <div className="mt-4 space-y-3 rounded-xl border border-whatsapp-divider bg-white/60 p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-sm font-semibold text-whatsapp-accent-dark">{activePrompt.title}</p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="whatsapp-secondary"
                                                    onClick={() => setEditingPrompt(activePrompt)}
                                                >
                                                    Edit
                                                </Button>
                                                {activePrompt.user_id !== '00000000-0000-0000-0000-000000000001' && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => onDelete(activePrompt.id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <pre className="max-h-64 overflow-auto rounded-lg bg-whatsapp-surface px-4 py-3 text-sm leading-relaxed text-whatsapp-ink whitespace-pre-wrap">
                                            {activePrompt.content || getDefaultPromptForType(type.key)}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-3 rounded-xl border border-dashed border-whatsapp-divider bg-white/40 p-4 text-sm text-whatsapp-ink-soft">
                                        <p className="font-medium">Using workspace default prompt:</p>
                                        <pre className="max-h-64 overflow-auto rounded-lg bg-whatsapp-surface px-4 py-3 text-sm leading-relaxed text-whatsapp-ink whitespace-pre-wrap">
                                            {getDefaultPromptForType(type.key)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {editingPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div className="w-full max-w-xl space-y-5 rounded-2xl border border-whatsapp-divider bg-whatsapp-panel p-6 shadow-panel">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-whatsapp-ink">
                                    {editingPrompt.id ? 'Edit prompt' : 'Create custom prompt'}
                                </h3>
                                <p className="mt-1 text-xs text-whatsapp-ink-soft">{promptTypes.find((p) => p.key === editingPrompt.prompt_type)?.label}</p>
                            </div>
                            <Button variant="ghost" onClick={() => setEditingPrompt(null)} className="text-sm text-whatsapp-ink-soft">
                                Close
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wide text-whatsapp-ink-soft">Title</label>
                                <input
                                    type="text"
                                    value={editingPrompt.title}
                                    onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                                    className="w-full rounded-lg border border-whatsapp-divider bg-whatsapp-surface px-3 py-2 text-sm text-whatsapp-ink focus:border-whatsapp-accent focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wide text-whatsapp-ink-soft">Content</label>
                                <textarea
                                    value={editingPrompt.content}
                                    onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                                    rows={10}
                                    className="w-full resize-y rounded-lg border border-whatsapp-divider bg-whatsapp-surface px-3 py-2 text-sm leading-relaxed text-whatsapp-ink focus:border-whatsapp-accent focus:outline-none"
                                    placeholder="Enter your custom prompt..."
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="whatsapp-secondary"
                                onClick={() => setEditingPrompt(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="whatsapp"
                                onClick={() => onSave(editingPrompt)}
                                disabled={!editingPrompt.title || !editingPrompt.content}
                                className="disabled:opacity-50"
                            >
                                Save prompt
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;

function formatTime(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatConversationTime(dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const daysDiff = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
        // Today - show time
        return formatTime(d);
    } else if (daysDiff === 1) {
        // Yesterday
        return 'Yesterday';
    } else if (daysDiff < 7) {
        // This week - show day name
        return d.toLocaleDateString([], { weekday: 'short' }); // Mon, Tue, etc.
    } else if (daysDiff < 365) {
        // This year - show month and day
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' }); // Dec 15
    } else {
        // Older than a year - show month, day, year
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); // Dec 15, 2023
    }
}
