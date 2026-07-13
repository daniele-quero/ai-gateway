/**
 * POST /api/model/<modelAlias> — dedicated endpoint template for a specific
 * model. The alias is read from the path (preferred) or the request body and
 * resolved through the model registry.
 */

import type { Config } from "@netlify/functions";
import { runChat, runChatStream } from "./lib/chatService.js";
import { GatewayError } from "./lib/errors.js";
import { withApp } from "./lib/handler.js";
import { jsonResponse, parseJsonBody } from "./lib/http.js";
import { sseResponse } from "./lib/sse.js";
import { validateMessages, optionalBoolean, optionalNumber } from "./lib/validation.js";

function aliasFromPath(url: string): string | undefined {
  const path = new URL(url).pathname.replace(/\/+$/, "");
  const match = /\/model\/([^/]+)$/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export default withApp({ method: "POST", capability: "chat" }, async (req, ctx) => {
  const raw = (await parseJsonBody(req)) as Record<string, unknown>;
  const model = aliasFromPath(req.url) ?? (typeof raw.model === "string" ? raw.model : undefined);
  if (!model) {
    throw new GatewayError("INVALID_REQUEST", "Missing model alias in path or body");
  }

  const messages = validateMessages(raw.messages);
  const stream = optionalBoolean(raw.stream, "stream") ?? false;
  const temperature = optionalNumber(raw.temperature, "temperature");
  const maxOutputTokens = optionalNumber(raw.maxOutputTokens, "maxOutputTokens");

  if (stream) {
    const source = await runChatStream({
      model,
      messages,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      capability: "streaming",
      signal: req.signal,
    });
    return sseResponse(source, { extraHeaders: ctx.corsHeaders });
  }

  const result = await runChat({
    model,
    messages,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    capability: "chat",
    signal: req.signal,
  });
  return jsonResponse(result, 200, ctx.corsHeaders);
});

export const config: Config = {
  path: "/api/model/:alias",
};
