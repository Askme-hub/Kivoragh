import { describe, it, expect } from "vitest";
import { waNumber, telHref } from "./site-content";
describe("site contact helpers", () => {
  it("converts local Ghana number to WhatsApp format", () => expect(waNumber("025 757 3471")).toBe("233257573471"));
  it("builds tel link", () => expect(telHref("025 757 3471")).toBe("tel:0257573471"));
});
