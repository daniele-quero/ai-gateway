/**
 * POST /api/embeddings — template embeddings endpoint.
 */

import type { Config } from "@netlify/functions";
import { withApp } from "./lib/handler.js";
import { GatewayError } from "./lib/errors.js";
import { jsonResponse, parseJsonBody } from "./lib/http.js";
import { resolveModel } from "./lib/providerRegistry.js";
import { validateEmbeddingsRequest } from "./lib/validation.js";

export default withApp({ method: "POST", capability: "embeddings" }, async (req, ctx) => {
  const body = validateEmbeddingsRequest(await parseJsonBody(req));
  const candidates = resolveModel(body.model, "embeddings");

  let lastError: unknown;
  for (const candidate of candidates) {
    if (!candidate.adapter.embeddings) {
      continue;
    }
    try {
      const vectors = await candidate.adapter.embeddings({
        model: candidate.definition.model,
        input: body.input,
        signal: req.signal,
      });
      const data = vectors.map((embedding, index) => ({ index, embedding }));
      return jsonResponse(
        { provider: candidate.adapter.id, model: candidate.definition.model, data },
        200,
        ctx.corsHeaders,
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof GatewayError
    ? lastError
    : new GatewayError("PROVIDER_UNAVAILABLE", "No embeddings provider available");
});

export const config: Config = {
  path: "/api/embeddings",
};
