// Server-only Moolre Mobile Money helpers (https://docs.moolre.com).
import { createHmac, timingSafeEqual } from "crypto";

export type MoolreChannel = "MTN" | "TELECEL" | "AT";

function creds() {
  const user = process.env.MOOLRE_API_USER;
  const pubkey = process.env.MOOLRE_PUBKEY;
  const account = process.env.MOOLRE_ACCOUNT_NUMBER;
  if (!user || !pubkey || !account) throw new Error("Mobile Money payment is not set up yet. Please use Pay on Delivery for now.");
  return { user, pubkey, account };
}

async function call(path: string, body: Record<string, unknown>, idempotencyKey?: string) {
  const { user, pubkey } = creds();
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-API-USER": user, "X-API-PUBKEY": pubkey };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`https://api.moolre.com${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json: any = await res.json().catch(() => ({}));
  return json as { status?: number; code?: string; message?: string | null; data?: any; error?: { message?: string } };
}

/** Local 0-prefixed format required by Moolre. */
export function toLocalPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("233") && d.length === 12) return "0" + d.slice(3);
  if (d.length === 9) return "0" + d;
  return d;
}

export type CollectResult = { next: "otp" | "prompt" | "error"; message?: string };

export async function moolreCollect(opts: { channel: MoolreChannel; payer: string; amount: number; externalref: string; otpcode?: string; label?: string }, verified = false): Promise<CollectResult> {
  const { account } = creds();
  const body: Record<string, unknown> = {
    type: 1, channel: opts.channel, currency: "GHS", payer: toLocalPhone(opts.payer),
    amount: opts.amount.toFixed(2), externalref: opts.externalref, accountnumber: account,
    reference: opts.label ?? "Kivora order",
  };
  if (opts.otpcode) body.otpcode = opts.otpcode;
  const r = await call("/open/transact/payment", body, verified ? opts.externalref : undefined);
  switch (r.code) {
    case "TP14": return { next: "otp", message: "Enter the code Moolre sent to your phone by SMS." };
    case "TP17": return moolreCollect({ ...opts, otpcode: undefined }, true);
    case "TR099":
    case "TP18": return { next: "prompt" };
    case "OTP429": return { next: "error", message: "Too many code attempts. Please wait a few minutes and try again." };
    default: return { next: "error", message: r.error?.message ?? r.message ?? "Mobile Money request failed. Please try again." };
  }
}

/** txstatus: 1 paid, 2 failed, 0 pending. */
export async function moolreStatus(externalref: string): Promise<{ txstatus: 0 | 1 | 2; reason?: string }> {
  const { account } = creds();
  const r = await call("/open/transact/status", { type: 1, idtype: 1, id: externalref, accountnumber: account });
  const tx = Number(r.data?.txstatus ?? 0);
  return { txstatus: tx === 1 ? 1 : tx === 2 ? 2 : 0, reason: r.data?.reason };
}

/** Verify `X-Moolre-Signature: t=...,v1=...` (HMAC-SHA256 of "t.body" with the wallet secret). */
export function verifyMoolreSignature(rawBody: string, header: string | null, secret: string) {
  const parts = Object.fromEntries(String(header ?? "").split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(parts.v1));
  return a.length === b.length && timingSafeEqual(a, b);
}
