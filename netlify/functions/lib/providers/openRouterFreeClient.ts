/**
 * OpenRouter adapter for models available on the free tier.
 * Token: OPENROUTER_FREE_API_KEY.
 */

import { getConfig } from "../config.js";
import { GatewayError } from "../errors.js";
import {
  openAiChat,
  openAiEmbeddings,
  openAiStreamChat,
  type OpenAiCompatibleConfig,
} from "./openaiCompatible.js";
import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderChatRequest,
  ProviderChatResponse,
  ProviderEmbeddingsRequest,
} from "./types.js";

const API_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterFreeClient implements ProviderAdapter {
  readonly id = "openrouter-free";
  readonly label = "OpenRouter Free";

  isAvailable(): boolean {
    return Boolean(getConfig().providers.openRouterApiKey);
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return capability === "chat" || capability === "streaming" || capability === "vision" || capability === "embeddings";
  }

  private clientConfig(): OpenAiCompatibleConfig {
    const token = getConfig().providers.openRouterApiKey;
    if (!token) {
      throw new GatewayError("PROVIDER_UNAVAILABLE", "OpenRouter API key is not configured");
    }
    return { providerId: this.id, endpoint: `${API_BASE}/chat/completions`, token };
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const text = await openAiChat(this.clientConfig(), request);
    return { provider: this.id, model: request.model, text };
  }

  streamChat(request: ProviderChatRequest): AsyncGenerator<string> {
    return openAiStreamChat(this.clientConfig(), request);
  }

  async embeddings(request: ProviderEmbeddingsRequest): Promise<number[][]> {
    const config = this.clientConfig();
    return openAiEmbeddings(`${API_BASE}/embeddings`, config.token, this.id, request.model, request.input, request.signal);
  }
}