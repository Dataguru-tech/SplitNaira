import { describe, it, expect } from "vitest";
import { toCollaboratorScVal } from "../services/contract-helpers.js";

describe("toCollaboratorScVal", () => {
  it("should throw an error if alias exceeds 100 characters", () => {
    const longAlias = "a".repeat(101);
    
    expect(() => {
      toCollaboratorScVal({
        address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        alias: longAlias,
        basisPoints: 5000
      });
    }).toThrow("Alias too long");
  });

  it("should not throw an error if alias is 100 characters or less", () => {
    const validAlias = "a".repeat(100);
    
    expect(() => {
      toCollaboratorScVal({
        address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        alias: validAlias,
        basisPoints: 5000
      });
    }).not.toThrow();
  });
});
