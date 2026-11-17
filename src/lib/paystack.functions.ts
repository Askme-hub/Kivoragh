import { doorDeliveryFee, normalizeZones, zoneForRegion } from "./delivery-zones";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  shipping_fee: z.number().min(0).max(10000),
  discount: z.number().min(0).max(10000),
});

export const initiatePaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      items: z.array(ItemSchema).min(1).max(100),
      callbackOrigin: z.string().url(),
      delivery: DeliverySchema,
      coupon_code: z.string().trim().max(50).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    // Online payments are paused until the live Paystack account is ready.
    if (process.env.ONLINE_PAYMENTS_ENABLED !== "true") {
      throw new Error("Online payment is coming soon. Please use Pay on Delivery for now.");
    }
    const { userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack not configured");

    const { createPendingOnlineOrder } = await import("./online-order.server");
    const { order, total, email } = await createPendingOnlineOrder(userId, data as any);

    // init paystack
    // init paystack
const reference = `KV_${order.id.replace(/-/g, "").slice(0, 16)}_${Date.now()}`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(total * 100), // pesewas
        currency: "GHS",
        reference,
        callback_url: `${data.callbackOrigin}/payment/callback?ref=${reference}`,
        metadata: { order_id: order.id, user_id: userId, order_number: order.order_number },
      }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.status) {
      await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      throw new Error(json.message ?? "Paystack init failed");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_reference: reference,
        paystack_access_code: json.data.access_code,
      })
      .eq("id", order.id);

    return {
      authorization_url: json.data.authorization_url as string,
      access_code: json.data.access_code as string,
      reference,
      order_id: order.id,
    };
  });


export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reference: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack not configured");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("payment_reference", data.reference)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    if (order.payment_status === "paid") {
      return { status: "paid", order_id: order.id };
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json: any = await res.json();
    if (!res.ok || !json.status) throw new Error(json.message ?? "Verify failed");

    const tx = json.data;
    const success = tx.status === "success" && Math.round(Number(order.total) * 100) === tx.amount;

    if (success) {
      const { finalizePaidOrder } = await import("./paid-order.server");
      await finalizePaidOrder(order.id, tx.amount / 100);
      return { status: "paid", order_id: order.id };
    }

    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);
    return { status: "failed", order_id: order.id };
  });
