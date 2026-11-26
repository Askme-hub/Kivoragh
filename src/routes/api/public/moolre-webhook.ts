import { createFileRoute } from "@tanstack/react-router";

// Moolre payment callback. Signature is verified, then the result is re-checked
// with Moolre's status API before an order is marked paid.
export const Route = createFileRoute("/api/public/moolre-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.MOOLRE_WALLET_SECRET;
        if (!secret) return new Response("Not configured", { status: 500 });
        const raw = await request.text();
        const { verifyMoolreSignature, moolreStatus } = await import("@/lib/moolre.server");
        if (!verifyMoolreSignature(raw, request.headers.get("x-moolre-signature"), secret)) {
          return new Response("Invalid signature", { status: 400 });
        }
        let event: any;
        try { event = JSON.parse(raw); } catch { return new Response("Bad body", { status: 400 }); }
        const ref = typeof event?.data?.externalref === "string" ? event.data.externalref.slice(0, 200) : null;
        if (!ref) return new Response("ok");

        // Seller plan payments
        if (ref.startsWith("SUB-")) {
          const { parseSubscriptionRef, activateSubscription } = await import("@/lib/subscription-activate.server");
          const parsed = parseSubscriptionRef(ref);
          if (!parsed) return new Response("ok");
          const s = await moolreStatus(ref);
          if (s.txstatus !== 0 && s.externalref !== ref) {
            console.error("Moolre subscription reference mismatch", { expectedRef: ref, returnedRef: s.externalref });
            return new Response("Subscription reference mismatch", { status: 409 });
          }
          if (s.txstatus === 1) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: planRow, error: planError } = await supabaseAdmin
              .from("subscription_plans").select("price").eq("id", parsed.plan).maybeSingle();
            if (planError || !planRow) throw new Error("Could not load subscription price for Moolre verification.");
            const { isMatchingMoolrePayment } = await import("@/lib/moolre-verification");
            if (!isMatchingMoolrePayment(s, { reference: ref, amountGhs: Number(planRow.price) })) {
              console.error("Moolre subscription payment mismatch", { expectedRef: ref, expectedAmount: Number(planRow.price), paidAmount: s.amount });
              return new Response("Subscription payment details mismatch", { status: 409 });
            }
            await activateSubscription(parsed.userId, parsed.plan, ref);
          }
          return new Response("ok");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin.from("orders")
          .select("id, total, store_credit_applied, payment_status").eq("payment_reference", ref).maybeSingle();
        if (!order || order.payment_status === "paid") return new Response("ok");

        const s = await moolreStatus(ref);
        // The status endpoint is authoritative. Match both the original
        // external reference and the amount before accepting a successful debit.
        if (s.externalref !== ref) {
          console.error("Moolre status reference mismatch", { orderId: order.id, expectedRef: ref, returnedRef: s.externalref });
          return new Response("Payment reference mismatch", { status: 409 });
        }
        if (s.txstatus === 1) {
          const { isMatchingMoolrePayment } = await import("@/lib/moolre-verification");
          // Store credit is applied before the MoMo prompt, so only the remainder is charged.
          const expectedAmount = Number(order.total) - Number(order.store_credit_applied ?? 0);
          if (!isMatchingMoolrePayment(s, { reference: ref, amountGhs: expectedAmount })) {
            console.error("Moolre payment details mismatch", {
              orderId: order.id,
              expectedAmount,
              paidAmount: s.amount,
              returnedRef: s.externalref,
            });
            return new Response("Payment details mismatch", { status: 409 });
          }
          const { finalizePaidOrder } = await import("@/lib/paid-order.server");
          await finalizePaidOrder(order.id, Number(order.total));
        } else if (s.txstatus === 2) {
          const { error: updateError } = await supabaseAdmin.from("orders")
            .update({ payment_status: "failed" })
            .eq("id", order.id)
            .eq("payment_status", "pending");
          if (updateError) throw new Error(`Could not record Moolre payment failure: ${updateError.message}`);
        }
        return new Response("ok");
      },
    },
  },
});
