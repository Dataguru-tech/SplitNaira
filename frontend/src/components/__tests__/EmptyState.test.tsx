/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders an accessible empty state for the no-projects variant", () => {
    render(<EmptyState variant="no-projects" />);

    const root = screen.getByTestId("empty-state");
    expect(root).toHaveAttribute("data-variant", "no-projects");
    expect(root).toHaveAttribute("role", "status");
    // polite live region so SR users hear updates without being interrupted.
    expect(root).toHaveAttribute("aria-live", "polite");

    expect(screen.getByTestId("empty-state-title")).toHaveTextContent(
      /No projects found/,
    );
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      /Refresh Projects/,
    );
    // No primary action was supplied \u2014 nothing should be rendered.
    expect(screen.queryByTestId("empty-state-primary")).toBeNull();
    expect(screen.queryByTestId("empty-state-retry")).toBeNull();
  });

  it("renders a primary action when both label and handler are provided for disconnected wallet", async () => {
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        variant="wallet-disconnected"
        primaryActionLabel="Connect Wallet"
        onPrimaryAction={onConnect}
      />,
    );

    const button = screen.getByTestId("empty-state-primary");
    expect(button).toHaveTextContent("Connect Wallet");

    await user.click(button);
    expect(onConnect).toHaveBeenCalledTimes(1);

    // The default copy for wallet-disconnected is used when no overrides.
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent(
      /Connect your wallet/,
    );
  });

  it("renders a loading-failure state with assertive live region and retry handler", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        variant="loading-failure"
        primaryActionLabel="Refresh Projects"
        onPrimaryAction={() => {}}
        retryLabel="Retry now"
        onRetry={onRetry}
      />,
    );

    const root = screen.getByTestId("empty-state");
    expect(root).toHaveAttribute("role", "alert");
    expect(root).toHaveAttribute("aria-live", "assertive");

    await user.click(screen.getByTestId("empty-state-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("invokes the primary retry handler when refresh succeeds (Issue #837 coverage)", async () => {
    // The dashboard's `onFetchProjectsList` callback is wired here to model
    // the retry-success path described in Issue #837. After the click, the
    // loader is replaced with the populated list and the empty state is
    // gone \u2014 we test the side of the transition the EmptyState owns.
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    const { rerender } = render(
      <EmptyState
        variant="loading-failure"
        primaryActionLabel="Refresh Projects"
        onPrimaryAction={onRefresh}
      />,
    );

    await user.click(screen.getByTestId("empty-state-primary"));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // After a successful refresh, the caller re-renders without the empty
    // state \u2014 unmounting our element entirely.
    rerender(<div data-testid="populated">projects loaded</div>);
    expect(screen.queryByTestId("empty-state")).toBeNull();
    expect(screen.getByTestId("populated")).toBeInTheDocument();
  });

  it("falls back to default copy variants per dashboard variant", () => {
    const { rerender } = render(<EmptyState variant="no-projects" />);
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      /Refresh Projects/,
    );

    rerender(<EmptyState variant="wallet-disconnected" />);
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      /Stellar account/,
    );

    rerender(<EmptyState variant="loading-failure" />);
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      /Try again/,
    );
  });

  it("supports custom overrride title and description without affecting tests asserting defaults", () => {
    render(
      <EmptyState
        variant="no-projects"
        title="Custom title"
        description="Custom description text."
      />,
    );
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent("Custom title");
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      "Custom description text.",
    );
  });

  it("does not render a primary button if only the label is provided (callers must pair them)", () => {
    render(<EmptyState variant="no-projects" primaryActionLabel="Orphan Label" />);
    expect(screen.queryByTestId("empty-state-primary")).toBeNull();
  });

  it("renders children in the footer slot", () => {
    render(
      <EmptyState
        variant="no-projects"
        primaryActionLabel="Refresh Projects"
        onPrimaryAction={() => {}}
      >
        <span>Source: Stellar RPC</span>
      </EmptyState>,
    );
    expect(screen.getByTestId("empty-state-footer")).toHaveTextContent(
      "Source: Stellar RPC",
    );
  });

  it("fires both primary and retry handlers as separate user actions", () => {
    const onPrimary = vi.fn();
    const onRetry = vi.fn();
    render(
      <EmptyState
        variant="loading-failure"
        primaryActionLabel="Refresh Projects"
        onPrimaryAction={onPrimary}
        retryLabel="Retry now"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByTestId("empty-state-primary"));
    fireEvent.click(screen.getByTestId("empty-state-retry"));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
