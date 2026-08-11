/**
 * Centralized access to environment configuration.
 * Secrets are read from the environment only; never hardcoded or logged.
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return undefined;
  }
  return value;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface GatewayConfig {
  adminKey: string | undefined;
  keyPepper: string | undefined;
  providers: {
    googleApiKey: string | undefined;
    groqApiKey: string | undefined;
    openRouterApiKey: string | undefined;
    openaiApiKey: string | undefined;
  };
  timeouts: {
    firstTokenMs: number;
    overallMs: number;
  };
}

export function getConfig(): GatewayConfig {
  return {
    adminKey: readEnv("AI_GATEWAY_ADMIN_KEY"),
    keyPepper: readEnv("AI_GATEWAY_KEY_PEPPER"),
    providers: {
      googleApiKey: readEnv("GOOGLE_API_KEY"),
      groqApiKey: readEnv("GROQ_API_KEY"),
      openRouterApiKey: readEnv("OPENROUTER_FREE_API_KEY"),
      openaiApiKey: readEnv("OPENAI_API_KEY"),
    },
    timeouts: {
      firstTokenMs: readIntEnv("FIRST_TOKEN_TIMEOUT_MS", 15000),
      overallMs: readIntEnv("OVERALL_TIMEOUT_MS", 60000),
    },
  };
}

export const SERVICE_NAME = "ai-gateway";
export const SERVICE_VERSION = "0.1.0";
