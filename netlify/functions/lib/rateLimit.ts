/**
 * Rate limiting abstractions.
 *
 * MemoryRateLimitStore is for dev/test only. Production should use a shared
 * store (e.g. Upstash Redis) implementing the same RateLimitStore interface.
 */

import type { AppKeyLimits } from "./keyStore.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface RateLimitStore {
  /** Increments the counter for a window and returns the current state. */
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** In-memory fixed-window rate limiter. Not safe across instances. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - bucket.count),
      limit,
      resetAt: bucket.resetAt,
    };
  }
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let defaultStore: RateLimitStore = new MemoryRateLimitStore();

export function setRateLimitStore(store: RateLimitStore): void {
  defaultStore = store;
}

export function getRateLimitStore(): RateLimitStore {
  return defaultStore;
}

/**
 * Enforces per-minute and per-day limits for an app. Returns the first
 * disallowed result, or an allowed result when within all limits.
 */
export async function enforceLimits(appId: string, limits: AppKeyLimits): Promise<RateLimitResult> {
  const store = getRateLimitStore();
  const checks: Array<Promise<RateLimitResult>> = [];
  if (typeof limits.requestsPerMinute === "number") {
    checks.push(store.hit(`${appId}:min`, limits.requestsPerMinute, MINUTE_MS));
  }
  if (typeof limits.requestsPerDay === "number") {
    checks.push(store.hit(`${appId}:day`, limits.requestsPerDay, DAY_MS));
  }
  if (checks.length === 0) {
    return { allowed: true, remaining: Infinity, limit: Infinity, resetAt: Date.now() + MINUTE_MS };
  }
  const results = await Promise.all(checks);
  const blocked = results.find((r) => !r.allowed);
  return blocked ?? results[0]!;
}
