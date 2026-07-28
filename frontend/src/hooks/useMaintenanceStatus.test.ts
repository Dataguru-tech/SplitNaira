import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMaintenanceStatus } from "./useMaintenanceStatus";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getSystemStatus: vi.fn(),
}));

describe("useMaintenanceStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api.getSystemStatus).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with a safe 'ok' default before the first poll resolves", () => {
    vi.mocked(api.getSystemStatus).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useMaintenanceStatus());

    expect(result.current.status).toBe("ok");
    expect(result.current.isWriteDisabled).toBe(false);
  });

  it("fetches status once on mount", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({ status: "ok" });

    renderHook(() => useMaintenanceStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
  });

  it("polls on the given interval and stops after unmount", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({ status: "ok" });

    const { unmount } = renderHook(() => useMaintenanceStatus(10_000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(api.getSystemStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(api.getSystemStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(api.getSystemStatus).toHaveBeenCalledTimes(3);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // No further calls after unmount — the polling interval was cleared.
    expect(api.getSystemStatus).toHaveBeenCalledTimes(3);
  });

  it("defaults to a 30s poll interval when none is provided", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({ status: "ok" });

    renderHook(() => useMaintenanceStatus());

    await act(async () => {
      await Promise.resolve();
    });
    expect(api.getSystemStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(api.getSystemStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api.getSystemStatus).toHaveBeenCalledTimes(2);
  });

  // ── Entering maintenance mode ──────────────────────────────────────────

  it("flips from ok to maintenance mid-poll and disables writes", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValueOnce({ status: "ok" });

    const { result } = renderHook(() => useMaintenanceStatus(5_000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("ok");
    expect(result.current.isWriteDisabled).toBe(false);

    vi.mocked(api.getSystemStatus).mockResolvedValueOnce({
      status: "maintenance",
      message: "Scheduled maintenance in progress.",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.status).toBe("maintenance");
    expect(result.current.isWriteDisabled).toBe(true);
    expect(result.current.message).toBe("Scheduled maintenance in progress.");
  });

  it("marks 'degraded' as informational only — writes stay enabled", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({
      status: "degraded",
      message: "A dependency is unhealthy.",
    });

    const { result } = renderHook(() => useMaintenanceStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe("degraded");
    expect(result.current.isWriteDisabled).toBe(false);
  });

  // ── Leaving maintenance mode ────────────────────────────────────────────

  it("flips from maintenance back to ok and re-enables writes", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValueOnce({
      status: "maintenance",
      message: "Down for maintenance.",
    });

    const { result } = renderHook(() => useMaintenanceStatus(5_000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("maintenance");
    expect(result.current.isWriteDisabled).toBe(true);

    vi.mocked(api.getSystemStatus).mockResolvedValueOnce({ status: "ok" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.status).toBe("ok");
    expect(result.current.isWriteDisabled).toBe(false);
    expect(result.current.message).toBeUndefined();
  });

  it("fails open to 'ok' if a poll tick rejects", async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValueOnce({
      status: "maintenance",
    });

    const { result } = renderHook(() => useMaintenanceStatus(5_000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("maintenance");

    vi.mocked(api.getSystemStatus).mockRejectedValueOnce(new Error("boom"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.status).toBe("ok");
    expect(result.current.isWriteDisabled).toBe(false);
  });

  it("does not update state after unmount even if an in-flight poll resolves later", async () => {
    let resolvePoll: ((value: { status: "ok" | "degraded" | "maintenance" }) => void) | null =
      null;
    vi.mocked(api.getSystemStatus).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMaintenanceStatus());
    unmount();

    await act(async () => {
      resolvePoll?.({ status: "maintenance" });
      await Promise.resolve();
    });

    // Hook result is frozen at its last rendered value; no error should be
    // thrown from a "setState after unmount" attempt.
    expect(result.current.status).toBe("ok");
  });
});
