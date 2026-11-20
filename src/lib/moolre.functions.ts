import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Channel = z.enum(["MTN", "TELECEL", "AT"]);
const Payer = z.string().trim().min(9).max(16).regex(/^[0-9+\s]+$/);

const ItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(500),
  price: z.number().min(0),
  old_price: z.number().nullable().optional(),
  image_url: z.string().max(2000).nullable().optional(),
  qty: z.number().int().min(1).max(99),
});
const DeliverySchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20).regex(/^[0-9+\-\s()]+$/),
  region: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(500),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  delivery_type: z.enum(["door", "pickup"]).default("door"),
  pickup_station: z.string().trim().max(200).optional().or(z.literal("")),
});

async function ownOrder(orderId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin.from("orders")
    .select("id, total, payment_status, payment_reference").eq("id", orderId).eq("user_id", userId).maybeSingle();
  if (!order || !order.payment_reference) throw new Error("Order not found");
  return order;
}

/** Create the order and push a Mobile Money approval prompt to the buyer's phone. */
export const startMoolrePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    items: z.array(ItemSchema).min(1).max(100),
    delivery: DeliverySchema,
    coupon_code: z.string().trim().max(50).optional(),
    channel: Channel,
    payer: Payer,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { moolreCollect } = await import("./moolre.server");
    const { createPendingOnlineOrder } = await import("./online-order.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { order, total } = await createPendingOnlineOrder(context.userId, data as any);
    const reference = `KV-${order.id.replace(/-/g, "").slice(0, 12)}-${Date.now()}`;
    await supabaseAdmin.from("orders").update({ payment_reference: reference, payment_method: "online" } as any).eq("id", order.id);
    let r: { next: "otp" | "prompt" | "error"; message?: string };
    try {
      r = await moolreCollect({ channel: data.channel, payer: data.payer, amount: Number(total), externalref: reference });
    } catch {
      // A network timeout is ambiguous: the provider may have received the request.
      // Keep the order pending and let the status checker confirm it before retrying.
      return { order_id: order.id, next: "prompt" as const, message: "We're checking your payment request. Please wait for confirmation before trying again." };
    }
    if (r.next === "error") {
      await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return { order_id: order.id, next: "error" as const, message: r.message ?? "The payment request could not be started." };
    }
    return { order_id: order.id, next: r.next, message: r.message };
  });

/** Submit the one-time SMS code (first payment from a phone number). */
export const submitMoolreOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    order_id: z.string().uuid(), channel: Channel, payer: Payer,
    otp: z.string().trim().min(4).max(10).regex(/^\d+$/),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { moolreCollect } = await import("./moolre.server");
    const order = await ownOrder(data.order_id, context.userId);
    if (order.payment_status === "paid") return { next: "paid" as const };
    const r = await moolreCollect({ channel: data.channel, payer: data.payer, amount: Number(order.total), externalref: order.payment_reference!, otpcode: data.otp });
    if (r.next === "error") throw new Error(r.message);
    if (r.next === "otp") throw new Error("That code didn't work. Check the SMS and try again.");
    return { next: r.next };
  });

/** Poll the payment result; marks the order paid exactly once. */
export const checkMoolrePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ order_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const order = await ownOrder(data.order_id, context.userId);
    if (order.payment_status === "paid") return { status: "paid" as const };
    if (order.payment_status === "failed") return { status: "failed" as const, reason: "This payment request was not completed. Return to checkout to start a new payment." };
    const { moolreStatus } = await import("./moolre.server");
    const s = await moolreStatus(order.payment_reference!);
    if (s.txstatus === 1) {
      const { finalizePaidOrder } = await import("./paid-order.server");
      await finalizePaidOrder(order.id, Number(order.total));
      return { status: "paid" as const };
    }
    if (s.txstatus === 2) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id).neq("payment_status", "paid");
      return { status: "failed" as const, reason: s.reason ?? "Payment was declined or cancelled." };
    }
    return { status: "pending" as const };
  });
