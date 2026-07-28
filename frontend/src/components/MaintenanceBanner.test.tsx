/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MaintenanceBanner } from "./MaintenanceBanner";

describe("MaintenanceBanner", () => {
  it("renders nothing when status is 'ok'", () => {
    const { container } = render(<MaintenanceBanner status="ok" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an alert with default copy for 'degraded' status", () => {
    render(<MaintenanceBanner status="degraded" />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveTextContent(
      "Some services are degraded. Read-only access is unaffected.",
    );
  });

  it("renders an alert with default copy for 'maintenance' status", () => {
    render(<MaintenanceBanner status="maintenance" />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(
      "System is in maintenance mode. Write actions are temporarily disabled.",
    );
  });

  it("prefers a backend-provided message over the default copy", () => {
    render(
      <MaintenanceBanner
        status="maintenance"
        message="Database migration in progress, ETA 15 minutes."
      />,
    );

    expect(
      screen.getByText("Database migration in progress, ETA 15 minutes."),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        "System is in maintenance mode. Write actions are temporarily disabled.",
      ),
    ).toBeNull();
  });

  it("falls back to default copy when message is an empty string", () => {
    render(<MaintenanceBanner status="degraded" message="   " />);

    expect(
      screen.getByText("Some services are degraded. Read-only access is unaffected."),
    ).toBeTruthy();
  });

  it("has no dismiss control, unlike the dismissable error banner", () => {
    render(<MaintenanceBanner status="maintenance" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render for 'ok' even when a stray message is passed", () => {
    const { container } = render(
      <MaintenanceBanner status="ok" message="should not show" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
