/* @vitest-environment jsdom */

import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import useLockBodyScroll from "../useLockBodyScroll";

function Host({ locked }: { locked: boolean }) {
  useLockBodyScroll(locked);
  return <div>{locked ? "locked" : "unlocked"}</div>;
}

function ToggleHost() {
  const [locked, setLocked] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setLocked((prev) => !prev)}>
        Toggle Lock
      </button>
      <Host locked={locked} />
    </div>
  );
}

describe("useLockBodyScroll", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("applies the lock when locked=true", () => {
    render(<Host locked={true} />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does not apply the lock when locked=false", () => {
    render(<Host locked={false} />);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("releases the lock when locked toggles false \u2192 true \u2192 false", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Host locked={false} />);
    expect(document.body.style.overflow).not.toBe("hidden");

    rerender(<Host locked={true} />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Host locked={false} />);
    expect(document.body.style.overflow).not.toBe("hidden");

    // Toggle via state-driven host to also exercise the useState path.
    rerender(<ToggleHost />);
    await user.click(screen.getByText("Toggle Lock"));
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByText("Toggle Lock"));
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("cleans up body overflow on unmount even if locked=true at the time", () => {
    const { unmount } = render(<Host locked={true} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    // Cleanup effect must reset the body overflow.
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
