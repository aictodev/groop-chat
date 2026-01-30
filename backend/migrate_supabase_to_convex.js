#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const convexUrl = process.env.CONVEX_URL;
const convexAdminKey =
    process.env.CONVEX_ADMIN_KEY ||
    process.env.CONVEX_DEPLOY_KEY ||
    process.env.CONVEX_API_KEY;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!convexUrl || !convexAdminKey) {
    console.error('Missing Convex credentials (CONVEX_URL/CONVEX_ADMIN_KEY).');
    process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
}

const { ConvexHttpClient } = require('convex/browser');
const api = require(path.join(__dirname, '..', 'convex', '_generated', 'api_cjs.cjs')).api;

const convex = new ConvexHttpClient(convexUrl);
convex.setAdminAuth(convexAdminKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

const normalizeOptional = (value) => (value === null || value === undefined ? undefined : value);

const normalizeJson = (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }
    return value;
};

const fetchAll = async (table, pageSize = 1000) => {
    const results = [];
    let from = 0;

    while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, to);

        if (error) {
            throw new Error(`Supabase fetch error for ${table}: ${error.message}`);
        }

        results.push(...(data || []));

        if (!data || data.length < pageSize) {
            break;
        }

        from += pageSize;
        await sleep(150);
    }

    return results;
};

const migrateTable = async (label, data, chunkSize, mutationFn) => {
    console.log(`\n➡️  Migrating ${label}: ${data.length} rows`);
    if (!data.length) {
        return;
    }

    const chunks = chunkArray(data, chunkSize);
    for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        await convex.mutation(mutationFn, { items: chunk });
        console.log(`  ✅ ${label}: ${Math.min((i + 1) * chunkSize, data.length)} / ${data.length}`);
    }
};

const main = async () => {
    console.log('Starting one-off Supabase → Convex migration...');

    const [
        users,
        aiModels,
        conversations,
        participants,
        conversationModels,
        messages,
        userPrompts
    ] = await Promise.all([
        fetchAll('users'),
        fetchAll('ai_models'),
        fetchAll('conversations'),
        fetchAll('conversation_participants'),
        fetchAll('conversation_ai_models'),
        fetchAll('messages'),
        fetchAll('user_prompts')
    ]);

    const normalizedUsers = users.map((user) => ({
        id: user.id,
        username: user.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
        email: normalizeOptional(user.email),
        display_name: normalizeOptional(user.display_name),
        avatar_url: normalizeOptional(user.avatar_url),
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
        is_active: user.is_active !== false
    }));

    const normalizedModels = aiModels.map((model) => ({
        id: model.id,
        name: model.name,
        display_name: normalizeOptional(model.display_name),
        avatar: normalizeOptional(model.avatar),
        provider: normalizeOptional(model.provider),
        is_active: model.is_active !== false,
        capabilities: normalizeJson(model.capabilities) || {},
        created_at: model.created_at || new Date().toISOString()
    }));

    const normalizedConversations = conversations.map((conversation) => ({
        id: conversation.id,
        title: normalizeOptional(conversation.title),
        created_by: normalizeOptional(conversation.created_by),
        created_at: conversation.created_at || new Date().toISOString(),
        updated_at: conversation.updated_at || new Date().toISOString(),
        last_message_at: normalizeOptional(conversation.last_message_at),
        is_active: conversation.is_active !== false,
        settings: normalizeJson(conversation.settings) || {}
    }));

    const normalizedParticipants = participants.map((row) => ({
        conversation_id: row.conversation_id,
        user_id: row.user_id,
        joined_at: row.joined_at || new Date().toISOString(),
        role: row.role || 'member',
        is_active: row.is_active !== false
    }));

    const normalizedConversationModels = conversationModels.map((row) => ({
        conversation_id: row.conversation_id,
        ai_model_id: row.ai_model_id,
        is_active: row.is_active !== false,
        added_at: row.added_at || new Date().toISOString(),
        settings: normalizeJson(row.settings) || {}
    }));

    const normalizedMessages = messages.map((msg) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_type: msg.sender_type,
        sender_id: normalizeOptional(msg.sender_id),
        ai_model_id: normalizeOptional(msg.ai_model_id),
        user_id: normalizeOptional(msg.user_id),
        content: msg.content,
        content_type: normalizeOptional(msg.content_type),
        created_at: msg.created_at || new Date().toISOString(),
        metadata: normalizeJson(msg.metadata),
        parent_message_id: normalizeOptional(msg.parent_message_id),
        is_first_responder: normalizeOptional(msg.is_first_responder)
    }));

    const normalizedPrompts = userPrompts.map((prompt) => ({
        id: prompt.id,
        user_id: prompt.user_id,
        prompt_type: prompt.prompt_type,
        title: prompt.title,
        content: prompt.content,
        is_default: normalizeOptional(prompt.is_default),
        is_active: prompt.is_active !== false,
        created_at: prompt.created_at || new Date().toISOString(),
        updated_at: prompt.updated_at || new Date().toISOString()
    }));

    await migrateTable('users', normalizedUsers, 100, api.db.importUsers);
    await migrateTable('ai_models', normalizedModels, 100, api.db.importAiModels);
    await migrateTable('conversations', normalizedConversations, 100, api.db.importConversations);
    await migrateTable('conversation_participants', normalizedParticipants, 200, api.db.importConversationParticipants);
    await migrateTable('conversation_ai_models', normalizedConversationModels, 200, api.db.importConversationAiModels);
    await migrateTable('messages', normalizedMessages, 25, api.db.importMessages);
    await migrateTable('user_prompts', normalizedPrompts, 100, api.db.importUserPrompts);

    console.log('\n✅ Migration complete.');
};

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
