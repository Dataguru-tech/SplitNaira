/* @vitest-environment jsdom */
// #949 — Clipboard fallback behavior tests for CopyAddressButton.
//
// Covers: clipboard API unavailable (navigator.clipboard is undefined),
// writeText rejection (permission denied), and the happy-path to confirm
// normal behavior still works.

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { CopyAddressButton } from "../CopyAddressButton";

const MOCK_ADDRESS = "GBMJFZXMLRJF5TGSEPQ4GJ2UT7PJYCRQEXW7JZ7ZDQEXCZWJ5YN4HCC";

describe("CopyAddressButton — clipboard fallback behavior (#949)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when navigator.clipboard is available", () => {
    let writeTextMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
    });

    it("renders copy button with accessible label", () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);
      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).toBe("Copy address to clipboard");
    });

    it("calls clipboard.writeText with the full address", async () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(writeTextMock).toHaveBeenCalledOnce();
      expect(writeTextMock).toHaveBeenCalledWith(MOCK_ADDRESS);
    });

    it("shows copied state after a successful write", async () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).toBe("Address copied");
      expect(button.getAttribute("title")).toBe("Copied!");
    });

    it("reverts to initial state after 2 seconds", async () => {
      vi.useFakeTimers();

      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Address copied");

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Copy address to clipboard");

      vi.useRealTimers();
    });
  });

  describe("clipboard permission denied (writeText rejects)", () => {
    let writeTextMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeTextMock = vi.fn().mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
    });

    it("does not throw when clipboard permission is denied", async () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await expect(
        act(async () => {
          fireEvent.click(screen.getByRole("button"));
        })
      ).resolves.not.toThrow();
    });

    it("stays in initial state when clipboard write is rejected", async () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).toBe("Copy address to clipboard");
      expect(button.getAttribute("title")).toBe("Copy address");
    });
  });

  describe("clipboard API unavailable (navigator.clipboard is undefined)", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    it("does not throw when navigator.clipboard is undefined", async () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await expect(
        act(async () => {
          fireEvent.click(screen.getByRole("button"));
        })
      ).resolves.not.toThrow();
    });

    it("stays in initial state when clipboard is unavailable", async () => {
      render(<CopyAddressButton address={MOCK_ADDRESS} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).toBe("Copy address to clipboard");
    });
  });
});
