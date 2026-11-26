import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMatchingMoolrePayment } from "./moolre-verification";


export const initiateSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        plan: z.enum(["starter", "premium"]),
        callbackOrigin: z.string().url(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: planRow } = await supabaseAdmin
      .from("subscription_plans")
      .select("price")
      .eq("id", data.plan)
      .maybeSingle();
    const amount = Number(planRow?.price ?? 0);
    if (!amount) throw new Error("This plan is not available for purchase");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const email = profile?.email ?? `${userId}@user.local`;

    const reference = `SUB_${data.plan}_${userId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: "GHS",
        reference,
        callback_url: `${data.callbackOrigin}/subscription/callback?ref=${reference}`,
        metadata: { type: "subscription", plan: data.plan, user_id: userId },
      }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.status) throw new Error(json.message ?? "Payment init failed");

    return {
      authorization_url: json.data.authorization_url as string,
      reference,
    };
  });

const Channel = z.enum(["MTN", "TELECEL", "AT"]);
const Payer = z.string().trim().min(9).max(16).regex(/^[0-9+\s]+$/);

/** Start a Mobile Money (Moolre) prompt for a seller plan. */
export const startSubscriptionMomo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    plan: z.enum(["starter", "premium"]), channel: Channel, payer: Payer,
    reference: z.string().max(80).optional(), otp: z.string().trim().regex(/^\d{4,10}$/).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: planRow } = await supabaseAdmin.from("subscription_plans").select("price").eq("id", data.plan).maybeSingle();
    const amount = Number(planRow?.price ?? 0);
    if (!amount) throw new Error("This plan is not available for purchase");
    const { subscriptionRef, parseSubscriptionRef } = await import("./subscription-activate.server");
    let reference = subscriptionRef(data.plan, context.userId);
    if (data.reference) {
      const parsed = parseSubscriptionRef(data.reference);
      if (!parsed || parsed.userId !== context.userId || parsed.plan !== data.plan) throw new Error("Invalid payment reference");
      reference = data.reference;
    }
    const { moolreCollect } = await import("./moolre.server");
    const r = await moolreCollect({ channel: data.channel, payer: data.payer, amount, externalref: reference, otpcode: data.otp, label: `Kivora ${data.plan} plan` });
    if (r.next === "error") throw new Error(r.message);
    if (r.next === "otp" && data.otp) throw new Error("That code didn't work. Check the SMS and try again.");
    return { reference, next: r.next, message: r.message };
  });

/** Poll a Moolre subscription payment; activates the plan exactly once. */
export const checkSubscriptionMomo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reference: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { parseSubscriptionRef, activateSubscription } = await import("./subscription-activate.server");
    const parsed = parseSubscriptionRef(data.reference);
    if (!parsed || parsed.userId !== context.userId) throw new Error("Subscription mismatch");
    const { moolreStatus } = await import("./moolre.server");
    const s = await moolreStatus(data.reference);
    if (s.txstatus !== 0 && s.externalref !== data.reference) {
      throw new Error("We couldn't verify this subscription payment yet. Please contact support before retrying.");
    }
    if (s.txstatus === 1) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: planRow, error: planError } = await supabaseAdmin
        .from("subscription_plans").select("price").eq("id", parsed.plan).maybeSingle();
      if (planError || !planRow) throw new Error("Could not verify the subscription price.");
      if (!isMatchingMoolrePayment(s, { reference: data.reference, amountGhs: Number(planRow.price) })) {
        throw new Error("We couldn't verify this subscription payment yet. Please contact support before retrying.");
      }
      await activateSubscription(parsed.userId, parsed.plan, data.reference);
      return { status: "paid" as const };
    }
    if (s.txstatus === 2) return { status: "failed" as const, reason: s.reason ?? "Payment was declined or cancelled." };
    return { status: "pending" as const };
  });

export const verifySubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reference: z.string().min(1).max(200) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments not configured");

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const json: any = await res.json();
    if (!res.ok || !json.status) throw new Error(json.message ?? "Verification failed");

    const tx = json.data;
    const meta = tx.metadata ?? {};
    const plan = meta.plan as "starter" | "premium" | undefined;

    // Only the paying seller can activate their own subscription
    if (meta.user_id !== context.userId) throw new Error("Subscription mismatch");
    if (tx.status !== "success" || !plan) return { status: "failed" as const, plan: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Idempotent: a reference is only applied once
    const { data: already } = await supabaseAdmin
      .from("subscription_payments")
      .select("id")
      .eq("reference", data.reference)
      .maybeSingle();
    if (already) return { status: "paid" as const, plan };

    const now = new Date();
    // Renewing the same active plan extends from the current end date
    const { data: existing } = await supabaseAdmin
      .from("seller_subscriptions")
      .select("plan, status, expires_at, started_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const stillActive =
      existing?.status === "active" && existing.plan === plan && existing.expires_at && new Date(existing.expires_at) > now;
    const base = stillActive ? new Date(existing!.expires_at!) : now;
    const expires = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error } = await supabaseAdmin
      .from("seller_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          plan,
          status: "active",
          started_at: stillActive ? existing!.started_at : now.toISOString(),
          expires_at: expires.toISOString(),
          payment_reference: data.reference,
        },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("subscription_payments").insert({
      user_id: context.userId,
      plan,
      amount: Number(tx.amount) / 100,
      reference: data.reference,
      period_end: expires.toISOString(),
    });

    // Confirmation SMS + inbox (best-effort)
    const { trySendSMS } = await import("./sms.server");
    const { data: sp } = await supabaseAdmin
      .from("seller_profiles")
      .select("phone, shop_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (sp?.phone) {
      await trySendSMS(
        sp.phone,
        `Kivora: Your ${plan.toUpperCase()} plan is now active until ${expires.toDateString()}. Enjoy lower commissions and more selling power!`
      );
    }
    await supabaseAdmin.from("inbox_messages").insert({
      user_id: context.userId,
      title: `${plan[0].toUpperCase()}${plan.slice(1)} plan activated`,
      body: `Your Kivora ${plan} subscription is active until ${expires.toDateString()}. Thank you for upgrading!`,
    });

    return { status: "paid" as const, plan };
  });
