/**
 * App API key management — protected by AI_GATEWAY_ADMIN_KEY.
 *
 *   POST /api/keys          create a key (plaintext returned once)
 *   GET  /api/keys          list keys (no secrets)
 *   POST /api/keys/revoke   revoke a key
 *   POST /api/keys/rotate   rotate a key
 */

import type { Config } from "@netlify/functions";
import { requireAdmin } from "./lib/auth.js";
import { getConfig } from "./lib/config.js";
import { publicCorsHeaders } from "./lib/cors.js";
import { GatewayError } from "./lib/errors.js";
import {
  errorResponse,
  gatewayErrorResponse,
  headersToMap,
  jsonResponse,
  noContentResponse,
  parseJsonBody,
} from "./lib/http.js";
import {
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  type AppKeyLimits,
  type Capability,
} from "./lib/keyStore.js";
import {
  optionalBoolean,
  requireString,
} from "./lib/validation.js";

const ALLOWED_CAPABILITIES: Capability[] = ["chat", "complete", "vision", "embeddings", "models"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown, field: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new GatewayError("INVALID_REQUEST", `Field '${field}' must be an array of strings`);
  }
  return value.map((item, i) => requireString(item, `${field}[${i}]`));
}

function parseCapabilities(value: unknown): Capability[] {
  if (value === undefined) {
    return ["chat", "complete"];
  }
  if (!Array.isArray(value)) {
    throw new GatewayError("INVALID_REQUEST", "'enabledCapabilities' must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "string" || !ALLOWED_CAPABILITIES.includes(item as Capability)) {
      throw new GatewayError("INVALID_REQUEST", `Invalid capability: ${String(item)}`);
    }
    return item as Capability;
  });
}

function parseLimits(value: unknown): AppKeyLimits {
  if (value === undefined) {
    return {};
  }
  if (!isObject(value)) {
    throw new GatewayError("INVALID_REQUEST", "'limits' must be an object");
  }
  const limits: AppKeyLimits = {};
  if (value.requestsPerMinute !== undefined) {
    if (typeof value.requestsPerMinute !== "number" || value.requestsPerMinute <= 0) {
      throw new GatewayError("INVALID_REQUEST", "'limits.requestsPerMinute' must be a positive number");
    }
    limits.requestsPerMinute = value.requestsPerMinute;
  }
  if (value.requestsPerDay !== undefined) {
    if (typeof value.requestsPerDay !== "number" || value.requestsPerDay <= 0) {
      throw new GatewayError("INVALID_REQUEST", "'limits.requestsPerDay' must be a positive number");
    }
    limits.requestsPerDay = value.requestsPerDay;
  }
  return limits;
}

async function handleCreate(req: Request, cors: Record<string, string>): Promise<Response> {
  const pepper = getConfig().keyPepper;
  if (!pepper) {
    throw new GatewayError("INTERNAL_ERROR", "Key pepper is not configured");
  }
  const body = await parseJsonBody(req);
  if (!isObject(body)) {
    throw new GatewayError("INVALID_REQUEST", "Request body must be an object");
  }
  const { record, plaintextKey } = await createKey({
    appId: requireString(body.appId, "appId"),
    label: requireString(body.label, "label"),
    allowedOrigins: parseStringArray(body.allowedOrigins, "allowedOrigins"),
    limits: parseLimits(body.limits),
    enabledCapabilities: parseCapabilities(body.enabledCapabilities),
    pepper,
  });
  return jsonResponse(
    {
      appId: record.appId,
      keyId: record.keyId,
      apiKey: plaintextKey,
      warning: "Store this key now. It will not be shown again.",
    },
    201,
    cors,
  );
}

async function handleList(cors: Record<string, string>): Promise<Response> {
  const keys = await listKeys();
  return jsonResponse({ keys }, 200, cors);
}

async function handleRevoke(req: Request, cors: Record<string, string>): Promise<Response> {
  const body = await parseJsonBody(req);
  if (!isObject(body)) {
    throw new GatewayError("INVALID_REQUEST", "Request body must be an object");
  }
  const keyId = requireString(body.keyId, "keyId");
  const ok = await revokeKey(keyId);
  if (!ok) {
    return errorResponse("NOT_FOUND", "Key not found", cors);
  }
  return jsonResponse({ ok: true }, 200, cors);
}

async function handleRotate(req: Request, cors: Record<string, string>): Promise<Response> {
  const pepper = getConfig().keyPepper;
  if (!pepper) {
    throw new GatewayError("INTERNAL_ERROR", "Key pepper is not configured");
  }
  const body = await parseJsonBody(req);
  if (!isObject(body)) {
    throw new GatewayError("INVALID_REQUEST", "Request body must be an object");
  }
  const keyId = requireString(body.keyId, "keyId");
  const revokeOld = optionalBoolean(body.revokeOldImmediately, "revokeOldImmediately") ?? false;
  const result = await rotateKey(keyId, revokeOld, pepper);
  if (!result) {
    return errorResponse("NOT_FOUND", "Key not found", cors);
  }
  return jsonResponse(
    {
      appId: result.newKey.record.appId,
      keyId: result.newKey.record.keyId,
      apiKey: result.newKey.plaintextKey,
      previousKeyId: result.oldKeyId,
      warning: "Store this key now. It will not be shown again.",
    },
    201,
    cors,
  );
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") ?? undefined;
  const cors = publicCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return noContentResponse(cors);
  }

  try {
    requireAdmin(headersToMap(req.headers));
    const path = new URL(req.url).pathname.replace(/\/+$/, "");

    if (path.endsWith("/keys/revoke")) {
      if (req.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Use POST", cors);
      }
      return await handleRevoke(req, cors);
    }
    if (path.endsWith("/keys/rotate")) {
      if (req.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Use POST", cors);
      }
      return await handleRotate(req, cors);
    }

    // Base /keys route
    if (req.method === "POST") {
      return await handleCreate(req, cors);
    }
    if (req.method === "GET") {
      return await handleList(cors);
    }
    return errorResponse("METHOD_NOT_ALLOWED", `Method ${req.method} not allowed`, cors);
  } catch (err) {
    return gatewayErrorResponse(err, cors);
  }
}

export const config: Config = {
  path: ["/api/keys", "/api/keys/revoke", "/api/keys/rotate"],
};
