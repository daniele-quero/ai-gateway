/**
 * POST /api/complete — single-turn convenience wrapper over chat.
 */

import type { Config } from "@netlify/functions";
import { runChat, runChatStream } from "./lib/chatService.js";
import { withApp } from "./lib/handler.js";
import { jsonResponse, parseJsonBody } from "./lib/http.js";
import { sseResponse } from "./lib/sse.js";
import { validateCompleteRequest } from "./lib/validation.js";
import type { GatewayChatMessage } from "./lib/providers/types.js";

export default withApp({ method: "POST", capability: "complete" }, async (req, ctx) => {
  const body = validateCompleteRequest(await parseJsonBody(req));

  const messages: GatewayChatMessage[] = [];
  if (body.system) {
    messages.push({ role: "system", content: body.system });
  }
  messages.push({ role: "user", content: body.input });

  if (body.stream) {
    const source = await runChatStream({
      model: body.model,
      messages,
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
      ...(body.maxOutputTokens !== undefined ? { maxOutputTokens: body.maxOutputTokens } : {}),
      capability: "streaming",
      signal: req.signal,
    });
    return sseResponse(source, { extraHeaders: ctx.corsHeaders });
  }

  const result = await runChat({
    model: body.model,
    messages,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.maxOutputTokens !== undefined ? { maxOutputTokens: body.maxOutputTokens } : {}),
    capability: "chat",
    signal: req.signal,
  });
  return jsonResponse(result, 200, ctx.corsHeaders);
});

export const config: Config = {
  path: "/api/complete",
};
