import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const buildModelMap = async (ctx) => {
  const models = await ctx.db.query("ai_models").collect();
  const map = {};
  for (const model of models) {
    map[model.id] = {
      name: model.name,
      avatar: model.avatar,
      display_name: model.display_name,
      provider: model.provider,
    };
  }
  return map;
};

const requireConversationAccess = async (ctx, conversationId, userId) => {
  if (!userId) return true;
  const participant = await ctx.db
    .query("conversation_participants")
    .withIndex("by_conversation_user_active", (q) =>
      q
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .eq("is_active", true)
    )
    .unique();
  if (!participant) {
    throw new Error("conversation_access_denied");
  }
  return true;
};

export const healthCheck = query({
  args: {},
  handler: async (ctx) => {
    await ctx.db.query("ai_models").take(1);
    return true;
  },
});

export const getUserById = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_legacy_id", (q) => q.eq("id", userId))
      .unique();
  },
});

export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_legacy_id", (q) => q.eq("id", userId))
      .unique();
  },
});

export const ensureUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) {
      return null;
    }

    const authUser = await ctx.db.get(authUserId);
    if (!authUser) {
      return null;
    }

    let legacyUser = null;
    if (authUser.email) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", authUser.email))
        .collect();
      legacyUser = byEmail.find(
        (user) => user._id !== authUserId && user.id
      );
    }

    const legacyId = authUser.id || legacyUser?.id || authUserId;
    const username =
      authUser.username ||
      legacyUser?.username ||
      (authUser.email ? authUser.email.split("@")[0] : `user_${authUserId}`);
    const displayName =
      authUser.display_name || authUser.name || legacyUser?.display_name || username;
    const avatarUrl = authUser.avatar_url || authUser.image || legacyUser?.avatar_url || null;
    const now = new Date().toISOString();

    await ctx.db.patch(authUserId, {
      id: legacyId,
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
      created_at: authUser.created_at || legacyUser?.created_at || now,
      updated_at: now,
      is_active: authUser.is_active ?? legacyUser?.is_active ?? true,
    });

    if (legacyUser) {
      await ctx.db.delete(legacyUser._id);
    }

    return {
      id: legacyId,
      email: authUser.email || legacyUser?.email || null,
      display_name: displayName,
      avatar_url: avatarUrl,
      username,
      auth_user_id: authUserId,
    };
  },
});

export const getAIModel = query({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    return await ctx.db
      .query("ai_models")
      .withIndex("by_model_id", (q) => q.eq("id", modelId))
      .unique();
  },
});

export const getConversationAIModels = query({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const rows = await ctx.db
      .query("conversation_ai_models")
      .withIndex("by_conversation_active", (q) =>
        q.eq("conversation_id", conversationId).eq("is_active", true)
      )
      .collect();
    if (!rows.length) return [];
    const modelMap = await buildModelMap(ctx);
    return rows
      .map((row) => modelMap[row.ai_model_id])
      .filter(Boolean);
  },
});

export const getMessages = query({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, userId }) => {
    await requireConversationAccess(ctx, conversationId, userId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversation_id", conversationId)
      )
      .order("asc")
      .collect();
    if (!messages.length) return [];
    const modelMap = await buildModelMap(ctx);
    return messages.map((msg) => ({
      ...msg,
      ai_models: msg.ai_model_id ? modelMap[msg.ai_model_id] || null : null,
    }));
  },
});

export const getAllMessagesForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user_created_at", (q) => q.eq("user_id", userId))
      .order("asc")
      .collect();
    if (!messages.length) return [];
    const modelMap = await buildModelMap(ctx);
    return messages.map((msg) => ({
      ...msg,
      ai_models: msg.ai_model_id ? modelMap[msg.ai_model_id] || null : null,
    }));
  },
});

export const getConversationContext = query({
  args: {
    conversationId: v.string(),
    limit: v.number(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, limit, userId }) => {
    await requireConversationAccess(ctx, conversationId, userId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversation_id", conversationId)
      )
      .order("desc")
      .take(limit);
    const modelMap = await buildModelMap(ctx);
    return messages
      .map((msg) => ({
        ...msg,
        ai_models: msg.ai_model_id ? modelMap[msg.ai_model_id] || null : null,
      }))
      .reverse();
  },
});

export const getMessageById = query({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db
      .query("messages")
      .withIndex("by_message_id", (q) => q.eq("id", messageId))
      .unique();
    if (!msg) return null;
    const modelMap = await buildModelMap(ctx);
    return {
      ...msg,
      ai_models: msg.ai_model_id ? modelMap[msg.ai_model_id] || null : null,
    };
  },
});

export const getConversationDetails = query({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, userId }) => {
    await requireConversationAccess(ctx, conversationId, userId);
    return await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("id", conversationId))
      .unique();
  },
});

