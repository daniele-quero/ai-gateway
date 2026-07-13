/**
 * Authentication helpers for public (app key) and admin (admin key) routes.
 */

import { getConfig } from "./config.js";
import { GatewayError } from "./errors.js";
import { findActiveKeyByPlaintext, touchLastUsed, type StoredAppKey, type Capability } from "./keyStore.js";

export interface HeaderMap {
  [key: string]: string | undefined;
}

/** Case-insensitive header lookup. */
function getHeader(headers: HeaderMap, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      return headers[key];
    }
  }
  return undefined;
}

/** Extracts a bearer token from the Authorization header. */
function bearerToken(headers: HeaderMap): string | undefined {
  const raw = getHeader(headers, "authorization");
  if (!raw) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1]?.trim();
}

/** Extracts the app API key from Authorization or X-AI-Gateway-Key. */
export function extractAppKey(headers: HeaderMap): string | undefined {
  return bearerToken(headers) ?? getHeader(headers, "x-ai-gateway-key")?.trim();
}

/**
 * Validates the admin key. Throws UNAUTHORIZED on mismatch or missing config.
 */
export function requireAdmin(headers: HeaderMap): void {
  const config = getConfig();
  if (!config.adminKey) {
    throw new GatewayError("INTERNAL_ERROR", "Admin key is not configured");
  }
  const provided = bearerToken(headers) ?? getHeader(headers, "x-ai-gateway-key");
  if (!provided || provided !== config.adminKey) {
    throw new GatewayError("UNAUTHORIZED", "Invalid admin key");
  }
}

export interface AuthContext {
  key: StoredAppKey;
}

/**
 * Validates an app API key and returns the associated record.
 * Throws UNAUTHORIZED when the key is missing, unknown, or inactive.
 */
export async function requireAppKey(headers: HeaderMap): Promise<AuthContext> {
  const config = getConfig();
  if (!config.keyPepper) {
    throw new GatewayError("INTERNAL_ERROR", "Key pepper is not configured");
  }
  const plaintext = extractAppKey(headers);
  if (!plaintext) {
    throw new GatewayError("UNAUTHORIZED", "Missing API key");
  }
  const record = await findActiveKeyByPlaintext(plaintext, config.keyPepper);
  if (!record) {
    throw new GatewayError("UNAUTHORIZED", "Invalid API key");
  }
  // Best-effort usage timestamp; failures must not block the request.
  void touchLastUsed(record.keyId).catch(() => undefined);
  return { key: record };
}

/**
 * Ensures the authenticated key has the given capability enabled.
 */
export function requireCapability(ctx: AuthContext, capability: Capability): void {
  if (!ctx.key.enabledCapabilities.includes(capability)) {
    throw new GatewayError("CAPABILITY_NOT_SUPPORTED", `Capability not enabled: ${capability}`);
  }
}
