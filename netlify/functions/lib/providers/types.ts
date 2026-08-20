/**
 * Shared provider adapter contract. Every provider implements this interface
 * so the gateway can route requests uniformly.
 */

export type GatewayChatRole = "system" | "user" | "assistant";

export type GatewayContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: string }
  | { type: "image_data"; mimeType: string; data: string };

export type GatewayMessageContent = string | GatewayContentPart[];

export interface GatewayChatMessage {
  role: GatewayChatRole;
  content: GatewayMessageContent;
}

export type ProviderCapability = "chat" | "streaming" | "vision" | "embeddings";

export interface ProviderChatRequest {
  /** Provider-native model identifier (already resolved from the registry). */
  model: string;
  messages: GatewayChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface ProviderChatResponse {
  provider: string;
  model: string;
  text: string;
  /** Canonical provider termination reason, when the provider supplies one. */
  finishReason?: string;
}

export interface ProviderEmbeddingsRequest {
  model: string;
  input: string[];
  signal?: AbortSignal;
}

export interface ProviderAdapter {
  id: string;
  label: string;

  /** True when required credentials/config are present. */
  isAvailable(): boolean;

  /** Whether the given provider-native model supports a capability. */
  supports(model: string, capability: ProviderCapability): boolean;

  chat(request: ProviderChatRequest): Promise<ProviderChatResponse>;

  streamChat?(request: ProviderChatRequest): AsyncGenerator<string>;

  embeddings?(request: ProviderEmbeddingsRequest): Promise<number[][]>;
}
