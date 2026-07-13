/**
 * Public request/response types for the AI Gateway client.
 * Kept aligned with the gateway API contract.
 */

export type ChatRole = "system" | "user" | "assistant";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: string }
  | { type: "image_data"; mimeType: string; data: string };

export type MessageContent = string | ContentPart[];

export interface ChatMessage {
  role: ChatRole;
  content: MessageContent;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface CompleteRequest {
  model: string;
  input: string;
  system?: string;
  stream?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface VisionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface EmbeddingsRequest {
  model: string;
  input: string | string[];
}

export interface ChatResponse {
  provider: string;
  model: string;
  text: string;
}

export interface EmbeddingsResponse {
  provider: string;
  model: string;
  data: Array<{ index: number; embedding: number[] }>;
}

export interface ProvidersResponse {
  providers: Array<{ id: string; label: string; available: boolean }>;
  models: Array<{
    id: string;
    alias: string;
    provider: string;
    model: string;
    capabilities: string[];
    available: boolean;
  }>;
}

export interface StreamMeta {
  provider: string;
  model: string;
}

export interface StreamCallbacks {
  onMeta?: (meta: StreamMeta) => void;
  onDelta?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}

export interface AiGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Optional custom fetch implementation (e.g. for testing). */
  fetch?: typeof fetch;
}
