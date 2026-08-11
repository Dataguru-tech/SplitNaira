import { describe, expect, it } from "vitest";
import { IdempotencyStore } from "./idempotency.js";

describe("IdempotencyStore (Issue #888)", () => {
  it("returns undefined for an unknown key", () => {
    const store = new IdempotencyStore(1000, () => 0);
    expect(store.get("POST:/splits", "missing-key")).toBeUndefined();
  });

  it("returns an in_progress record after markInProgress", () => {
    const store = new IdempotencyStore(1000, () => 0);
    store.markInProgress("POST:/splits", "key-1", "hash-a");

    const record = store.get("POST:/splits", "key-1");
    expect(record).toEqual({ requestHash: "hash-a", status: "in_progress", expiresAt: 1000 });
  });

  it("returns a completed record with statusCode/body after complete", () => {
    const store = new IdempotencyStore(1000, () => 0);
    store.markInProgress("POST:/splits", "key-1", "hash-a");
    store.complete("POST:/splits", "key-1", "hash-a", 200, { xdr: "XDR" });

    const record = store.get("POST:/splits", "key-1");
    expect(record).toEqual({
      requestHash: "hash-a",
      status: "completed",
      statusCode: 200,
      body: { xdr: "XDR" },
      expiresAt: 1000,
    });
  });

  it("scopes keys independently per scope string", () => {
    const store = new IdempotencyStore(1000, () => 0);
    store.complete("POST:/splits", "shared-key", "hash-a", 200, { from: "create" });
    store.complete("POST:/other", "shared-key", "hash-b", 200, { from: "other" });

    expect(store.get("POST:/splits", "shared-key")?.body).toEqual({ from: "create" });
    expect(store.get("POST:/other", "shared-key")?.body).toEqual({ from: "other" });
  });

  it("expires entries once the TTL has elapsed", () => {
    let now = 0;
    const store = new IdempotencyStore(1000, () => now);
    store.complete("POST:/splits", "key-1", "hash-a", 200, { xdr: "XDR" });

    now = 999;
    expect(store.get("POST:/splits", "key-1")).toBeDefined();

    now = 1000;
    expect(store.get("POST:/splits", "key-1")).toBeUndefined();
  });

  it("remove() deletes an entry immediately", () => {
    const store = new IdempotencyStore(1000, () => 0);
    store.complete("POST:/splits", "key-1", "hash-a", 200, { xdr: "XDR" });
    store.remove("POST:/splits", "key-1");

    expect(store.get("POST:/splits", "key-1")).toBeUndefined();
  });

  it("clear() removes all entries", () => {
    const store = new IdempotencyStore(1000, () => 0);
    store.complete("POST:/splits", "key-1", "hash-a", 200, { xdr: "XDR" });
    store.complete("POST:/other", "key-2", "hash-b", 200, { xdr: "XDR2" });
    store.clear();

    expect(store.get("POST:/splits", "key-1")).toBeUndefined();
    expect(store.get("POST:/other", "key-2")).toBeUndefined();
  });
});
