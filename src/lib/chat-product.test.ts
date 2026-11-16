import { describe, it, expect } from "vitest";
import { encodeProductTag, parseProductTag, previewBody, looksRisky } from "./chat-product";
const id = "123e4567-e89b-12d3-a456-426614174000";
describe("chat product tags", () => {
  it("round-trips a tag with text", () => {
    expect(parseProductTag(encodeProductTag(id, "Is this available?"))).toEqual({ productId: id, text: "Is this available?" });
  });
  it("tag without text", () => {
    expect(parseProductTag(encodeProductTag(id, ""))).toEqual({ productId: id, text: "" });
    expect(previewBody(encodeProductTag(id, ""))).toBe("🏷️ Tagged a product");
  });
  it("plain messages untouched", () => {
    expect(parseProductTag("hello")).toEqual({ productId: null, text: "hello" });
  });
  it("flags pay-first requests", () => {
    expect(looksRisky("Send momo first please")).toBe(true);
    expect(looksRisky("I'll deliver tomorrow")).toBe(false);
  });
});
