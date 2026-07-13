/**
 * Template / mock provider. Always available and deterministic, so streaming,
 * fallback and SSE behavior can be tested without real provider credentials.
 * Use this as a copy-paste starting point for new OpenAI-incompatible providers.
 */

import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderChatRequest,
  ProviderChatResponse,
  ProviderEmbeddingsRequest,
  GatewayChatMessage,
} from "./types.js";

function lastUserText(messages: GatewayChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.role === "user") {
      if (typeof message.content === "string") {
        return message.content;
      }
      const textPart = message.content.find((p) => p.type === "text");
      if (textPart && textPart.type === "text") {
        return textPart.text;
      }
    }
  }
  return "";
}

function buildReply(request: ProviderChatRequest): string {
  const prompt = lastUserText(request.messages);
  return `[template:${request.model}] ${prompt}`.trim();
}

export class TemplateProviderClient implements ProviderAdapter {
  readonly id = "template";
  readonly label = "Template Provider";

  isAvailable(): boolean {
    return true;
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return capability === "chat" || capability === "streaming" || capability === "embeddings";
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    return {
      provider: this.id,
      model: request.model,
      text: buildReply(request),
    };
  }

  async *streamChat(request: ProviderChatRequest): AsyncGenerator<string> {
    const reply = buildReply(request);
    // Emit word-by-word to simulate a streaming provider.
    const tokens = reply.split(/(\s+)/).filter((t) => t.length > 0);
    for (const token of tokens) {
      if (request.signal?.aborted) {
        return;
      }
      yield token;
    }
  }

  async embeddings(request: ProviderEmbeddingsRequest): Promise<number[][]> {
    // Deterministic pseudo-embeddings based on string length and char codes.
    return request.input.map((text) => {
      const base = text.length % 7;
      return [base / 7, (base + 1) / 7, (base + 2) / 7];
    });
  }
}
