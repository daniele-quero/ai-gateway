/**
 * Model registry: maps gateway model aliases to provider-native models.
 * Extend this map to add new models. The exact production model list is
 * expected to evolve; these entries are a configurable starting template.
 */

import type { ProviderCapability } from "../providers/types.js";

export type ProviderId = "google" | "groq" | "openrouter-free" | "template";

export interface ModelDefinition {
  provider: ProviderId;
  /** Provider-native model identifier. */
  model: string;
  capabilities: ProviderCapability[];
  defaultMaxOutputTokens: number;
}

export const MODEL_REGISTRY = {
  // Google Gemini models used by the gateway. Keep the registry aligned with
  // the IDs that Gemini actually accepts; unsupported 3.x names will trigger
  // 404s upstream.
  "gemini-2-0-flash": {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-0-flash-lite": {
    provider: "google",
    model: "gemini-2.0-flash-lite",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-0-pro": {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  // Backward-compatible aliases kept for older clients using the 2.5 naming.
  "gemini-2-5-flash": {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-5-flash-lite": {
    provider: "google",
    model: "gemini-2.0-flash-lite",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-5-pro": {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-embedding": {
    provider: "google",
    model: "gemini-embedding-001",
    capabilities: ["embeddings"],
    defaultMaxOutputTokens: 0,
  },
  // Groq models, screened to 2 per family (groq / llama / openai / qwen).
  "groq-compound": {
    provider: "groq",
    model: "groq/compound",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "groq-compound-mini": {
    provider: "groq",
    model: "groq/compound-mini",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "groq-llama-70b": {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "groq-llama-4-scout": {
    provider: "groq",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "groq-gpt-oss-120b": {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "groq-gpt-oss-20b": {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "groq-qwen-32b": {
    provider: "groq",
    model: "qwen/qwen3-32b",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "groq-qwen-3-6-27b": {
    provider: "groq",
    model: "qwen/qwen3.6-27b",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  // OpenRouter free-tier models. Aliases intentionally omit the `free` suffix.
  "openrouter-lfm-2-5-2-6b": {
    provider: "openrouter-free",
    model: "liquid/lfm-2.5-2.6b:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-3-5-lightning": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-3.5-lightning:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-ling-3-0-tiny": {
    provider: "openrouter-free",
    model: "inclusionai/ling-3.0-tiny:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-laguna-s-2-1": {
    provider: "openrouter-free",
    model: "poolside/laguna-s-2.1:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-laguna-xs-2-1": {
    provider: "openrouter-free",
    model: "poolside/laguna-xs-2.1:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-north-mini-code": {
    provider: "openrouter-free",
    model: "cohere/north-mini-code:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-3-ultra": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-3-nano-omni": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-gemma-4-26b-a4b": {
    provider: "openrouter-free",
    model: "google/gemma-4-26b-a4b-it:free",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-gemma-4-31b": {
    provider: "openrouter-free",
    model: "google/gemma-4-31b-it:free",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-3-super": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-3-nano-30b-a3b": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-3-nano-30b-a3b:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-nano-12b-v2-vl": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-nano-12b-v2-vl:free",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-nano-9b-v2": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-nano-9b-v2:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-gpt-oss-20b": {
    provider: "openrouter-free",
    model: "openai/gpt-oss-20b:free",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "openrouter-nemotron-3-embed-1b": {
    provider: "openrouter-free",
    model: "nvidia/nemotron-3-embed-1b-v2:free",
    capabilities: ["embeddings"],
    defaultMaxOutputTokens: 0,
  },
  "openrouter-llama-nemotron-embed-vl-1b-v2": {
    provider: "openrouter-free",
    model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    capabilities: ["embeddings"],
    defaultMaxOutputTokens: 0,
  },
  "template-model": {
    provider: "template",
    model: "provider/model-name",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
} as const satisfies Record<string, ModelDefinition>;

export type ModelAlias = keyof typeof MODEL_REGISTRY;

/**
 * Abstract routing aliases. Each maps to an ordered list of concrete model
 * aliases; the first available one is used, the rest act as fallbacks.
 */
const VISION_MODELS = [
  // Prefer the stable Gemini 2.0 family for production vision tasks; these are
  // the model IDs Google accepts in the current API surface.
  "gemini-2-0-pro",
  "gemini-2-0-flash",
  "gemini-2-0-flash-lite",
  // Remaining candidates follow a speed-oriented fallback chain: Groq first,
  // then the faster OpenRouter multimodal models, ending with slower alternatives.
  "groq-llama-4-scout",
  "groq-qwen-3-6-27b",
  "openrouter-gemma-4-31b",
  "openrouter-gemma-4-26b-a4b",
  "openrouter-nemotron-nano-12b-v2-vl",
  "openrouter-nemotron-3-nano-omni",
] as const satisfies ModelAlias[];

export const ROUTES = {
  "auto:fast": ["groq-llama-70b", "gemini-2-0-flash-lite"],
  "auto:balanced": [
    "gemini-2-0-flash",
    "groq-llama-70b",
    "gemini-2-0-flash-lite",
    "groq-compound-mini",
    "openrouter-nemotron-3-5-lightning",
    "openrouter-gpt-oss-20b",
    "openrouter-gemma-4-31b",
    "openrouter-gemma-4-26b-a4b",
    "openrouter-nemotron-3-super",
    "openrouter-nemotron-3-nano-30b-a3b",
    "openrouter-nemotron-nano-12b-v2-vl",
    "openrouter-nemotron-nano-9b-v2",
    "openrouter-nemotron-3-nano-omni",
    "openrouter-laguna-s-2-1",
    "openrouter-lfm-2-5-2-6b",
    "openrouter-ling-3-0-tiny",
    "openrouter-laguna-xs-2-1",
    "openrouter-north-mini-code",
    "openrouter-nemotron-3-ultra",
  ],
  "auto:quality": ["gemini-2-0-pro", "gemini-2-0-flash"],
  "auto:reasoning": ["gemini-2-0-pro", "gemini-2-0-flash"],
  "auto:vision": VISION_MODELS,
  "auto:embedding": ["gemini-embedding"],
} as const satisfies Record<string, readonly ModelAlias[]>;

export type RouteAlias = keyof typeof ROUTES;

export function isRouteAlias(value: string): value is RouteAlias {
  return value in ROUTES;
}

export function isModelAlias(value: string): value is ModelAlias {
  return value in MODEL_REGISTRY;
}

export function getModelDefinition(alias: ModelAlias): ModelDefinition {
  return MODEL_REGISTRY[alias];
}

/**
 * Resolves a requested model string into an ordered list of candidate model
 * aliases. Route aliases expand to their fallback chain; a concrete alias
 * resolves to a single-element list.
 */
export function resolveCandidates(requested: string): ModelAlias[] {
  if (isRouteAlias(requested)) {
    return [...ROUTES[requested]];
  }
  if (isModelAlias(requested)) {
    return [requested];
  }
  return [];
}
