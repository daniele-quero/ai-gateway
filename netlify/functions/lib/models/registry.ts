/**
 * Model registry: maps gateway model aliases to provider-native models.
 * Extend this map to add new models. The exact production model list is
 * expected to evolve; these entries are a configurable starting template.
 */

import type { ProviderCapability } from "../providers/types.js";

export type ProviderId = "github" | "google" | "groq" | "template";

export interface ModelDefinition {
  provider: ProviderId;
  /** Provider-native model identifier. */
  model: string;
  capabilities: ProviderCapability[];
  defaultMaxOutputTokens: number;
}

export const MODEL_REGISTRY = {
  "github-gpt-4-1-mini": {
    provider: "github",
    model: "openai/gpt-4.1-mini",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "github-gpt-4-1": {
    provider: "github",
    model: "openai/gpt-4.1",
    capabilities: ["chat", "streaming"],
    defaultMaxOutputTokens: 512,
  },
  "github-gpt-4o": {
    provider: "github",
    model: "openai/gpt-4o",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "github-text-embedding-3-small": {
    provider: "github",
    model: "openai/text-embedding-3-small",
    capabilities: ["embeddings"],
    defaultMaxOutputTokens: 0,
  },
  // Google Gemini free-tier models (all multimodal: accept image input).
  "gemini-3-5-flash": {
    provider: "google",
    model: "gemini-3.5-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-3-1-flash-lite": {
    provider: "google",
    model: "gemini-3.1-flash-lite",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-5-flash": {
    provider: "google",
    model: "gemini-2.5-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-5-flash-lite": {
    provider: "google",
    model: "gemini-2.5-flash-lite",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "gemini-2-5-pro": {
    provider: "google",
    model: "gemini-2.5-pro",
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
export const ROUTES = {
  "auto:fast": ["groq-llama-70b", "gemini-2-5-flash-lite", "github-gpt-4-1-mini"],
  "auto:balanced": ["gemini-2-5-flash", "github-gpt-4-1-mini", "groq-llama-70b"],
  "auto:quality": ["github-gpt-4-1", "gemini-2-5-pro", "gemini-3-5-flash"],
  "auto:reasoning": ["github-gpt-4-1", "gemini-2-5-pro"],
  "auto:vision": ["gemini-2-5-flash", "github-gpt-4o", "groq-llama-4-scout"],
  "auto:embedding": ["github-text-embedding-3-small", "gemini-embedding"],
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
