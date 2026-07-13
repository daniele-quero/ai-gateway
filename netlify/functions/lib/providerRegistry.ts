/**
 * Provider registry: instantiates adapters and resolves gateway model
 * requests into a concrete provider + model, honoring routing fallbacks.
 */

import { GatewayError } from "./errors.js";
import {
  getModelDefinition,
  resolveCandidates,
  type ModelAlias,
  type ModelDefinition,
  type ProviderId,
} from "./models/registry.js";
import { GeminiClient } from "./providers/geminiClient.js";
import { GithubModelsClient } from "./providers/githubModelsClient.js";
import { GroqClient } from "./providers/groqClient.js";
import { TemplateProviderClient } from "./providers/templateProviderClient.js";
import type { ProviderAdapter, ProviderCapability } from "./providers/types.js";

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  github: new GithubModelsClient(),
  google: new GeminiClient(),
  groq: new GroqClient(),
  template: new TemplateProviderClient(),
};

export function getAdapter(provider: ProviderId): ProviderAdapter {
  return ADAPTERS[provider];
}

export function listAdapters(): ProviderAdapter[] {
  return Object.values(ADAPTERS);
}

export interface ResolvedModel {
  alias: ModelAlias;
  definition: ModelDefinition;
  adapter: ProviderAdapter;
}

/**
 * Returns an ordered list of resolved candidates for a requested model,
 * filtered to those whose provider is available and supports the capability.
 * The first element is the primary choice; the rest are fallbacks.
 */
export function resolveModel(requested: string, capability: ProviderCapability): ResolvedModel[] {
  const candidates = resolveCandidates(requested);
  if (candidates.length === 0) {
    throw new GatewayError("MODEL_NOT_FOUND", `Unknown model or route: ${requested}`);
  }

  const resolved: ResolvedModel[] = [];
  for (const alias of candidates) {
    const definition = getModelDefinition(alias);
    const adapter = getAdapter(definition.provider);
    if (!definition.capabilities.includes(capability)) {
      continue;
    }
    if (!adapter.isAvailable()) {
      continue;
    }
    if (!adapter.supports(definition.model, capability)) {
      continue;
    }
    resolved.push({ alias, definition, adapter });
  }

  if (resolved.length === 0) {
    throw new GatewayError(
      "PROVIDER_UNAVAILABLE",
      `No available provider supports '${requested}' for capability '${capability}'`,
    );
  }
  return resolved;
}
