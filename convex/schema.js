import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    id: v.optional(v.string()),
    username: v.optional(v.string()),
    display_name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    created_at: v.optional(v.string()),
    updated_at: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_legacy_id", ["id"]),

  conversations: defineTable({
    id: v.string(),
    title: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
    last_message_at: v.optional(v.string()),
    is_active: v.boolean(),
    settings: v.optional(v.any()),
  })
    .index("by_conversation_id", ["id"])
    .index("by_created_by", ["created_by"])
    .index("by_last_message_at", ["last_message_at"]),

  ai_models: defineTable({
    id: v.string(),
    name: v.string(),
    display_name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    provider: v.optional(v.string()),
    is_active: v.boolean(),
    capabilities: v.optional(v.any()),
    created_at: v.string(),
  })
    .index("by_model_id", ["id"])
    .index("by_active", ["is_active"]),

  messages: defineTable({
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
    .index("by_message_id", ["id"])
    .index("by_conversation_created_at", ["conversation_id", "created_at"])
    .index("by_user_created_at", ["user_id", "created_at"]),

  conversation_participants: defineTable({
    conversation_id: v.string(),
    user_id: v.string(),
    joined_at: v.string(),
    role: v.string(),
    is_active: v.boolean(),
  })
    .index("by_conversation_user", ["conversation_id", "user_id"])
    .index("by_conversation_user_active", ["conversation_id", "user_id", "is_active"])
    .index("by_user_active", ["user_id", "is_active"])
    .index("by_conversation_active", ["conversation_id", "is_active"]),

  conversation_ai_models: defineTable({
    conversation_id: v.string(),
    ai_model_id: v.string(),
    is_active: v.boolean(),
    added_at: v.string(),
    settings: v.optional(v.any()),
  })
    .index("by_conversation_ai_model", ["conversation_id", "ai_model_id"])
    .index("by_conversation_active", ["conversation_id", "is_active"])
    .index("by_ai_model", ["ai_model_id"]),

  user_prompts: defineTable({
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
    .index("by_prompt_id", ["id"])
    .index("by_user", ["user_id"])
    .index("by_user_active_created_at", ["user_id", "is_active", "created_at"])
    .index(
      "by_user_type_active_created_at",
      ["user_id", "prompt_type", "is_active", "created_at"]
    )
    .index("by_user_type_default", ["user_id", "prompt_type", "is_default"]),
});
