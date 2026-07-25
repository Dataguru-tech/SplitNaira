import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTransactionStatus } from "./useTransactionStatus";

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

describe("useTransactionStatus", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses SSE updates when the stream succeeds", async () => {
    const { result } = renderHook(() => useTransactionStatus("tx-sse-success", true));

    expect(result.current.status).toBe("pending");
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toContain("/api/events/transactions/tx-sse-success");

    act(() => {
      MockEventSource.instances[0]?.onmessage?.({
        data: JSON.stringify({
          status: "completed",
          record: {
            txHash: "tx-sse-success",
            projectId: "project-1",
            action: "create",
            amount: "100",
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe("completed");
      expect(result.current.record?.txHash).toBe("tx-sse-success");
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to polling after SSE connection errors and recovers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "completed",
          txHash: "tx-fallback",
          projectId: "project-2",
          action: "create",
          amount: "250",
          createdAt: new Date().toISOString(),
        }),
      } as Response);

    const { result } = renderHook(() => useTransactionStatus("tx-fallback", true));

    act(() => {
      MockEventSource.instances[0]?.onerror?.(new Error("socket dropped"));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("completed");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.record?.txHash).toBe("tx-fallback");
    });
  });

  it("falls back to polling when EventSource is unavailable", async () => {
    vi.stubGlobal("EventSource", undefined as unknown as typeof EventSource);

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "completed",
        txHash: "tx-no-sse",
        projectId: "project-3",
        action: "create",
        amount: "300",
        createdAt: new Date().toISOString(),
      }),
    } as Response);

    const { result } = renderHook(() => useTransactionStatus("tx-no-sse", true));

    await waitFor(() => {
      expect(result.current.status).toBe("completed");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.record?.txHash).toBe("tx-no-sse");
    });
  });
});
