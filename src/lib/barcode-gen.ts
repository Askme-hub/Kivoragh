/** Generates unique Kivora shop barcodes: "KV" + 8 digits + 1 check digit (Code 128 friendly). */
export function barcodeCheckDigit(digits: string): number {
  const sum = digits.split("").reduce((a, d, i) => a + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

export function generateBarcode(existing: Iterable<string> = [], rand: () => number = Math.random): string {
  const taken = new Set([...existing].map((c) => c.trim().toUpperCase()));
  for (let i = 0; i < 50; i++) {
    const body = String(Math.floor(rand() * 1e8)).padStart(8, "0");
    const code = `KV${body}${barcodeCheckDigit(body)}`;
    if (!taken.has(code)) return code;
  }
  throw new Error("Could not create a unique barcode");
}
