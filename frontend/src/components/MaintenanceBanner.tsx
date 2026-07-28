"use client";

/**
 * Concise, persistent banner surfacing backend maintenance/degraded status
 * (#934). Styled consistently with NetworkStatusBanner's conventions
 * (role="alert", aria-live, lucide icon, single-line message) but — unlike
 * the dismissable NetworkErrorBanner — this has no dismiss control, since it
 * should stay visible for the duration of the condition it reports.
 */

import { AlertTriangle, Wrench } from "lucide-react";

import type { SystemStatus } from "@/lib/api-client";

export interface MaintenanceBannerProps {
  status: SystemStatus;
  message?: string;
  className?: string;
}

const DEFAULT_MESSAGES: Record<Exclude<SystemStatus, "ok">, string> = {
  degraded: "Some services are degraded. Read-only access is unaffected.",
  maintenance:
    "System is in maintenance mode. Write actions are temporarily disabled.",
};

/**
 * Renders nothing when `status` is "ok".
 */
export function MaintenanceBanner({
  status,
  message,
  className,
}: Readonly<MaintenanceBannerProps>) {
  if (status === "ok") return null;

  const isMaintenance = status === "maintenance";
  const Icon = isMaintenance ? Wrench : AlertTriangle;
  const text = message && message.trim() ? message : DEFAULT_MESSAGES[status];

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="maintenance-banner"
      className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
        isMaintenance
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      } ${className ?? ""}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="font-medium">{text}</p>
    </div>
  );
}
