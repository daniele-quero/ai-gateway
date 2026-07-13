/**
 * Chat orchestration shared by chat/complete/vision/model endpoints.
 * Handles provider fallback: for non-streaming, tries candidates in order;
 * for streaming, falls back only until the first token is emitted.
 */

import { getConfig } from "./config.js";
import { GatewayError } from "./errors.js";
import { resolveModel, type ResolvedModel } from "./providerRegistry.js";
import type { StreamSource } from "./sse.js";
import type {
  GatewayChatMessage,
  ProviderCapability,
  ProviderChatRequest,
  ProviderChatResponse,
} from "./providers/types.js";

export interface ChatServiceRequest {
  model: string;
  messages: GatewayChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  capability: ProviderCapability;
  signal?: AbortSignal;
}

function toProviderRequest(candidate: ResolvedModel, request: ChatServiceRequest): ProviderChatRequest {
  const maxOutputTokens = request.maxOutputTokens ?? candidate.definition.defaultMaxOutputTokens;
  const providerRequest: ProviderChatRequest = {
    model: candidate.definition.model,
    messages: request.messages,
  };
  if (typeof request.temperature === "number") {
    providerRequest.temperature = request.temperature;
  }
  if (maxOutputTokens > 0) {
    providerRequest.maxOutputTokens = maxOutputTokens;
  }
  if (request.signal) {
    providerRequest.signal = request.signal;
  }
  return providerRequest;
}

/**
 * Non-streaming chat with sequential fallback across candidates.
 */
export async function runChat(request: ChatServiceRequest): Promise<ProviderChatResponse> {
  const candidates = resolveModel(request.model, request.capability);
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await candidate.adapter.chat(toProviderRequest(candidate, request));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof GatewayError
    ? lastError
    : new GatewayError("UPSTREAM_ERROR", "All providers failed");
}

/**
 * Builds an SSE StreamSource. Fallback is attempted only before the first
 * token. After the first token, errors propagate to the SSE error event.
 */
export async function runChatStream(request: ChatServiceRequest): Promise<StreamSource> {
  const candidates = resolveModel(request.model, request.capability);
  const firstTokenTimeoutMs = getConfig().timeouts.firstTokenMs;

  let lastError: unknown;
  for (const candidate of candidates) {
    if (!candidate.adapter.streamChat) {
      continue;
    }
    const providerRequest = toProviderRequest(candidate, request);
    const generator = candidate.adapter.streamChat(providerRequest);
    try {
      const first = await withTimeout(generator.next(), firstTokenTimeoutMs);
      if (first.done) {
        // Empty stream: treat as a successful but empty response.
        return {
          meta: { provider: candidate.adapter.id, model: candidate.definition.model },
          deltas: emptyGenerator(),
        };
      }
      return {
        meta: { provider: candidate.adapter.id, model: candidate.definition.model },
        deltas: prepend(first.value, generator),
      };
    } catch (err) {
      lastError = err;
      // Try the next candidate: nothing was streamed yet.
    }
  }
  throw lastError instanceof GatewayError
    ? lastError
    : new GatewayError("PROVIDER_UNAVAILABLE", "No streaming provider produced a first token");
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GatewayError("TIMEOUT", "First token timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function* prepend(first: string, rest: AsyncGenerator<string>): AsyncGenerator<string> {
  yield first;
  for await (const chunk of rest) {
    yield chunk;
  }
}

// eslint-disable-next-line require-yield
async function* emptyGenerator(): AsyncGenerator<string> {
  return;
}
