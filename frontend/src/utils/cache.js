import { getItem, setItem, deleteItem } from './indexedDb';

const KEY_PREFIX = 'groopchat';

const conversationKey = (userId) => `${KEY_PREFIX}:conversations:${userId}`;
const messagesKey = (userId, conversationId) => `${KEY_PREFIX}:messages:${userId}:${conversationId}`;

const safeSet = async (key, value) => {
    try {
        await setItem(key, value);
    } catch (error) {
        console.warn('Cache write failed', key, error);
    }
};

const safeGet = async (key) => {
    try {
        return await getItem(key);
    } catch (error) {
        console.warn('Cache read failed', key, error);
        return null;
    }
};

const safeDelete = async (key) => {
    try {
        await deleteItem(key);
    } catch (error) {
        console.warn('Cache delete failed', key, error);
    }
};

export const saveCachedConversations = async (userId, conversations = []) => {
    if (!userId) {
        return;
    }
    await safeSet(conversationKey(userId), {
        data: conversations,
        updatedAt: Date.now(),
    });
};

export const getCachedConversations = async (userId) => {
    if (!userId) {
        return null;
    }
    const stored = await safeGet(conversationKey(userId));
    return stored?.data || null;
};

export const saveCachedMessages = async (userId, conversationId, messages = []) => {
    if (!userId || !conversationId) {
        return;
    }
    await safeSet(messagesKey(userId, conversationId), {
        data: messages,
        updatedAt: Date.now(),
    });
};

export const getCachedMessages = async (userId, conversationId) => {
    if (!userId || !conversationId) {
        return null;
    }
    const stored = await safeGet(messagesKey(userId, conversationId));
    return stored?.data || null;
};

export const deleteCachedMessages = async (userId, conversationId) => {
    if (!userId || !conversationId) {
        return;
    }
    await safeDelete(messagesKey(userId, conversationId));
};

export const clearUserCache = async (userId) => {
    if (!userId) {
        return;
    }
    await safeDelete(conversationKey(userId));
};