export const getConversationsForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const participantRows = await ctx.db
      .query("conversation_participants")
      .withIndex("by_user_active", (q) => q.eq("user_id", userId).eq("is_active", true))
      .collect();
    if (!participantRows.length) return [];

    const conversations = [];
    for (const row of participantRows) {
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_conversation_id", (q) => q.eq("id", row.conversation_id))
        .unique();
      if (conversation) {
        conversations.push({
          ...conversation,
          participant_role: row.role || "member",
        });
      }
    }

    conversations.sort((a, b) => {
      const left = a.updated_at || a.created_at;
      const right = b.updated_at || b.created_at;
      return right.localeCompare(left);
    });

    return conversations;
  },
});

export const getLastMessagesForConversations = query({
  args: { conversationIds: v.array(v.string()) },
  handler: async (ctx, { conversationIds }) => {
    const result = {};
    if (!conversationIds.length) return result;
    const modelMap = await buildModelMap(ctx);

    for (const conversationId of conversationIds) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_created_at", (q) =>
          q.eq("conversation_id", conversationId)
        )
        .order("desc")
        .take(1);
      const message = messages[0];
      if (message) {
        result[conversationId] = {
          ...message,
          ai_models: message.ai_model_id
            ? modelMap[message.ai_model_id] || null
            : null,
        };
      }
    }

    return result;
  },
});

export const getUserPrompts = query({
  args: {
    userId: v.string(),
    promptType: v.optional(v.string()),
  },
  handler: async (ctx, { userId, promptType }) => {
    if (promptType) {
      return await ctx.db
        .query("user_prompts")
        .withIndex("by_user_type_active_created_at", (q) =>
          q.eq("user_id", userId).eq("prompt_type", promptType).eq("is_active", true)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("user_prompts")
      .withIndex("by_user_active_created_at", (q) =>
        q.eq("user_id", userId).eq("is_active", true)
      )
      .order("desc")
      .collect();
  },
});

export const getConversationMessages = query({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversation_id", conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const upsertAiModels = mutation({
  args: {
    models: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        display_name: v.optional(v.string()),
        avatar: v.optional(v.string()),
        provider: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { models }) => {
    for (const model of models) {
      const existing = await ctx.db
        .query("ai_models")
        .withIndex("by_model_id", (q) => q.eq("id", model.id))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...model,
          is_active: true,
        });
      } else {
        await ctx.db.insert("ai_models", {
          ...model,
          is_active: true,
          created_at: new Date().toISOString(),
          capabilities: {},
        });
      }
    }
    return true;
  },
});

export const createConversationForUser = mutation({
  args: {
    conversationId: v.string(),
    userId: v.string(),
    title: v.string(),
    defaultModelIds: v.array(v.string()),
  },
  handler: async (ctx, { conversationId, userId, title, defaultModelIds }) => {
    const now = new Date().toISOString();

    await ctx.db.insert("conversations", {
      id: conversationId,
      title,
      created_by: userId,
      created_at: now,
      updated_at: now,
      last_message_at: now,
      is_active: true,
      settings: {},
    });

    const existingParticipant = await ctx.db
      .query("conversation_participants")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversation_id", conversationId).eq("user_id", userId)
      )
      .unique();

    if (!existingParticipant) {
      await ctx.db.insert("conversation_participants", {
        conversation_id: conversationId,
        user_id: userId,
        role: "admin",
        joined_at: now,
        is_active: true,
      });
    } else if (!existingParticipant.is_active) {
      await ctx.db.patch(existingParticipant._id, { is_active: true });
    }

    for (const modelId of defaultModelIds) {
      const existingModelLink = await ctx.db
        .query("conversation_ai_models")
        .withIndex("by_conversation_ai_model", (q) =>
          q.eq("conversation_id", conversationId).eq("ai_model_id", modelId)
        )
        .unique();
      if (!existingModelLink) {
        await ctx.db.insert("conversation_ai_models", {
          conversation_id: conversationId,
          ai_model_id: modelId,
          is_active: true,
          added_at: now,
          settings: {},
        });
      }
    }

    await ctx.db.insert("messages", {
      id: `${conversationId}-welcome`,
      conversation_id: conversationId,
      sender_type: "system",
      content:
        "Welcome to the AI Group Chat! Select a First Responder and ask a question to begin.",
      created_at: now,
    });

    return {
      id: conversationId,
      title,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };
  },
});

export const updateConversationTitle = mutation({
  args: {
    conversationId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { conversationId, title }) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("id", conversationId))
      .unique();
    if (!conversation) {
      throw new Error("conversation_not_found");
    }
    await ctx.db.patch(conversation._id, {
      title,
      updated_at: new Date().toISOString(),
    });
    return true;
  },
});

