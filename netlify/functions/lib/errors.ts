/**
 * Standardized error codes and JSON error responses for the gateway.
 * Never include secrets, tokens, full stack traces or base64 payloads.
 */

export type GatewayErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN_ORIGIN"
  | "INVALID_REQUEST"
  | "MODEL_NOT_FOUND"
  | "CAPABILITY_NOT_SUPPORTED"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "OUTPUT_TRUNCATED"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<GatewayErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN_ORIGIN: 403,
  INVALID_REQUEST: 400,
  MODEL_NOT_FOUND: 404,
  CAPABILITY_NOT_SUPPORTED: 400,
  PROVIDER_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  OUTPUT_TRUNCATED: 502,
  TIMEOUT: 504,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
};

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly status: number;

  constructor(code: GatewayErrorCode, message: string) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export interface GatewayErrorBody {
  error: {
    code: GatewayErrorCode;
    message: string;
  };
}

export function errorBody(code: GatewayErrorCode, message: string): GatewayErrorBody {
  return { error: { code, message } };
}

/**
 * Normalizes any thrown value into a GatewayError.
 * Unknown errors are mapped to INTERNAL_ERROR with a generic message.
 */
export function toGatewayError(err: unknown): GatewayError {
  if (err instanceof GatewayError) {
    return err;
  }
  return new GatewayError("INTERNAL_ERROR", "Internal server error");
}
