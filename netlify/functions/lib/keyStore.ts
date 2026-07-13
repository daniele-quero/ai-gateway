/**
 * App API key storage backed by Netlify Blobs.
 *
 * Security invariants:
 * - Plaintext keys are never stored; only a peppered SHA-256 hash is persisted.
 * - The plaintext value is returned to the caller exactly once at creation time.
 * - Key hashes are never returned from public APIs.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore, type Store } from "@netlify/blobs";

export type AppKeyStatus = "active" | "revoked" | "rotating";
export type Capability = "chat" | "complete" | "vision" | "embeddings" | "models";

export interface AppKeyLimits {
  requestsPerMinute?: number;
  requestsPerDay?: number;
}

export interface StoredAppKey {
  keyId: string;
  appId: string;
  label: string;
  keyHash: string;
  status: AppKeyStatus;
  createdAt: string;
  lastUsedAt?: string;
  allowedOrigins: string[];
  limits: AppKeyLimits;
  enabledCapabilities: Capability[];
}

/** Public view of a key record with the secret hash removed. */
export type PublicAppKey = Omit<StoredAppKey, "keyHash">;

const STORE_NAME = "ai-gateway-app-keys";
const KEY_PREFIX = "aigw_live_";

let cachedStore: Store | null = null;

function store(): Store {
  if (!cachedStore) {
    cachedStore = getStore({ name: STORE_NAME, consistency: "strong" });
  }
  return cachedStore;
}

/** For tests: inject an alternative store implementation. */
export function __setStoreForTests(s: Store | null): void {
  cachedStore = s;
}

export function toPublicKey(record: StoredAppKey): PublicAppKey {
  const publicView: PublicAppKey = {
    keyId: record.keyId,
    appId: record.appId,
    label: record.label,
    status: record.status,
    createdAt: record.createdAt,
    allowedOrigins: record.allowedOrigins,
    limits: record.limits,
    enabledCapabilities: record.enabledCapabilities,
  };
  if (record.lastUsedAt !== undefined) {
    publicView.lastUsedAt = record.lastUsedAt;
  }
  return publicView;
}

/** Computes the peppered SHA-256 hash of a plaintext key. */
export function hashKey(plaintext: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${plaintext}`).digest("hex");
}

/** Constant-time comparison of two hex-encoded hashes. */
export function safeHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function generateKeyId(): string {
  return `key_${randomBytes(12).toString("hex")}`;
}

function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export interface CreateKeyInput {
  appId: string;
  label: string;
  allowedOrigins: string[];
  limits: AppKeyLimits;
  enabledCapabilities: Capability[];
  pepper: string;
}

export interface CreateKeyResult {
  record: StoredAppKey;
  plaintextKey: string;
}

export async function createKey(input: CreateKeyInput): Promise<CreateKeyResult> {
  const keyId = generateKeyId();
  const plaintextKey = generatePlaintextKey();
  const record: StoredAppKey = {
    keyId,
    appId: input.appId,
    label: input.label,
    keyHash: hashKey(plaintextKey, input.pepper),
    status: "active",
    createdAt: new Date().toISOString(),
    allowedOrigins: input.allowedOrigins,
    limits: input.limits,
    enabledCapabilities: input.enabledCapabilities,
  };
  await store().setJSON(keyId, record);
  await indexByHash(record.keyHash, keyId);
  return { record, plaintextKey };
}

/** Maintains a hash -> keyId index for O(1) lookup during auth. */
async function indexByHash(keyHash: string, keyId: string): Promise<void> {
  await store().set(`hash:${keyHash}`, keyId);
}

async function removeHashIndex(keyHash: string): Promise<void> {
  await store().delete(`hash:${keyHash}`);
}

export async function getKeyById(keyId: string): Promise<StoredAppKey | null> {
  const record = await store().get(keyId, { type: "json" });
  return (record as StoredAppKey | null) ?? null;
}

export async function listKeys(): Promise<PublicAppKey[]> {
  const { blobs } = await store().list();
  const results: PublicAppKey[] = [];
  for (const blob of blobs) {
    if (blob.key.startsWith("hash:")) {
      continue;
    }
    const record = await store().get(blob.key, { type: "json" });
    if (record) {
      results.push(toPublicKey(record as StoredAppKey));
    }
  }
  return results;
}

/**
 * Looks up an active key by its plaintext value. Returns the record or null.
 * Updates lastUsedAt on success.
 */
export async function findActiveKeyByPlaintext(
  plaintext: string,
  pepper: string,
): Promise<StoredAppKey | null> {
  const keyHash = hashKey(plaintext, pepper);
  const keyId = await store().get(`hash:${keyHash}`, { type: "text" });
  if (!keyId) {
    return null;
  }
  const record = await getKeyById(keyId);
  if (!record || record.status !== "active") {
    return null;
  }
  if (!safeHashEquals(record.keyHash, keyHash)) {
    return null;
  }
  return record;
}

export async function touchLastUsed(keyId: string): Promise<void> {
  const record = await getKeyById(keyId);
  if (!record) {
    return;
  }
  record.lastUsedAt = new Date().toISOString();
  await store().setJSON(keyId, record);
}

export async function revokeKey(keyId: string): Promise<boolean> {
  const record = await getKeyById(keyId);
  if (!record) {
    return false;
  }
  record.status = "revoked";
  await store().setJSON(keyId, record);
  await removeHashIndex(record.keyHash);
  return true;
}

export interface RotateKeyResult {
  newKey: CreateKeyResult;
  oldKeyId: string;
}

export async function rotateKey(
  keyId: string,
  revokeOldImmediately: boolean,
  pepper: string,
): Promise<RotateKeyResult | null> {
  const existing = await getKeyById(keyId);
  if (!existing) {
    return null;
  }
  const newKey = await createKey({
    appId: existing.appId,
    label: existing.label,
    allowedOrigins: existing.allowedOrigins,
    limits: existing.limits,
    enabledCapabilities: existing.enabledCapabilities,
    pepper,
  });
  if (revokeOldImmediately) {
    await revokeKey(keyId);
  } else {
    existing.status = "rotating";
    await store().setJSON(keyId, existing);
  }
  return { newKey, oldKeyId: keyId };
}
