/**
 * Server-Sent Events helpers for streaming provider responses.
 *
 * Standard events:
 *   meta  -> { provider, model }
 *   delta -> { text }
 *   done  -> {}
 *   error -> { code, message }
 */

import type { GatewayErrorCode } from "./errors.js";

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export interface SseMeta {
  provider: string;
  model: string;
}

function formatEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export interface StreamSource {
  meta: SseMeta;
  /** Yields text deltas. Throwing after the first token emits an SSE error event. */
  deltas: AsyncGenerator<string>;
}

export interface BuildStreamOptions {
  extraHeaders?: Record<string, string>;
}

/**
 * Builds a Response streaming the given source as SSE.
 * A meta event is emitted first, followed by delta events, then done.
 * Any error during iteration is surfaced as an SSE error event.
 */
export function sseResponse(source: StreamSource, options: BuildStreamOptions = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(formatEvent("meta", source.meta)));
        for await (const text of source.deltas) {
          if (text.length === 0) {
            continue;
          }
          controller.enqueue(encoder.encode(formatEvent("delta", { text })));
        }
        controller.enqueue(encoder.encode(formatEvent("done", {})));
      } catch (err) {
        const code: GatewayErrorCode = "UPSTREAM_ERROR";
        const message = err instanceof Error ? err.message : "Stream interrupted";
        controller.enqueue(encoder.encode(formatEvent("error", { code, message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...SSE_HEADERS, ...(options.extraHeaders ?? {}) },
  });
}
