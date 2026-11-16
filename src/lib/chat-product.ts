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
  if (body.startsWith("[[order:")) return "🛍️ Sent an order";
  const { productId, text } = parseProductTag(body);
  if (!productId) return body;
  return text ? `🏷️ ${text}` : "🏷️ Tagged a product";
}

const RISK_RE = /\b(momo|mobile money|send (the )?money|pay (me )?first|advance payment|deposit|account number|transfer)\b/i;
/** Flags messages that ask for payment outside Kivora's pay-on-delivery flow. */
export function looksRisky(text: string) {
  return RISK_RE.test(text);
}

/** Seller order cards: item snapshot stored in the message so it renders without extra lookups. */
export type ChatOrderItem = { id: string; name: string; price: number; qty: number; image: string | null };
export type ChatOrder = { items: ChatOrderItem[] };
const ORDER_RE = /^\[\[order:([^\]\n]+)\]\]\n?/;

export function encodeOrderCard(order: ChatOrder, text = "") {
  return `[[order:${encodeURIComponent(JSON.stringify(order))}]]\n${text.trim()}`.trimEnd();
}

export function parseOrderCard(body: string): { order: ChatOrder | null; text: string } {
  const m = body.match(ORDER_RE);
  if (!m) return { order: null, text: body };
  try {
    const o = JSON.parse(decodeURIComponent(m[1])) as ChatOrder;
    if (!Array.isArray(o.items) || o.items.length === 0) return { order: null, text: body };
    return { order: o, text: body.slice(m[0].length) };
  } catch {
    return { order: null, text: body };
  }
}

export function orderSubtotal(o: ChatOrder) {
  return o.items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
}
