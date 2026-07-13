/**
 * Request payload validation. Runs at the function boundary before any
 * provider call. Throws GatewayError("INVALID_REQUEST", ...) on failure.
 */

import { GatewayError } from "./errors.js";
import type {
  GatewayChatMessage,
  GatewayChatRole,
  GatewayMessageContent,
} from "./providers/types.js";

const ALLOWED_ROLES: GatewayChatRole[] = ["system", "user", "assistant"];
const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB decoded upper bound

function fail(message: string): never {
  throw new GatewayError("INVALID_REQUEST", message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`Field '${field}' must be a non-empty string`);
  }
  return value;
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`Field '${field}' must be a finite number`);
  }
  return value;
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    fail(`Field '${field}' must be a boolean`);
  }
  return value;
}

function validateImageData(mimeType: unknown, data: unknown): void {
  if (typeof mimeType !== "string" || !ALLOWED_IMAGE_MIME.includes(mimeType)) {
    fail(`Unsupported image mimeType; allowed: ${ALLOWED_IMAGE_MIME.join(", ")}`);
  }
  if (typeof data !== "string" || data.length === 0) {
    fail("image_data.data must be a non-empty base64 string");
  }
  // Approximate decoded byte length without decoding the payload.
  const approxBytes = Math.floor((data.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    fail("Image exceeds maximum allowed size");
  }
}

function validateContent(content: unknown): GatewayMessageContent {
  if (typeof content === "string") {
    if (content.length === 0) {
      fail("Message content string must not be empty");
    }
    return content;
  }
  if (!Array.isArray(content)) {
    fail("Message content must be a string or an array of parts");
  }
  for (const part of content) {
    if (!isObject(part) || typeof part.type !== "string") {
      fail("Each content part must be an object with a 'type'");
    }
    switch (part.type) {
      case "text":
        requireString(part.text, "content.text");
        break;
      case "image_url":
        requireString(part.imageUrl, "content.imageUrl");
        break;
      case "image_data":
        validateImageData(part.mimeType, part.data);
        break;
      default:
        fail(`Unsupported content part type: ${String(part.type)}`);
    }
  }
  return content as GatewayMessageContent;
}

export function validateMessages(value: unknown): GatewayChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail("'messages' must be a non-empty array");
  }
  return value.map((raw) => {
    if (!isObject(raw)) {
      fail("Each message must be an object");
    }
    if (typeof raw.role !== "string" || !ALLOWED_ROLES.includes(raw.role as GatewayChatRole)) {
      fail(`Message 'role' must be one of: ${ALLOWED_ROLES.join(", ")}`);
    }
    return {
      role: raw.role as GatewayChatRole,
      content: validateContent(raw.content),
    };
  });
}

export interface ChatRequestBody {
  model: string;
  messages: GatewayChatMessage[];
  stream: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export function validateChatRequest(body: unknown): ChatRequestBody {
  if (!isObject(body)) {
    fail("Request body must be an object");
  }
  return {
    model: requireString(body.model, "model"),
    messages: validateMessages(body.messages),
    stream: optionalBoolean(body.stream, "stream") ?? false,
    temperature: optionalNumber(body.temperature, "temperature"),
    maxOutputTokens: optionalNumber(body.maxOutputTokens, "maxOutputTokens"),
  };
}

export interface CompleteRequestBody {
  model: string;
  input: string;
  system?: string;
  stream: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export function validateCompleteRequest(body: unknown): CompleteRequestBody {
  if (!isObject(body)) {
    fail("Request body must be an object");
  }
  const result: CompleteRequestBody = {
    model: requireString(body.model, "model"),
    input: requireString(body.input, "input"),
    stream: optionalBoolean(body.stream, "stream") ?? false,
    temperature: optionalNumber(body.temperature, "temperature"),
    maxOutputTokens: optionalNumber(body.maxOutputTokens, "maxOutputTokens"),
  };
  if (body.system !== undefined) {
    result.system = requireString(body.system, "system");
  }
  return result;
}

export interface EmbeddingsRequestBody {
  model: string;
  input: string[];
}

export function validateEmbeddingsRequest(body: unknown): EmbeddingsRequestBody {
  if (!isObject(body)) {
    fail("Request body must be an object");
  }
  const model = requireString(body.model, "model");
  const rawInput = body.input;
  const inputArray = Array.isArray(rawInput) ? rawInput : [rawInput];
  if (inputArray.length === 0) {
    fail("'input' must be a non-empty string or array of strings");
  }
  const input = inputArray.map((item, i) => requireString(item, `input[${i}]`));
  return { model, input };
}
