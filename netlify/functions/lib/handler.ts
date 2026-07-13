/**
 * Shared request pipeline for authenticated app endpoints:
 * CORS preflight, method checks, app-key auth, origin validation,
 * capability checks and rate limiting.
 */

import { requireAppKey, requireCapability, type AuthContext } from "./auth.js";
import { corsHeaders, isOriginAllowed, publicCorsHeaders } from "./cors.js";
import { GatewayError } from "./errors.js";
import { errorResponse, gatewayErrorResponse, headersToMap, noContentResponse } from "./http.js";
import { enforceLimits } from "./rateLimit.js";
import type { Capability } from "./keyStore.js";

export interface AppRequestContext {
  auth: AuthContext;
  origin: string | undefined;
  corsHeaders: Record<string, string>;
}

type AppHandler = (req: Request, ctx: AppRequestContext) => Promise<Response>;

export interface AppRouteOptions {
  method: "GET" | "POST";
  capability: Capability;
}

/**
 * Wraps an authenticated handler with the full pre-flight pipeline.
 */
export function withApp(options: AppRouteOptions, handler: AppHandler): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin") ?? undefined;

    if (req.method === "OPTIONS") {
      return noContentResponse(publicCorsHeaders(origin));
    }

    try {
      if (req.method !== options.method) {
        return errorResponse("METHOD_NOT_ALLOWED", `Method ${req.method} not allowed`, publicCorsHeaders(origin));
      }

      const headers = headersToMap(req.headers);
      const auth = await requireAppKey(headers);

      if (!isOriginAllowed(origin, auth.key.allowedOrigins)) {
        return errorResponse("FORBIDDEN_ORIGIN", "Origin not allowed for this key", publicCorsHeaders(origin));
      }

      requireCapability(auth, options.capability);

      const cors = corsHeaders(origin, auth.key.allowedOrigins);

      const limit = await enforceLimits(auth.key.appId, auth.key.limits);
      if (!limit.allowed) {
        return errorResponse("RATE_LIMITED", "Rate limit exceeded", {
          ...cors,
          "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
        });
      }

      return await handler(req, { auth, origin, corsHeaders: cors });
    } catch (err) {
      const gwErr = err instanceof GatewayError ? err : undefined;
      return gatewayErrorResponse(gwErr ?? err, publicCorsHeaders(origin));
    }
  };
}
