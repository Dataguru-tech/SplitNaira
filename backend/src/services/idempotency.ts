/**
 * In-memory idempotency key store (Issue #888).
 *
 * Mirrors the in-memory, per-instance strategy already used by
 * `middleware/rate-limit.ts` rather than adding a database table: keys are
 * short-lived (default 24h) and only need to survive for the retry window of
 * a single client, so persisting them to Postgres would add migration and
 * query overhead without a corresponding reliability benefit.
 */

export interface IdempotencyRecord {
  requestHash: string;
  status: "in_progress" | "completed";
  statusCode?: number;
  body?: unknown;
}

interface StoredEntry extends IdempotencyRecord {
  expiresAt: number;
}

const DEFAULT_TTL_MS = Number(process.env.IDEMPOTENCY_KEY_TTL_MS ?? 24 * 60 * 60 * 1000);

export class IdempotencyStore {
  private readonly entries = new Map<string, StoredEntry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = () => Date.now()
  ) {}

  private buildKey(scope: string, key: string): string {
    return `${scope}::${key}`;
  }

  get(scope: string, key: string): IdempotencyRecord | undefined {
    const storeKey = this.buildKey(scope, key);
    const entry = this.entries.get(storeKey);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(storeKey);
      return undefined;
    }
    return entry;
  }

  markInProgress(scope: string, key: string, requestHash: string): void {
    this.entries.set(this.buildKey(scope, key), {
      requestHash,
      status: "in_progress",
      expiresAt: this.now() + this.ttlMs
    });
  }

  complete(scope: string, key: string, requestHash: string, statusCode: number, body: unknown): void {
    this.entries.set(this.buildKey(scope, key), {
      requestHash,
      status: "completed",
      statusCode,
      body,
      expiresAt: this.now() + this.ttlMs
    });
  }

  remove(scope: string, key: string): void {
    this.entries.delete(this.buildKey(scope, key));
  }

  clear(): void {
    this.entries.clear();
  }
}

export const idempotencyStore = new IdempotencyStore();
