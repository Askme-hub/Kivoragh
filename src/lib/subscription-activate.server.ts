// Shared, idempotent seller-plan activation used by Moolre polling and the signed webhook.
export type PaidPlan = "starter" | "premium";

export function subscriptionRef(plan: PaidPlan, userId: string) {
  return `SUB-${plan}-${userId.replace(/-/g, "")}-${Date.now()}`;
}

export function parseSubscriptionRef(ref: string): { plan: PaidPlan; userId: string } | null {
  const m = /^SUB-(starter|premium)-([0-9a-f]{32})-\d+$/.exec(ref);
  if (!m) return null;
  const h = m[2];
  return { plan: m[1] as PaidPlan, userId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` };
}

export async function activateSubscription(userId: string, plan: PaidPlan, reference: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: already } = await supabaseAdmin.from("subscription_payments").select("id").eq("reference", reference).maybeSingle();
  if (already) return;
  const { data: planRow } = await supabaseAdmin.from("subscription_plans").select("price").eq("id", plan).maybeSingle();
  const amount = Number(planRow?.price ?? 0);

  const now = new Date();
  const { data: existing } = await supabaseAdmin.from("seller_subscriptions")
    .select("plan, status, expires_at, started_at").eq("user_id", userId).maybeSingle();
  const stillActive = existing?.status === "active" && existing.plan === plan && existing.expires_at && new Date(existing.expires_at) > now;
  const base = stillActive ? new Date(existing!.expires_at!) : now;
  const expires = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Record payment first so a concurrent webhook + poll can't double-extend.
  const { error: payErr } = await supabaseAdmin.from("subscription_payments").insert({
    user_id: userId, plan, amount, reference, period_end: expires.toISOString(),
  });
  if (payErr) { const { data: dup } = await supabaseAdmin.from("subscription_payments").select("id").eq("reference", reference).maybeSingle(); if (dup) return; throw new Error(payErr.message); }

  const { error } = await supabaseAdmin.from("seller_subscriptions").upsert({
    user_id: userId, plan, status: "active",
    started_at: stillActive ? existing!.started_at : now.toISOString(),
    expires_at: expires.toISOString(), payment_reference: reference,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);

  try {
    const { trySendSMS } = await import("./sms.server");
    const { data: sp } = await supabaseAdmin.from("seller_profiles").select("phone").eq("user_id", userId).maybeSingle();
    if (sp?.phone) await trySendSMS(sp.phone, `Kivora: Your ${plan.toUpperCase()} plan is now active until ${expires.toDateString()}. Thank you!`);
    await supabaseAdmin.from("inbox_messages").insert({
      user_id: userId, title: `${plan[0].toUpperCase()}${plan.slice(1)} plan activated`,
      body: `Your Kivora ${plan} subscription is active until ${expires.toDateString()}. Thank you for upgrading!`,
    });
  } catch { /* best-effort */ }
}
