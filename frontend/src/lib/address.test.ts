import { describe, expect, it } from "vitest";

import {
  findDuplicateCollaboratorAddressIds,
  isOwner,
  normalizeStellarAddress,
} from "./address";

describe("isOwner", () => {
  it("returns true for matching addresses", () => {
    expect(isOwner("GABC123", "GABC123")).toBe(true);
  });

  it("returns true for case-insensitive matches", () => {
    expect(isOwner("gabc123", "GABC123")).toBe(true);
  });

  it("returns false for mismatched addresses", () => {
    expect(isOwner("GABC123", "GDEF456")).toBe(false);
  });

  it("returns false when connected address is null or undefined", () => {
    expect(isOwner("GABC123", null)).toBe(false);
    expect(isOwner("GABC123", undefined)).toBe(false);
  });
});

describe("normalizeStellarAddress", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeStellarAddress("  GABC123  ")).toBe("GABC123");
  });

  it("uppercases the address", () => {
    expect(normalizeStellarAddress("gabc123")).toBe("GABC123");
  });

  it("handles mixed casing and whitespace together", () => {
    expect(normalizeStellarAddress("  gAbC123\n")).toBe("GABC123");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeStellarAddress("   ")).toBe("");
  });
});

describe("findDuplicateCollaboratorAddressIds", () => {
  it("returns an empty set when there are no duplicates", () => {
    const result = findDuplicateCollaboratorAddressIds([
      { id: "a", address: "GABC111" },
      { id: "b", address: "GDEF222" },
    ]);
    expect(result.size).toBe(0);
  });

  it("flags both entries on an exact duplicate", () => {
    const result = findDuplicateCollaboratorAddressIds([
      { id: "a", address: "GABC111" },
      { id: "b", address: "GABC111" },
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("flags duplicates that differ only by casing", () => {
    const result = findDuplicateCollaboratorAddressIds([
      { id: "a", address: "gabc111" },
      { id: "b", address: "GABC111" },
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("flags duplicates that differ only by surrounding whitespace", () => {
    const result = findDuplicateCollaboratorAddressIds([
      { id: "a", address: "  GABC111" },
      { id: "b", address: "GABC111  " },
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("flags every entry when more than two share an address", () => {
    const result = findDuplicateCollaboratorAddressIds([
      { id: "a", address: "GABC111" },
      { id: "b", address: " gabc111 " },
      { id: "c", address: "GABC111" },
      { id: "d", address: "GDEF222" },
    ]);
    expect(result).toEqual(new Set(["a", "b", "c"]));
  });

  it("ignores empty addresses", () => {
    const result = findDuplicateCollaboratorAddressIds([
      { id: "a", address: "" },
      { id: "b", address: "   " },
    ]);
    expect(result.size).toBe(0);
  });
});
