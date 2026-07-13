/**
 * GitHub Models adapter (OpenAI-compatible inference endpoint).
 * Token: GITHUB_MODELS_TOKEN with minimal GitHub Models permissions.
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

const CHAT_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const EMBEDDINGS_ENDPOINT = "https://models.github.ai/inference/embeddings";

export class GithubModelsClient implements ProviderAdapter {
  readonly id = "github";
  readonly label = "GitHub Models";

  isAvailable(): boolean {
    return Boolean(getConfig().providers.githubModelsToken);
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return capability === "chat" || capability === "streaming" || capability === "vision" || capability === "embeddings";
  }

  private clientConfig(): OpenAiCompatibleConfig {
    const token = getConfig().providers.githubModelsToken;
    if (!token) {
      throw new GatewayError("PROVIDER_UNAVAILABLE", "GitHub Models token is not configured");
    }
    return { providerId: this.id, endpoint: CHAT_ENDPOINT, token };
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const text = await openAiChat(this.clientConfig(), request);
    return { provider: this.id, model: request.model, text };
  }

  streamChat(request: ProviderChatRequest): AsyncGenerator<string> {
    return openAiStreamChat(this.clientConfig(), request);
  }

  async embeddings(request: ProviderEmbeddingsRequest): Promise<number[][]> {
    const token = getConfig().providers.githubModelsToken;
    if (!token) {
      throw new GatewayError("PROVIDER_UNAVAILABLE", "GitHub Models token is not configured");
    }
    return openAiEmbeddings(EMBEDDINGS_ENDPOINT, token, this.id, request.model, request.input, request.signal);
  }
}
