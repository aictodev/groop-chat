export const MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude" },
  { id: "meta-llama/llama-3-8b-instruct", name: "Llama" },
  { id: "deepseek/deepseek-v3.2-speciale", name: "DeepSeek V3.2" },
  { id: "qwen/qwen3-max-thinking", name: "Qwen3 Max" },
  { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5" },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast" },
];

const PROVIDER_ALIASES = {
  "meta-llama": "meta",
  xai: "x-ai",
};

export const getProviderIdFromModel = (modelId = "") => {
  if (typeof modelId !== "string" || !modelId.includes("/")) {
    return "default";
  }
  const [provider] = modelId.split("/");
  return PROVIDER_ALIASES[provider] || provider;
};
