/**
 * AI Gateway TypeScript client.
 *
 * @example
 * const ai = createAiGatewayClient({
 *   baseUrl: "https://ai-gateway.example.netlify.app/api",
 *   apiKey: import.meta.env.VITE_AI_GATEWAY_KEY,
 * });
 * const reply = await ai.complete({ model: "auto:fast", input: "Ciao" });
 */

import { AiGatewayError, errorFromResponse } from "./errors.js";
import { consumeSseStream } from "./sse.js";
import type {
  AiGatewayClientOptions,
  ChatRequest,
  ChatResponse,
  CompleteRequest,
  EmbeddingsRequest,
  EmbeddingsResponse,
  ProvidersResponse,
  StreamCallbacks,
  VisionRequest,
} from "./types.js";

export * from "./types.js";
export { AiGatewayError } from "./errors.js";

export interface AiGatewayClient {
  health(): Promise<{ ok: boolean; service: string; version: string }>;
  providers(signal?: AbortSignal): Promise<ProvidersResponse>;
  chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  chatStream(request: ChatRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
  complete(request: CompleteRequest, signal?: AbortSignal): Promise<ChatResponse>;
  completeStream(request: CompleteRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
  vision(request: VisionRequest, signal?: AbortSignal): Promise<ChatResponse>;
  visionStream(request: VisionRequest, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
  embeddings(request: EmbeddingsRequest, signal?: AbortSignal): Promise<EmbeddingsResponse>;
}

export function createAiGatewayClient(options: AiGatewayClientOptions): AiGatewayClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation available");
  }

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    return (await response.json()) as T;
  }

  async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "GET",
      headers: authHeaders(),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    return (await response.json()) as T;
  }

  async function streamPost(
    path: string,
    body: unknown,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: { ...authHeaders(), Accept: "text/event-stream" },
      body: JSON.stringify({ ...(body as object), stream: true }),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    if (!response.body) {
      throw new AiGatewayError("INTERNAL_ERROR", "Streaming not supported by this environment", 500);
    }
    await consumeSseStream(response.body, callbacks);
  }

  return {
    health() {
      return getJson("/health");
    },
    providers(signal) {
      return getJson<ProvidersResponse>("/providers", signal);
    },
    chat(request, signal) {
      return postJson<ChatResponse>("/chat", { ...request, stream: false }, signal);
    },
    chatStream(request, callbacks, signal) {
      return streamPost("/chat", request, callbacks, signal);
    },
    complete(request, signal) {
      return postJson<ChatResponse>("/complete", { ...request, stream: false }, signal);
    },
    completeStream(request, callbacks, signal) {
      return streamPost("/complete", request, callbacks, signal);
    },
    vision(request, signal) {
      return postJson<ChatResponse>("/vision", { ...request, stream: false }, signal);
    },
    visionStream(request, callbacks, signal) {
      return streamPost("/vision", request, callbacks, signal);
    },
    embeddings(request, signal) {
      return postJson<EmbeddingsResponse>("/embeddings", request, signal);
    },
  };
}
