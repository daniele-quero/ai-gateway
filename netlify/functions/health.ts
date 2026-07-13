/**
 * GET /api/health — public, no auth required.
 */

import type { Config } from "@netlify/functions";
import { SERVICE_NAME, SERVICE_VERSION } from "./lib/config.js";
import { jsonResponse, noContentResponse } from "./lib/http.js";
import { publicCorsHeaders } from "./lib/cors.js";

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") ?? undefined;
  if (req.method === "OPTIONS") {
    return noContentResponse(publicCorsHeaders(origin));
  }
  return jsonResponse(
    { ok: true, service: SERVICE_NAME, version: SERVICE_VERSION },
    200,
    publicCorsHeaders(origin),
  );
}

export const config: Config = {
  path: "/api/health",
};
