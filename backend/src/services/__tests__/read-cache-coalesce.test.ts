import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ReadCache,
  configureReadCache,
  resetReadCacheForTests,
} from "../read-cache.js";

// ---------------------------------------------------------------------------
// Issue #1033: Concurrent reads for the same project should coalesce into
// a single upstream simulation when cache is cold.
//
// NOTE: These tests use real timers (no vi.useFakeTimers) because the
// fetchers simulate async delay via setTimeout. TTL/expiration behavior
// is already covered in read-cache.test.ts.
// ---------------------------------------------------------------------------

describe("ReadCache.getOrFetch (Issue #1033: in-flight coalescing)", () => {
  beforeEach(() => {
    resetReadCacheForTests();
  });

  afterEach(() => {
    resetReadCacheForTests();
  });

  it("returns cached value on second call without calling fetcher again", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });
    const fetcher = vi.fn().mockResolvedValue({ data: "project-1" });

    const first = await cache.getOrFetch("key1", fetcher);
    const second = await cache.getOrFetch("key1", fetcher);

    expect(first).toEqual({ data: "project-1" });
    expect(second).toEqual({ data: "project-1" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent calls for the same key into one fetcher invocation", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });

    const fetcher = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { callCount: 1 };
    });

    // Fire 5 concurrent requests for the same cache key
    const results = await Promise.all([
      cache.getOrFetch("concurrent-key", fetcher),
      cache.getOrFetch("concurrent-key", fetcher),
      cache.getOrFetch("concurrent-key", fetcher),
      cache.getOrFetch("concurrent-key", fetcher),
      cache.getOrFetch("concurrent-key", fetcher),
    ]);

    // Only one fetcher call should have been made
    expect(fetcher).toHaveBeenCalledTimes(1);
    // All callers should have received the same result
    expect(results.every((r) => (r as { callCount: number }).callCount === 1)).toBe(true);
  });

  it("allows retry after fetcher rejects (in-flight cleared)", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });
    let attempt = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) throw new Error("RPC failure");
      return { attempt };
    });

    // First call fails
    await expect(cache.getOrFetch("retry-key", fetcher)).rejects.toThrow("RPC failure");

    // Second call retries and succeeds
    const result = await cache.getOrFetch("retry-key", fetcher);
    expect(result).toEqual({ attempt: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("second concurrent call also receives the rejection if fetcher rejects", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });
    const fetcher = vi.fn().mockRejectedValue(new Error("Simulated RPC error"));

    const [result1, result2] = await Promise.allSettled([
      cache.getOrFetch("reject-key", fetcher),
      cache.getOrFetch("reject-key", fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result1.status).toBe("rejected");
    expect(result2.status).toBe("rejected");
  });

  it("coalescing does not mix up different cache keys", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });
    const fetcherA = vi.fn().mockResolvedValue("result-a");
    const fetcherB = vi.fn().mockResolvedValue("result-b");

    const [a, b] = await Promise.all([
      cache.getOrFetch("key-a", fetcherA),
      cache.getOrFetch("key-b", fetcherB),
    ]);

    expect(a).toBe("result-a");
    expect(b).toBe("result-b");
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it("stores result in cache after fetcher resolves", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });
    const fetcher = vi.fn().mockResolvedValue("cached-value");

    await cache.getOrFetch("store-key", fetcher);

    // Direct cache get should return the stored value
    expect(cache.get("store-key")).toBe("cached-value");
  });

  it("clear() removes in-flight entries so next call re-fetches", async () => {
    const cache = new ReadCache({ defaultTtlMs: 10_000 });
    const fetcher = vi.fn().mockResolvedValue("value");

    await cache.getOrFetch("clear-key", fetcher);
    expect(cache.get("clear-key")).toBe("value");

    // Clear the cache
    cache.clear();

    // A new call should invoke fetcher again since clear removed the cached value
    const fetcher2 = vi.fn().mockResolvedValue("new-value");
    const result2 = await cache.getOrFetch("clear-key", fetcher2);
    expect(result2).toBe("new-value");
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });
});

describe("Issue #1033: Simulated concurrent read scenarios", () => {
  beforeEach(() => {
    resetReadCacheForTests();
  });

  afterEach(() => {
    resetReadCacheForTests();
  });

  it("multiple simultaneous project reads perform a single upstream simulation", async () => {
    const cache = configureReadCache({ defaultTtlMs: 30_000 });

    const simulateRpcCall = vi.fn().mockImplementation(async (projectId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { projectId, title: `Project ${projectId}`, balance: "1000" };
    });

    // Simulate 10 concurrent requests for the same project (cache is cold)
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        cache.getOrFetch("project:proj_1", () => simulateRpcCall("proj_1"))
      )
    );

    // Only ONE upstream RPC call should have been made
    expect(simulateRpcCall).toHaveBeenCalledTimes(1);
    // All 10 callers should get the same result
    expect(results.every((r) => (r as { projectId: string }).projectId === "proj_1")).toBe(true);
    expect(results.length).toBe(10);
  });

  it("after coalesced result is cached, subsequent calls hit cache", async () => {
    const cache = configureReadCache({ defaultTtlMs: 30_000 });

    const simulateRpcCall = vi.fn().mockImplementation(async () => {
      return { data: "fresh" };
    });

    // First batch: coalesces into 1 RPC call
    await Promise.all([
      cache.getOrFetch("project:proj_2", () => simulateRpcCall()),
      cache.getOrFetch("project:proj_2", () => simulateRpcCall()),
      cache.getOrFetch("project:proj_2", () => simulateRpcCall()),
    ]);
    expect(simulateRpcCall).toHaveBeenCalledTimes(1);

    // Second batch: should hit cache (no new RPC calls)
    await Promise.all([
      cache.getOrFetch("project:proj_2", () => simulateRpcCall()),
      cache.getOrFetch("project:proj_2", () => simulateRpcCall()),
    ]);
    expect(simulateRpcCall).toHaveBeenCalledTimes(1); // still 1
  });
});
