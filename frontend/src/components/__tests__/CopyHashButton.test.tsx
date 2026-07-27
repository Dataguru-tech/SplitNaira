/* @vitest-environment jsdom */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { CopyHashButton } from "../CopyHashButton";

const MOCK_HASH = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2";

describe("CopyHashButton", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with accessible label for copying", () => {
    render(<CopyHashButton hash={MOCK_HASH} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Copy transaction hash to clipboard");
    expect(button.getAttribute("title")).toBe("Copy transaction hash");
  });

  it("copies the full hash to clipboard on click", async () => {
    render(<CopyHashButton hash={MOCK_HASH} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(writeTextMock).toHaveBeenCalledWith(MOCK_HASH);
  });

  it("shows copied state with accessible label after successful copy", async () => {
    render(<CopyHashButton hash={MOCK_HASH} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Transaction hash copied");
    expect(button.getAttribute("title")).toBe("Copied!");
  });

  it("reverts to initial state after 2 seconds", async () => {
    vi.useFakeTimers();

    render(<CopyHashButton hash={MOCK_HASH} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Transaction hash copied"
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Copy transaction hash to clipboard"
    );

    vi.useRealTimers();
  });

  it("handles clipboard write failure gracefully", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("Clipboard not available"));

    render(<CopyHashButton hash={MOCK_HASH} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Copy transaction hash to clipboard"
    );
  });

  it("does not truncate the hash in the copied value", async () => {
    const longHash = "a".repeat(64);

    render(<CopyHashButton hash={longHash} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(writeTextMock).toHaveBeenCalledWith(longHash);
    expect(writeTextMock.mock.calls[0][0]).toHaveLength(64);
  });
});
