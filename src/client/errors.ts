/**
 * Normalized client-side error mirroring the gateway JSON error shape.
 */

export interface GatewayErrorPayload {
  code: string;
  message: string;
}

export class AiGatewayError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
    this.status = status;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/** Parses a non-OK Response into an AiGatewayError. */
export async function errorFromResponse(response: Response): Promise<AiGatewayError> {
  let code = "INTERNAL_ERROR";
  let message = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as ErrorBody;
    if (body.error?.code) {
      code = body.error.code;
    }
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    // Keep defaults when the body is not JSON.
  }
  return new AiGatewayError(code, message, response.status);
}
