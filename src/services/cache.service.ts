import { createHash } from "crypto";
import type { EFOutput, ICacheService } from "../types/index.js";

/**
 * Generates a stable cache key from the raw (pre-cleaned) description.
 * SHA-256 ensures uniform key length and collision resistance.
 */
export function buildCacheKey(rawDescription: string): string {
  return createHash("sha256").update(rawDescription.toLowerCase().trim()).digest("hex");
}

// ─── In-Memory Implementation ─────────────────────────────────────────────────

interface CacheEntry {
  value: EFOutput;
  expiresAt: number;
}

/**
 * InMemoryCacheService — default implementation.
 *
 * To swap in Redis, implement ICacheService with ioredis and inject it:
 *
 *   class RedisCacheService implements ICacheService {
 *     constructor(private client: Redis, private ttlMs: number) {}
 *     async get(key: string): Promise<EFOutput | null> {
 *       const raw = await this.client.get(key);
 *       return raw ? JSON.parse(raw) : null;
 *     }
 *     async set(key: string, value: EFOutput): Promise<void> {
 *       await this.client.set(key, JSON.stringify(value), "PX", this.ttlMs);
 *     }
 *     async has(key: string): Promise<boolean> {
 *       return (await this.get(key)) !== null;
 *     }
 *   }
 */
export class InMemoryCacheService implements ICacheService {
  private readonly store = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number) {}

  async get(key: string): Promise<EFOutput | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: EFOutput): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}