export const updateConversationTimestamp = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("id", conversationId))
      .unique();
    if (!conversation) return false;
    const now = new Date().toISOString();
    await ctx.db.patch(conversation._id, {
      last_message_at: now,
      updated_at: now,
    });
    return true;
  },
});

export const updateConversationMode = mutation({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("id", conversationId))
      .unique();
    if (!conversation) return false;
    await ctx.db.patch(conversation._id, {
      updated_at: new Date().toISOString(),
    });
    return true;
  },
});

export const createUserMessage = mutation({
  args: {
    id: v.string(),
    conversation_id: v.string(),
    sender_type: v.string(),
    sender_id: v.optional(v.string()),
    user_id: v.optional(v.string()),
    content: v.string(),
    created_at: v.string(),
    metadata: v.optional(v.any()),
    content_type: v.optional(v.string()),
    parent_message_id: v.optional(v.string()),
    is_first_responder: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", args);
    return args;
  },
});

export const createAIMessage = mutation({
  args: {
    id: v.string(),
    conversation_id: v.string(),
    sender_type: v.string(),
    ai_model_id: v.string(),
    user_id: v.optional(v.string()),
    content: v.string(),
    created_at: v.string(),
    metadata: v.optional(v.any()),
    content_type: v.optional(v.string()),
    parent_message_id: v.optional(v.string()),
    is_first_responder: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", args);
    return args;
  },
});

export const createSystemMessage = mutation({
  args: {
    id: v.string(),
    conversation_id: v.string(),
    content: v.string(),
    created_at: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      ...args,
      sender_type: "system",
    });
    return args;
  },
});

export const softDeleteConversation = mutation({
  args: { conversationId: v.string(), userId: v.string() },
  handler: async (ctx, { conversationId, userId }) => {
    const participant = await ctx.db
      .query("conversation_participants")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversation_id", conversationId).eq("user_id", userId)
      )
      .unique();

    if (!participant) {
      throw new Error("conversation_not_found");
    }

    await ctx.db.patch(participant._id, { is_active: false });
    return true;
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.string(), userId: v.string() },
  handler: async (ctx, { conversationId, userId }) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("id", conversationId))
      .unique();
    if (!conversation) {
      throw new Error("conversation_not_found");
    }

    if (conversation.created_by && conversation.created_by !== userId) {
      throw new Error("conversation_delete_forbidden");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversation_id", conversationId)
      )
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    const participants = await ctx.db
      .query("conversation_participants")
      .withIndex("by_conversation_user", (q) => q.eq("conversation_id", conversationId))
      .collect();
    for (const participant of participants) {
      await ctx.db.delete(participant._id);
    }

    const modelLinks = await ctx.db
      .query("conversation_ai_models")
      .withIndex("by_conversation_ai_model", (q) =>
        q.eq("conversation_id", conversationId)
      )
      .collect();
    for (const link of modelLinks) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(conversation._id);
    return true;
  },
});

export const createUser = mutation({
  args: {
    id: v.string(),
    username: v.string(),
    email: v.optional(v.string()),
    display_name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("users", args);
    return args;
  },
});

export const updateUserAvatar = mutation({
  args: { userId: v.string(), avatarUrl: v.string() },
  handler: async (ctx, { userId, avatarUrl }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_legacy_id", (q) => q.eq("id", userId))
      .unique();
    if (!user) throw new Error("user_not_found");
    await ctx.db.patch(user._id, {
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });
    return true;
  },
});

export const updateUserDisplayName = mutation({
  args: { userId: v.string(), displayName: v.string() },
  handler: async (ctx, { userId, displayName }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_legacy_id", (q) => q.eq("id", userId))
      .unique();
    if (!user) throw new Error("user_not_found");
    await ctx.db.patch(user._id, {
      display_name: displayName,
      updated_at: new Date().toISOString(),
    });
    return true;
  },
});

export const updateConversationAvatar = mutation({
  args: { conversationId: v.string(), avatarUrl: v.string() },
  handler: async (ctx, { conversationId, avatarUrl }) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q) => q.eq("id", conversationId))
      .unique();
    if (!conversation) throw new Error("conversation_not_found");
    const currentSettings = conversation.settings || {};
    await ctx.db.patch(conversation._id, {
      settings: { ...currentSettings, avatar_url: avatarUrl },
      updated_at: new Date().toISOString(),
    });
    return true;
  },
});

export const createUserPrompt = mutation({
  args: {
    id: v.string(),
    user_id: v.string(),
    prompt_type: v.string(),
    title: v.string(),
    content: v.string(),
    is_default: v.optional(v.boolean()),
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.is_default) {
      const existingDefaults = await ctx.db
        .query("user_prompts")
        .withIndex("by_user_type_default", (q) =>
          q
            .eq("user_id", args.user_id)
            .eq("prompt_type", args.prompt_type)
            .eq("is_default", true)
        )
        .collect();
      for (const prompt of existingDefaults) {
        await ctx.db.patch(prompt._id, { is_default: false });
      }
    }

    await ctx.db.insert("user_prompts", args);
    return args;
  },
});

