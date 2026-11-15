import { describe, it, expect } from "vitest";
import { pickCampaign, DEFAULT_CAMPAIGNS, type PopupCampaign } from "./popup-campaigns";
const base = { views: { total: 0, cats: {} }, cartCount: 0, exitIntent: false, seen: {}, now: Date.now() };
const phones: PopupCampaign = { id: "p", title: "Phones", trigger: "category", category: "Phones", active: true };
describe("pickCampaign", () => {
  it("shows nothing on first landing", () => expect(pickCampaign(DEFAULT_CAMPAIGNS, base)).toBeNull());
  it("browsing pop-up after 2 product views", () => expect(pickCampaign(DEFAULT_CAMPAIGNS, { ...base, views: { total: 2, cats: {} } })?.id).toBe("default-browse"));
  it("cart nudge needs items and exit intent", () => {
    expect(pickCampaign(DEFAULT_CAMPAIGNS, { ...base, exitIntent: true })).toBeNull();
    expect(pickCampaign(DEFAULT_CAMPAIGNS, { ...base, cartCount: 1, exitIntent: true })?.id).toBe("default-cart");
  });
  it("category deal matches viewed category", () => expect(pickCampaign([phones], { ...base, views: { total: 1, cats: { phones: 1 }, lastCat: "phones" } })?.id).toBe("p"));
  it("same offer not repeated within a day", () => expect(pickCampaign(DEFAULT_CAMPAIGNS, { ...base, views: { total: 3, cats: {} }, seen: { "default-browse": Date.now() - 1000 } })).toBeNull());
});
