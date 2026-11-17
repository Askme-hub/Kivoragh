import { describe, it, expect } from "vitest";
import { parseSubscriptionRef, subscriptionRef } from "./subscription-activate.server";
const uid = "1b2c3d4e-5f60-4718-9a0b-1c2d3e4f5a6b";
describe("subscription refs", () => {
  it("round-trips plan and seller id", () => expect(parseSubscriptionRef(subscriptionRef("premium", uid))).toEqual({ plan: "premium", userId: uid }));
  it("rejects order refs and unknown plans", () => {
    expect(parseSubscriptionRef("KV-abc-123")).toBeNull();
    expect(parseSubscriptionRef(`SUB-free-${uid.replace(/-/g, "")}-1`)).toBeNull();
  });
});
