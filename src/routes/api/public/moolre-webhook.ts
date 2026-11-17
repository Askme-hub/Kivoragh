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
          .select("id, total, payment_status").eq("payment_reference", ref).maybeSingle();
        if (!order || order.payment_status === "paid") return new Response("ok");

        const s = await moolreStatus(ref);
        if (s.txstatus === 1) {
          const { finalizePaidOrder } = await import("@/lib/paid-order.server");
          await finalizePaidOrder(order.id, Number(order.total));
        } else if (s.txstatus === 2) {
          await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id).neq("payment_status", "paid");
        }
        return new Response("ok");
      },
    },
  },
});
