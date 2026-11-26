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
          if (parsed && (await moolreStatus(ref)).txstatus === 1) await activateSubscription(parsed.userId, parsed.plan, ref);
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
