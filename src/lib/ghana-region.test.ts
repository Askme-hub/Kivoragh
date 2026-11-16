import { describe, it, expect } from "vitest";
import { matchGhanaRegion } from "./ghana-region";
describe("matchGhanaRegion", () => {
  it("maps map-service names", () => {
    expect(matchGhanaRegion("Greater Accra Region")).toBe("Greater Accra");
    expect(matchGhanaRegion("Western North Region")).toBe("Western North");
    expect(matchGhanaRegion("Western Region")).toBe("Western");
    expect(matchGhanaRegion("Bono East Region")).toBe("Bono East");
    expect(matchGhanaRegion("Lagos")).toBeNull();
  });
});
