"use client";

import { useEffect, useState } from "react";

import { getSystemStatus } from "@/lib/api";
import type { SystemStatus } from "@/lib/api-client";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

export interface UseMaintenanceStatusResult {
  /** Raw status as reported by (a tolerant mapping of) the backend health endpoint. */
  status: SystemStatus;
  /**
   * Whether write actions should be disabled.
   *
   * Design choice: "degraded" is informational only — reads and writes both
   * keep working, the banner is just a heads-up. "maintenance" additionally
   * disables writes while leaving read-only flows unaffected, matching the
   * issue's "without blocking unaffected read-only flows" requirement.
   */
  isWriteDisabled: boolean;
  /** Optional human-readable detail from the backend, shown in the banner. */
  message?: string;
}

/**
 * Polls the backend health/status endpoint on an interval and exposes a
 * simplified maintenance-mode signal for the UI.
 *
 * A single call to this hook should live at the app/SPA root, with the
 * result threaded down via props (or context) rather than every component
 * polling independently.
 */
export function useMaintenanceStatus(
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): UseMaintenanceStatusResult {
  const [status, setStatus] = useState<SystemStatus>("ok");
  const [message, setMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const result = await getSystemStatus();
        if (cancelled) return;
        setStatus(result.status);
        setMessage(result.message);
      } catch {
        // getSystemStatus is documented to fail open and not throw, but
        // guard anyway so a poll tick can never crash the app.
        if (!cancelled) {
          setStatus("ok");
          setMessage(undefined);
        }
      }
    };

    void checkStatus();

    const interval = setInterval(() => {
      void checkStatus();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return {
    status,
    isWriteDisabled: status === "maintenance",
    message,
  };
}
