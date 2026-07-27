/* @vitest-environment jsdom */

import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NProgress from "nprogress";

import { LoadingBar, reportLoadingFlags, type LoadingBarFlags } from "../LoadingBar";

const idleFlags: LoadingBarFlags = {
  isLoadingDashboard: false,
  isLoadingProjectsList: false,
  isFetchingProject: false,
};

/**
 * Mirrors the reporting + cleanup pattern used by split-app-legacy.tsx:
 * pushes flags on mount/update, and resets them to idle when it unmounts
 * (e.g. when the user navigates away mid-fetch).
 */
function FlagReporter({ loading }: { loading: boolean }) {
  useEffect(() => {
    reportLoadingFlags({ ...idleFlags, isFetchingProject: loading });
    return () => {
      reportLoadingFlags(idleFlags);
    };
  }, [loading]);
  return null;
}

describe("LoadingBar", () => {
  afterEach(() => {
    act(() => {
      reportLoadingFlags(idleFlags);
    });
    vi.restoreAllMocks();
  });

  it("starts NProgress as soon as any loading flag turns on", () => {
    const startSpy = vi.spyOn(NProgress, "start");
    render(<LoadingBar />);

    act(() => {
      reportLoadingFlags({ ...idleFlags, isFetchingProject: true });
    });

    expect(startSpy).toHaveBeenCalled();
  });

  it("completes NProgress once every loading flag turns off", () => {
    const doneSpy = vi.spyOn(NProgress, "done");
    render(<LoadingBar />);

    act(() => {
      reportLoadingFlags({ ...idleFlags, isLoadingProjectsList: true });
    });
    doneSpy.mockClear();

    act(() => {
      reportLoadingFlags(idleFlags);
    });

    expect(doneSpy).toHaveBeenCalled();
  });

  it("does not complete while any other flag is still loading", () => {
    const doneSpy = vi.spyOn(NProgress, "done");
    render(<LoadingBar />);

    act(() => {
      reportLoadingFlags({ isLoadingDashboard: true, isLoadingProjectsList: true, isFetchingProject: false });
    });
    doneSpy.mockClear();

    // Dashboard fetch finishes, but the projects list is still loading —
    // the bar must stay in the "started" state, not flicker to done.
    act(() => {
      reportLoadingFlags({ isLoadingDashboard: false, isLoadingProjectsList: true, isFetchingProject: false });
    });

    expect(doneSpy).not.toHaveBeenCalled();
  });

  it("resets to done when the fetching component unmounts before its fetch resolves", () => {
    const doneSpy = vi.spyOn(NProgress, "done");

    function Harness({ showReporter }: { showReporter: boolean }) {
      return (
        <>
          <LoadingBar />
          {showReporter && <FlagReporter loading />}
        </>
      );
    }

    const { rerender } = render(<Harness showReporter />);
    doneSpy.mockClear();

    // Simulate navigating away / switching tabs before the fetch it was
    // tracking would otherwise have completed on its own.
    act(() => {
      rerender(<Harness showReporter={false} />);
    });

    expect(doneSpy).toHaveBeenCalled();
  });
});
