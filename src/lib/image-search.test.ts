import { describe, it, expect } from "vitest";
import { queryVariants } from "./image-search.functions";
describe("queryVariants", () => {
  it("broadens a spec-heavy name", () => {
    const v = queryVariants("Infinix Hot 40 128GB Blue");
    expect(v[0]).toBe("Infinix Hot 40 128GB Blue");
    expect(v).toContain("Infinix Hot 40");
    expect(v).toContain("Infinix");
  });
});
