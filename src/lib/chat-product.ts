/** Product tags are stored inside the message text so older app versions still show readable text. */
const TAG_RE = /^\[\[product:([0-9a-f-]{36})\]\]\n?/i;

export function encodeProductTag(productId: string, text: string) {
  return `[[product:${productId}]]\n${text.trim()}`.trimEnd();
}

export function parseProductTag(body: string): { productId: string | null; text: string } {
  const m = body.match(TAG_RE);
  if (!m) return { productId: null, text: body };
  return { productId: m[1], text: body.slice(m[0].length) };
}

/** Preview text for conversation lists. */
export function previewBody(body: string | null | undefined) {
  if (!body) return body ?? null;
  const { productId, text } = parseProductTag(body);
  if (!productId) return body;
  return text ? `🏷️ ${text}` : "🏷️ Tagged a product";
}

const RISK_RE = /\b(momo|mobile money|send (the )?money|pay (me )?first|advance payment|deposit|account number|transfer)\b/i;
/** Flags messages that ask for payment outside Kivora's pay-on-delivery flow. */
export function looksRisky(text: string) {
  return RISK_RE.test(text);
}
