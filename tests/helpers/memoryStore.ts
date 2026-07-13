/**
 * In-memory implementation of the Netlify Blobs Store interface used in tests.
 * Only the methods exercised by keyStore are implemented.
 */

import type { Store } from "@netlify/blobs";

export function createMemoryStore(): Store {
  const data = new Map<string, string>();

  const store = {
    async get(key: string, opts?: { type?: string }): Promise<unknown> {
      const value = data.get(key);
      if (value === undefined) {
        return null;
      }
      if (opts?.type === "json") {
        return JSON.parse(value);
      }
      return value;
    },
    async set(key: string, value: string): Promise<void> {
      data.set(key, value);
    },
    async setJSON(key: string, value: unknown): Promise<void> {
      data.set(key, JSON.stringify(value));
    },
    async delete(key: string): Promise<void> {
      data.delete(key);
    },
    async list(): Promise<{ blobs: Array<{ key: string }> }> {
      return { blobs: Array.from(data.keys()).map((key) => ({ key })) };
    },
  };

  return store as unknown as Store;
}