export const updateUserPrompt = mutation({
  args: {
    userId: v.string(),
    promptId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, { userId, promptId, updates }) => {
    const prompt = await ctx.db
      .query("user_prompts")
      .withIndex("by_prompt_id", (q) => q.eq("id", promptId))
      .unique();
    if (!prompt || prompt.user_id !== userId) {
      throw new Error("prompt_not_found");
    }

    if (updates?.is_default === true) {
      const existingDefaults = await ctx.db
        .query("user_prompts")
        .withIndex("by_user_type_default", (q) =>
          q
            .eq("user_id", userId)
            .eq("prompt_type", prompt.prompt_type)
            .eq("is_default", true)
        )
        .collect();
      for (const existing of existingDefaults) {
        await ctx.db.patch(existing._id, { is_default: false });
      }
    }

    await ctx.db.patch(prompt._id, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
    return true;
  },
});

export const deleteUserPrompt = mutation({
  args: { userId: v.string(), promptId: v.string() },
  handler: async (ctx, { userId, promptId }) => {
    const prompt = await ctx.db
      .query("user_prompts")
      .withIndex("by_prompt_id", (q) => q.eq("id", promptId))
      .unique();
    if (!prompt || prompt.user_id !== userId) {
      throw new Error("prompt_not_found");
    }
    await ctx.db.delete(prompt._id);
    return true;
  },
});

export const importUsers = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        username: v.string(),
        email: v.optional(v.string()),
        display_name: v.optional(v.string()),
        avatar_url: v.optional(v.string()),
        created_at: v.string(),
        updated_at: v.string(),
        is_active: v.boolean(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_legacy_id", (q) => q.eq("id", item.id))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("users", item);
      }
    }
    return true;
  },
});

export const importAiModels = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        display_name: v.optional(v.string()),
        avatar: v.optional(v.string()),
        provider: v.optional(v.string()),
        is_active: v.boolean(),
        capabilities: v.optional(v.any()),
        created_at: v.string(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("ai_models")
        .withIndex("by_model_id", (q) => q.eq("id", item.id))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("ai_models", item);
      }
    }
    return true;
  },
});

export const importConversations = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        title: v.optional(v.string()),
        created_by: v.optional(v.string()),
        created_at: v.string(),
        updated_at: v.string(),
        last_message_at: v.optional(v.string()),
        is_active: v.boolean(),
        settings: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_conversation_id", (q) => q.eq("id", item.id))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("conversations", item);
      }
    }
    return true;
  },
});

export const importConversationParticipants = mutation({
  args: {
    items: v.array(
      v.object({
        conversation_id: v.string(),
        user_id: v.string(),
        joined_at: v.string(),
        role: v.string(),
        is_active: v.boolean(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("conversation_participants")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversation_id", item.conversation_id).eq("user_id", item.user_id)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("conversation_participants", item);
      }
    }
    return true;
  },
});

export const importConversationAiModels = mutation({
  args: {
    items: v.array(
      v.object({
        conversation_id: v.string(),
        ai_model_id: v.string(),
        is_active: v.boolean(),
        added_at: v.string(),
        settings: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("conversation_ai_models")
        .withIndex("by_conversation_ai_model", (q) =>
          q
            .eq("conversation_id", item.conversation_id)
            .eq("ai_model_id", item.ai_model_id)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("conversation_ai_models", item);
      }
    }
    return true;
  },
});

export const importMessages = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        conversation_id: v.string(),
        sender_type: v.string(),
        sender_id: v.optional(v.string()),
        ai_model_id: v.optional(v.string()),
        user_id: v.optional(v.string()),
        content: v.string(),
        content_type: v.optional(v.string()),
        created_at: v.string(),
        metadata: v.optional(v.any()),
        parent_message_id: v.optional(v.string()),
        is_first_responder: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_message_id", (q) => q.eq("id", item.id))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("messages", item);
      }
    }
    return true;
  },
});

export const importUserPrompts = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        user_id: v.string(),
        prompt_type: v.string(),
        title: v.string(),
        content: v.string(),
        is_default: v.optional(v.boolean()),
        is_active: v.boolean(),
        created_at: v.string(),
        updated_at: v.string(),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) {
      const existing = await ctx.db
        .query("user_prompts")
        .withIndex("by_prompt_id", (q) => q.eq("id", item.id))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { ...item });
      } else {
        await ctx.db.insert("user_prompts", item);
      }
    }
    return true;
  },
});
