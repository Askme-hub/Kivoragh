import { describe, it, expect } from "vitest";
import { generateBarcode, barcodeCheckDigit } from "./barcode-gen";

describe("generateBarcode", () => {
  it("makes KV + 9 digits", () => {
    expect(generateBarcode()).toMatch(/^KV\d{9}$/);
  });
  it("never repeats an existing code", () => {
    const seq = [0.1, 0.1, 0.2];
    let i = 0;
    const first = generateBarcode([], () => seq[0]);
    expect(generateBarcode([first], () => seq[i++])).not.toBe(first);
  });
  it("check digit is valid", () => {
    expect(barcodeCheckDigit("00000000")).toBe(0);
    expect(barcodeCheckDigit("10000000")).toBe(7);
  });
});
