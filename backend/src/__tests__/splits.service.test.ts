import { describe, it, expect, vi } from "vitest";
import { buildDepositUnsignedXdr } from "../services/splits.service.js";

vi.mock("../services/stellar.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/stellar.js")>();
  const cacheStore = new Map<string, unknown>([
    ["project:test_project", { token: "PROJECT_TOKEN_ADDRESS" }],
  ]);
  return {
    ...actual,
    getCached: vi.fn((key: string) => cacheStore.get(key)),
    setCached: vi.fn((key: string, value: unknown) => { cacheStore.set(key, value); }),
    getCachedOrFetch: vi.fn(async (key: string, fetcher: () => Promise<unknown>) => {
      const cached = cacheStore.get(key);
      if (cached !== undefined) return cached;
      const value = await fetcher();
      cacheStore.set(key, value);
      return value;
    }),
  };
});

describe("buildDepositUnsignedXdr", () => {
  it("should fail if the token does not match the project token", async () => {
    await expect(
      buildDepositUnsignedXdr({
        projectId: "test_project",
        from: "GDTM6Q3ZGE4A4I7V2B2D7N4X2O4YI6L4S4Z4L6U3Y6V4Q2Z2F4E2K4M4",
        amount: 100,
        token: "WRONG_TOKEN_ADDRESS"
      })
    ).rejects.toThrow("Token address does not match project token address");
  });
});