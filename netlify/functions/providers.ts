/**
 * GET /api/providers — protected by app API key.
 * Lists providers and models without revealing any secret.
 */

import type { Config } from "@netlify/functions";
import { withApp } from "./lib/handler.js";
import { jsonResponse } from "./lib/http.js";
import { listAdapters } from "./lib/providerRegistry.js";
import { MODEL_REGISTRY, type ModelAlias } from "./lib/models/registry.js";
import { getAdapter } from "./lib/providerRegistry.js";

export default withApp({ method: "GET", capability: "models" }, async (_req, ctx) => {
  const providers = listAdapters().map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    available: adapter.isAvailable(),
  }));

  const models = (Object.keys(MODEL_REGISTRY) as ModelAlias[]).map((alias) => {
    const def = MODEL_REGISTRY[alias];
    return {
      id: `${def.provider}:${def.model}`,
      alias,
      provider: def.provider,
      model: def.model,
      capabilities: def.capabilities,
      available: getAdapter(def.provider).isAvailable(),
    };
  });

  return jsonResponse({ providers, models }, 200, ctx.corsHeaders);
});

export const config: Config = {
  path: "/api/providers",
};
