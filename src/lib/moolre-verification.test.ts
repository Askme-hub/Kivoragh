import { describe, expect, it } from "vitest";
import { isMatchingMoolrePayment } from "./moolre-verification";

const expected = { reference: "KV_ORDER_123", amountGhs: 125.5 };
const validPayment = { txstatus: 1, externalref: expected.reference, amount: 125.5 };

describe("isMatchingMoolrePayment", () => {
  it("accepts a successful payment with the exact reference and GHS amount", () => {
    expect(isMatchingMoolrePayment(validPayment, expected)).toBe(true);
  });

  it("accepts a provider amount represented as a numeric string", () => {
    expect(isMatchingMoolrePayment({ ...validPayment, amount: "125.50" }, expected)).toBe(true);
  });

  it("checks only the remaining MoMo debit when store credit covered part of the order", () => {
    const orderTotal = 125.5;
    const storeCreditApplied = 40;
    const amountChargedToPhone = orderTotal - storeCreditApplied;

    expect(
      isMatchingMoolrePayment(
        { txstatus: 1, externalref: expected.reference, amount: amountChargedToPhone },
        { reference: expected.reference, amountGhs: amountChargedToPhone },
      ),
    ).toBe(true);
    expect(
      isMatchingMoolrePayment(
        { txstatus: 1, externalref: expected.reference, amount: orderTotal },
        { reference: expected.reference, amountGhs: amountChargedToPhone },
      ),
    ).toBe(false);
  });

  it.each([
    { txstatus: 2 },
    { txstatus: 0 },
    { externalref: "ANOTHER_ORDER" },
    { amount: 125.49 },
    { amount: null },
    { amount: "not-a-number" },
  ])("rejects an unsuccessful or mismatched provider response %#", (override) => {
    expect(isMatchingMoolrePayment({ ...validPayment, ...override }, expected)).toBe(false);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid expected amount %s", (amountGhs) => {
    expect(isMatchingMoolrePayment(validPayment, { ...expected, amountGhs })).toBe(false);
  });

  it("rejects a missing payment response", () => {
    expect(isMatchingMoolrePayment(null, expected)).toBe(false);
  });
});
