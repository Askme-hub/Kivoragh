/**
 * Validate the authoritative Moolre status response before finalizing an order.
 * Amounts are compared in pesewas to avoid floating-point currency drift.
 */
export function isMatchingMoolrePayment(
  payment: { txstatus?: unknown; externalref?: unknown; amount?: unknown } | null | undefined,
  expected: { reference: string; amountGhs: number },
): boolean {
  if (!payment || !expected.reference || !Number.isFinite(expected.amountGhs) || expected.amountGhs <= 0) {
    return false;
  }

  const paidAmount = Number(payment.amount);
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) return false;

  return (
    payment.txstatus === 1 &&
    payment.externalref === expected.reference &&
    Math.round(paidAmount * 100) === Math.round(expected.amountGhs * 100)
  );
}
