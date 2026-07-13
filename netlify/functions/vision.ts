/**
 * POST /api/vision — multimodal chat with image input. Uses the same chat
 * pipeline but requires the 'vision' capability. Never logs base64 payloads.
 */

import type { Config } from "@netlify/functions";
import { runChat, runChatStream } from "./lib/chatService.js";
import { withApp } from "./lib/handler.js";
import { jsonResponse, parseJsonBody } from "./lib/http.js";
import { sseResponse } from "./lib/sse.js";
import { validateChatRequest } from "./lib/validation.js";

export default withApp({ method: "POST", capability: "vision" }, async (req, ctx) => {
  const body = validateChatRequest(await parseJsonBody(req));

  if (body.stream) {
    const source = await runChatStream({
      model: body.model,
      messages: body.messages,
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
      ...(body.maxOutputTokens !== undefined ? { maxOutputTokens: body.maxOutputTokens } : {}),
      capability: "vision",
      signal: req.signal,
    });
    return sseResponse(source, { extraHeaders: ctx.corsHeaders });
  }

  const result = await runChat({
    model: body.model,
    messages: body.messages,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.maxOutputTokens !== undefined ? { maxOutputTokens: body.maxOutputTokens } : {}),
    capability: "vision",
    signal: req.signal,
  });
  return jsonResponse(result, 200, ctx.corsHeaders);
});

export const config: Config = {
  path: "/api/vision",
};
