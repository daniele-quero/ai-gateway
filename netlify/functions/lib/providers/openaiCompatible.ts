/**
 * Shared logic for OpenAI-compatible chat completion providers such as Groq.
 */

import { GatewayError } from "../errors.js";
import type {
  GatewayChatMessage,
  GatewayContentPart,
  ProviderChatRequest,
} from "./types.js";

interface OpenAiTextContent {
  type: "text";
  text: string;
}

interface OpenAiImageContent {
  type: "image_url";
  image_url: { url: string };
}

type OpenAiContent = string | Array<OpenAiTextContent | OpenAiImageContent>;

interface OpenAiMessage {
  role: string;
  content: OpenAiContent;
}

function mapContentPart(part: GatewayContentPart): OpenAiTextContent | OpenAiImageContent {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image_url":
      return { type: "image_url", image_url: { url: part.imageUrl } };
    case "image_data":
      return {
        type: "image_url",
        image_url: { url: `data:${part.mimeType};base64,${part.data}` },
      };
  }
}

export function toOpenAiMessages(messages: GatewayChatMessage[]): OpenAiMessage[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content };
    }
    return { role: message.role, content: message.content.map(mapContentPart) };
  });
}

export interface OpenAiCompatibleConfig {
  providerId: string;
  endpoint: string;
  token: string;
}

function buildBody(request: ProviderChatRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: toOpenAiMessages(request.messages),
    stream,
  };
  if (typeof request.temperature === "number") {
    body.temperature = request.temperature;
  }
  if (typeof request.maxOutputTokens === "number") {
    body.max_tokens = request.maxOutputTokens;
  }
  return body;
}

export async function openAiChat(
  config: OpenAiCompatibleConfig,
  request: ProviderChatRequest,
): Promise<string> {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(buildBody(request, false)),
    ...(request.signal ? { signal: request.signal } : {}),
  });
  if (!response.ok) {
    throw new GatewayError("UPSTREAM_ERROR", `Provider ${config.providerId} returned ${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return text;
}

/**
 * Streams an OpenAI-compatible chat completion, yielding text deltas.
 * Parses the `data: {json}` SSE lines and extracts choices[].delta.content.
 */
export async function* openAiStreamChat(
  config: OpenAiCompatibleConfig,
  request: ProviderChatRequest,
): AsyncGenerator<string> {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(buildBody(request, true)),
    ...(request.signal ? { signal: request.signal } : {}),
  });
  if (!response.ok || !response.body) {
    throw new GatewayError("UPSTREAM_ERROR", `Provider ${config.providerId} returned ${response.status}`);
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
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed SSE lines from the upstream provider.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function openAiEmbeddings(
  endpoint: string,
  token: string,
  providerId: string,
  model: string,
  input: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ model, input }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new GatewayError("UPSTREAM_ERROR", `Provider ${providerId} returned ${response.status}`);
  }
  const data = (await response.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  return (data.data ?? []).map((item) => item.embedding);
}
