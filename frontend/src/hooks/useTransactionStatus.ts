"use client";

import { useEffect, useState, useRef } from "react";

const MAX_POLL_ATTEMPTS = 6;
const BASE_POLL_DELAY_MS = 500;

interface TransactionRecord {
  txHash: string;
  projectId: string;
  action: string;
  amount: string | null;
  createdAt: Date;
}

interface TransactionStatusEvent {
  status: "completed" | "error" | "timeout";
  record?: TransactionRecord;
  message?: string;
}

export interface UseTransactionStatusResult {
  status: "pending" | "completed" | "error" | "timeout" | null;
  record: TransactionRecord | null;
  error: string | null;
}

export function useTransactionStatus(
  txHash: string | null,
  enabled = true,
): UseTransactionStatusResult {
  const [status, setStatus] = useState<
    "pending" | "completed" | "error" | "timeout" | null
  >(null);
  const [record, setRecord] = useState<TransactionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearPollTimer = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const closeEventSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const pollForStatus = async (attempt = 0): Promise<void> => {
      if (!txHash || cancelled) return;

      try {
        const response = await fetch(`/api/transactions/${encodeURIComponent(txHash)}`);
        if (cancelled) return;

        if (response.ok) {
          const payload = (await response.json()) as
            | (TransactionRecord & { status?: string; message?: string })
            | null;

          const normalizedStatus = String(payload?.status ?? "").toLowerCase();

          if (normalizedStatus === "completed" || normalizedStatus === "success") {
            setStatus("completed");
            setRecord(payload as TransactionRecord);
            setError(null);
            return;
          }

          if (normalizedStatus === "failed" || normalizedStatus === "error") {
            setStatus("error");
            setError(payload?.message ?? "Transaction failed");
            return;
          }
        }
      } catch {
        // Continue retrying with backoff on transient network errors.
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setStatus("timeout");
        setError("Timed out waiting for transaction confirmation");
        return;
      }

      const delay = Math.min(BASE_POLL_DELAY_MS * 2 ** attempt, 5_000);
      pollTimerRef.current = setTimeout(() => {
        void pollForStatus(attempt + 1);
      }, delay);
    };

    const startPollingFallback = () => {
      closeEventSource();
      void pollForStatus();
    };

    if (!txHash || !enabled) {
      closeEventSource();
      clearPollTimer();
      setStatus(null);
      setRecord(null);
      setError(null);
      return;
    }

    // Check if EventSource is supported
    if (typeof EventSource === "undefined") {
      console.warn("EventSource not supported, falling back to polling");
      setStatus("pending");
      setError(null);
      startPollingFallback();
      return () => {
        cancelled = true;
        clearPollTimer();
      };
    }

    setStatus("pending");
    setError(null);
    setRecord(null);

    // Open SSE connection
    const url = `/api/events/transactions/${encodeURIComponent(txHash)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as
          | TransactionStatusEvent
          | (TransactionRecord & { status?: string });

        if (
          (data as TransactionStatusEvent).status === "completed" &&
          (data as TransactionStatusEvent).record
        ) {
          setStatus("completed");
          setRecord((data as TransactionStatusEvent).record ?? null);
          eventSource.close();
        } else if ((data as TransactionStatusEvent).status === "error") {
          setStatus("error");
          setError((data as TransactionStatusEvent).message || "Unknown error occurred");
          eventSource.close();
        } else if ((data as TransactionStatusEvent).status === "timeout") {
          setStatus("timeout");
          eventSource.close();
        } else if (
          data &&
          typeof data === "object" &&
          "txHash" in data
        ) {
          // Backend SSE may emit the transaction record directly.
          setStatus("completed");
          setRecord(data as TransactionRecord);
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
        startPollingFallback();
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      startPollingFallback();
    };

    // Cleanup on unmount or when txHash changes
    return () => {
      cancelled = true;
      closeEventSource();
      clearPollTimer();
    };
  }, [txHash, enabled]);

  return { status, record, error };
}
