/* @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DashboardGridSkeleton,
  ListSkeleton,
  ProjectDetailSkeleton,
  Skeleton,
  SummaryCardSkeleton,
} from "../Skeleton";

describe("Skeleton", () => {
  it("renders a visually-hidden, animated placeholder by default", () => {
    const { container } = render(<Skeleton />);
    const node = container.firstElementChild as HTMLElement;

    expect(node).toBeTruthy();
    expect(node.getAttribute("aria-hidden")).toBe("true");
    expect(node.className).toContain("animate-pulse");
  });

  it("suppresses the pulse animation when animated=false", () => {
    const { container } = render(<Skeleton animated={false} />);
    const node = container.firstElementChild as HTMLElement;

    expect(node.className).toContain("animate-none");
  });
});

describe("ListSkeleton", () => {
  it("renders exactly one placeholder row per `rows`", () => {
    const { container } = render(<ListSkeleton rows={4} />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(4);
  });

  it("defaults to 5 rows while pending, matching the API's documented default", () => {
    const { container } = render(<ListSkeleton />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(5);
  });
});

describe("SummaryCardSkeleton / DashboardGridSkeleton", () => {
  it("renders three placeholder lines per summary card", () => {
    const { container } = render(<SummaryCardSkeleton />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(3);
  });

  it("renders a fixed 6-card grid while dashboard data is pending", () => {
    const { container } = render(<DashboardGridSkeleton />);
    // 6 cards * 3 placeholder lines each.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(18);
  });
});

describe("ProjectDetailSkeleton", () => {
  it("composes a header block with a 4-row list while a project is loading", () => {
    const { container } = render(<ProjectDetailSkeleton />);
    // 2 standalone placeholders (rect header + line) + 4 list rows.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(6);
  });
});
