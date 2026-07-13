/**
 * HTTP helpers for Netlify Functions v2 (Web Request/Response API).
 */

import { errorBody, GatewayError, toGatewayError, type GatewayErrorCode } from "./errors.js";

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function errorResponse(
  code: GatewayErrorCode,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const err = new GatewayError(code, message);
  return jsonResponse(errorBody(err.code, err.message), err.status, extraHeaders);
}

export function gatewayErrorResponse(
  err: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  const gwErr = toGatewayError(err);
  return jsonResponse(errorBody(gwErr.code, gwErr.message), gwErr.status, extraHeaders);
}

export function noContentResponse(extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers: extraHeaders });
}

/** Reads and parses a JSON request body, throwing INVALID_REQUEST on failure. */
export async function parseJsonBody<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new GatewayError("INVALID_REQUEST", "Request body must be valid JSON");
  }
}

/** Converts a Headers object into a plain, lowercase-keyed map. */
export function headersToMap(headers: Headers): Record<string, string> {
  const map: Record<string, string> = {};
  headers.forEach((value, key) => {
    map[key.toLowerCase()] = value;
  });
  return map;
}
