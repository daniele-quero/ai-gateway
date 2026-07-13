/**
 * Google Gemini adapter. Maps the gateway message format to Gemini's
 * generateContent / streamGenerateContent API. Token: GOOGLE_API_KEY.
 */

import { getConfig } from "../config.js";
import { GatewayError } from "../errors.js";
import type {
  GatewayChatMessage,
  ProviderAdapter,
  ProviderCapability,
  ProviderChatRequest,
  ProviderChatResponse,
} from "./types.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
  file_data?: { file_uri: string };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiPayload {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: { temperature?: number; maxOutputTokens?: number };
}

function mapParts(content: GatewayChatMessage["content"]): GeminiPart[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }
  return content.map<GeminiPart>((part) => {
    switch (part.type) {
      case "text":
        return { text: part.text };
      case "image_url":
        return { file_data: { file_uri: part.imageUrl } };
      case "image_data":
        return { inline_data: { mime_type: part.mimeType, data: part.data } };
    }
  });
}

function buildPayload(request: ProviderChatRequest): GeminiPayload {
  const contents: GeminiContent[] = [];
  let systemInstruction: GeminiPayload["systemInstruction"];

  for (const message of request.messages) {
    if (message.role === "system") {
      systemInstruction = { parts: mapParts(message.content) };
      continue;
    }
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: mapParts(message.content),
    });
  }

  const payload: GeminiPayload = { contents };
  if (systemInstruction) {
    payload.systemInstruction = systemInstruction;
  }
  const generationConfig: { temperature?: number; maxOutputTokens?: number } = {};
  if (typeof request.temperature === "number") {
    generationConfig.temperature = request.temperature;
  }
  if (typeof request.maxOutputTokens === "number") {
    generationConfig.maxOutputTokens = request.maxOutputTokens;
  }
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }
  return payload;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

function extractText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

export class GeminiClient implements ProviderAdapter {
  readonly id = "google";
  readonly label = "Google Gemini";

  isAvailable(): boolean {
    return Boolean(getConfig().providers.googleApiKey);
  }

  supports(_model: string, capability: ProviderCapability): boolean {
    return capability === "chat" || capability === "streaming" || capability === "vision";
  }

  private token(): string {
    const token = getConfig().providers.googleApiKey;
    if (!token) {
      throw new GatewayError("PROVIDER_UNAVAILABLE", "Google API key is not configured");
    }
    return token;
  }

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    const url = `${BASE_URL}/${encodeURIComponent(request.model)}:generateContent?key=${this.token()}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(request)),
      ...(request.signal ? { signal: request.signal } : {}),
    });
    if (!response.ok) {
      throw new GatewayError("UPSTREAM_ERROR", `Provider ${this.id} returned ${response.status}`);
    }
    const data = (await response.json()) as GeminiResponse;
    return { provider: this.id, model: request.model, text: extractText(data) };
  }

  async *streamChat(request: ProviderChatRequest): AsyncGenerator<string> {
    const url = `${BASE_URL}/${encodeURIComponent(request.model)}:streamGenerateContent?alt=sse&key=${this.token()}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(buildPayload(request)),
      ...(request.signal ? { signal: request.signal } : {}),
    });
    if (!response.ok || !response.body) {
      throw new GatewayError("UPSTREAM_ERROR", `Provider ${this.id} returned ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) {
            continue;
          }
          const payload = line.slice("data:".length).trim();
          if (payload === "" || payload === "[DONE]") {
            continue;
          }
          try {
            const parsed = JSON.parse(payload) as GeminiResponse;
            const text = extractText(parsed);
            if (text) {
              yield text;
            }
          } catch {
            // Ignore malformed SSE lines.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
