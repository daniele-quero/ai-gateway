import { beforeEach, describe, expect, it } from "vitest";
import {
  extractAppKey,
  requireAdmin,
  requireAppKey,
} from "../netlify/functions/lib/auth.js";
import {
  __setStoreForTests,
  createKey,
  revokeKey,
} from "../netlify/functions/lib/keyStore.js";
import { GatewayError } from "../netlify/functions/lib/errors.js";
import { createMemoryStore } from "./helpers/memoryStore.js";

const PEPPER = "test-pepper-value";
const ADMIN_KEY = "admin-secret";

beforeEach(() => {
  process.env.AI_GATEWAY_KEY_PEPPER = PEPPER;
  process.env.AI_GATEWAY_ADMIN_KEY = ADMIN_KEY;
  __setStoreForTests(createMemoryStore());
});

describe("extractAppKey", () => {
  it("reads a bearer token", () => {
    expect(extractAppKey({ authorization: "Bearer abc123" })).toBe("abc123");
  });

  it("reads the X-AI-Gateway-Key header", () => {
    expect(extractAppKey({ "x-ai-gateway-key": "xyz" })).toBe("xyz");
  });

  it("returns undefined when absent", () => {
    expect(extractAppKey({})).toBeUndefined();
  });
});

describe("requireAdmin", () => {
  it("accepts a matching admin key", () => {
    expect(() => requireAdmin({ authorization: `Bearer ${ADMIN_KEY}` })).not.toThrow();
  });

  it("rejects a wrong admin key", () => {
    expect(() => requireAdmin({ authorization: "Bearer nope" })).toThrow(GatewayError);
  });
});

describe("requireAppKey", () => {
  it("authenticates a valid active key", async () => {
    const { plaintextKey, record } = await createKey({
      appId: "app-1",
      label: "Test",
      allowedOrigins: [],
      limits: {},
      enabledCapabilities: ["chat"],
      pepper: PEPPER,
    });
    const ctx = await requireAppKey({ authorization: `Bearer ${plaintextKey}` });
    expect(ctx.key.keyId).toBe(record.keyId);
    expect(ctx.key.appId).toBe("app-1");
  });

  it("does not store the plaintext key", async () => {
    const { plaintextKey, record } = await createKey({
      appId: "app-2",
      label: "Test",
      allowedOrigins: [],
      limits: {},
      enabledCapabilities: ["chat"],
      pepper: PEPPER,
    });
    expect(record.keyHash).not.toContain(plaintextKey);
    expect(JSON.stringify(record)).not.toContain(plaintextKey);
  });

  it("rejects a revoked key", async () => {
    const { plaintextKey, record } = await createKey({
      appId: "app-3",
      label: "Test",
      allowedOrigins: [],
      limits: {},
      enabledCapabilities: ["chat"],
      pepper: PEPPER,
    });
    await revokeKey(record.keyId);
    await expect(requireAppKey({ authorization: `Bearer ${plaintextKey}` })).rejects.toThrow(GatewayError);
  });

  it("rejects an unknown key", async () => {
    await expect(requireAppKey({ authorization: "Bearer aigw_live_unknown" })).rejects.toThrow(GatewayError);
  });
});
