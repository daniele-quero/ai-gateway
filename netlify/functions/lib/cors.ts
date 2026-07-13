/**
 * CORS handling. Each app key carries its own allowedOrigins list.
 * The request Origin is validated against that list before it is reflected.
 */

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-AI-Gateway-Key",
  "Access-Control-Max-Age": "86400",
};

/**
 * Returns true when the origin is permitted by the allowlist.
 * An allowlist containing "*" permits any origin.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes("*")) {
    return true;
  }
  if (!origin) {
    // Non-browser clients (no Origin header) are allowed; CORS is a browser concern.
    return true;
  }
  return allowedOrigins.includes(origin);
}

/**
 * Builds CORS headers reflecting the origin only when it is allowed.
 */
export function corsHeaders(origin: string | undefined, allowedOrigins: string[]): Record<string, string> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = allowedOrigins.includes("*") ? "*" : origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

/**
 * Headers for preflight/public responses where no app key context exists yet.
 */
export function publicCorsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}
