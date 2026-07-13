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
  "gemini-flash": {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: ["chat", "streaming", "vision"],
    defaultMaxOutputTokens: 512,
  },
  "groq-llama-70b": {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    capabilities: ["chat", "streaming"],
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
  "auto:fast": ["groq-llama-70b", "gemini-flash", "github-gpt-4-1-mini"],
  "auto:balanced": ["gemini-flash", "github-gpt-4-1-mini", "groq-llama-70b"],
  "auto:quality": ["github-gpt-4-1", "gemini-flash", "github-gpt-4-1-mini"],
  "auto:reasoning": ["github-gpt-4-1", "gemini-flash"],
  "auto:vision": ["gemini-flash", "github-gpt-4o"],
  "auto:embedding": ["github-text-embedding-3-small"],
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
