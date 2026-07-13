/**
 * Groq adapter (OpenAI-compatible chat completions).
 * Token: GROQ_API_KEY. Fast models suited for auto:fast routing.
 */

import { getConfig } from "../config.js";
import { GatewayError } from "../errors.js";
import { openAiChat, openAiStreamChat, type OpenAiCompatibleConfig } from "./openaiCompatible.js";
import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderChatRequest,
  ProviderChatResponse,
} from "./types.js";

const CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export class GroqClient implements ProviderAdapter {
  readonly id = "groq";
  readonly label = "Groq";

  isAvailable(): boolean {
    return Boolean(getConfig().providers.groqApiKey);
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return capability === "chat" || capability === "streaming";
  }

  private clientConfig(): OpenAiCompatibleConfig {
    const token = getConfig().providers.groqApiKey;
    if (!token) {
      throw new GatewayError("PROVIDER_UNAVAILABLE", "Groq API key is not configured");
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
}
