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

import { encodeOrderCard, parseOrderCard, orderSubtotal } from "./chat-product";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("order cards", () => {
  i2("round-trips items and totals price × qty", () => {
    const body = encodeOrderCard({ items: [{ id: "a", name: "Shoe [L]", price: 120, qty: 2, image: null }, { id: "b", name: "Cap", price: 30, qty: 1, image: null }] }, "Here you go");
    const { order, text } = parseOrderCard(body);
    e2(order?.items).toHaveLength(2);
    e2(order?.items[0].name).toBe("Shoe [L]");
    e2(orderSubtotal(order!)).toBe(270);
    e2(text).toBe("Here you go");
  });
  i2("ignores normal messages", () => {
    e2(parseOrderCard("hello").order).toBeNull();
  });
});
