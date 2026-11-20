import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, CircleHelp, Loader2, PackageCheck, RefreshCw, ShieldCheck, ShoppingBag, XCircle } from "lucide-react";
import { verifyPaystackPayment } from "@/lib/paystack.functions";
import { checkMoolrePayment } from "@/lib/moolre.functions";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/payment/callback")({
  component: PaymentCallback,
  head: () => ({ meta: [
    { title: "Payment status – Kivora Ghana" },
    { name: "description", content: "Your secure Kivora payment confirmation." },
    { name: "robots", content: "noindex" },
  ] }),
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : (typeof s.reference === "string" ? s.reference : ""),
    provider: s.provider === "moolre" ? "moolre" as const : "paystack" as const,
    order: typeof s.order === "string" ? s.order : "",
  }),
});

function PaymentCallback() {
  const { ref, provider, order } = Route.useSearch();
  const router = useRouter();
  const verifyPaystack = useServerFn(verifyPaystackPayment);
  const verifyMoolre = useServerFn(checkMoolrePayment);
  const [state, setState] = useState<"loading" | "paid" | "failed">("loading");
  const [orderId, setOrderId] = useState<string | null>(order || null);
  const [message, setMessage] = useState("We're securely checking your payment. Please keep this page open.");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (provider === "moolre") {
        if (!order) {
          setMessage("We couldn't find the order linked to this payment.");
          setState("failed");
          return;
        }
        const startedAt = Date.now();
        const poll = async () => {
          if (!active) return;
          try {
            const result = await verifyMoolre({ data: { order_id: order } });
            if (!active) return;
            if (result.status === "paid") {
              setOrderId(order);
              setMessage("Your payment has been confirmed and your order is now being prepared.");
              setState("paid");
              useShop.getState().clearCart();
              return;
            }
            if (result.status === "failed") {
              setMessage(result.reason ?? "The payment was not completed. You can return to checkout and try another payment.");
              setState("failed");
              return;
            }
          } catch {
            // Temporary network errors are retried; never treat them as proof of payment failure.
          }
          if (!active) return;
          if (Date.now() - startedAt >= 180000) {
            setMessage("We haven't received a final confirmation yet. Your order has not been marked as paid. Please check your Mobile Money messages or contact Kivora support before trying again.");
            setState("failed");
            return;
          }
          timer = setTimeout(poll, 4000);
        };
        await poll();
        return;
      }

      if (!ref) {
        setMessage("We couldn't find a payment reference to verify.");
        setState("failed");
        return;
      }
      try {
        const result = await verifyPaystack({ data: { reference: ref } });
        if (!active) return;
        setState(result.status as "paid" | "failed");
        setOrderId(result.order_id ?? null);
        setMessage(result.status === "paid"
          ? "Your payment has been confirmed and your order is now being prepared."
          : "We couldn't confirm this payment. You can return to checkout and try again.");
        if (result.status === "paid") useShop.getState().clearCart();
      } catch {
        if (!active) return;
        setMessage("We couldn't verify this payment right now. Please try again or contact Kivora support.");
        setState("failed");
      }
    };

    void run();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [provider, order, ref, verifyMoolre, verifyPaystack]);

  const goToOrder = () => {
    if (orderId) router.navigate({ to: "/orders/$id", params: { id: orderId } });
  };
  const goToCheckout = () => router.navigate({ to: "/checkout" });

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-muted/30 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-success/10 blur-3xl" />
      <div className="relative w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShoppingBag size={21} /></span>
          <span className="text-2xl font-black tracking-tight text-foreground">Kivora</span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          <div className="p-7 text-center sm:p-10">
            {state === "loading" && (
              <>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 size={38} className="animate-spin" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Secure payment</p>
                <h1 className="text-2xl font-extrabold tracking-tight">Confirming your payment</h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
                <div className="mx-auto mt-7 flex max-w-xs items-center justify-center gap-2 rounded-xl bg-muted/70 px-4 py-3 text-xs font-medium text-muted-foreground">
                  <ShieldCheck size={16} className="text-success" /> Do not close or refresh this page
                </div>
              </>
            )}

            {state === "paid" && (
              <>
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success/10 text-success ring-8 ring-success/5">
                  <CheckCircle2 size={54} strokeWidth={1.8} />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-success">Payment confirmed</p>
                <h1 className="text-3xl font-extrabold tracking-tight">You're all set!</h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
                {orderId && <p className="mt-5 rounded-xl bg-muted/70 px-4 py-3 text-xs text-muted-foreground">Order reference <span className="font-bold text-foreground">{orderId.slice(0, 8).toUpperCase()}</span></p>}
                <div className="mt-7 space-y-3">
                  <button onClick={goToOrder} disabled={!orderId} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50">
                    <PackageCheck size={18} /> View my order
                  </button>
                  <button onClick={() => router.navigate({ to: "/" })} className="h-11 w-full rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition hover:bg-muted">Continue shopping</button>
                </div>
              </>
            )}

            {state === "failed" && (
              <>
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                  <XCircle size={54} strokeWidth={1.8} />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-destructive">Payment not confirmed</p>
                <h1 className="text-3xl font-extrabold tracking-tight">Let's try that again</h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
                <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-left text-xs leading-5 text-muted-foreground">
                  <CircleHelp size={16} className="mt-0.5 shrink-0" />
                  If money was deducted, please do not pay again until you check your Mobile Money transaction history or contact Kivora support.
                </div>
                <div className="mt-7 space-y-3">
                  <button onClick={goToCheckout} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90">
                    <RefreshCw size={17} /> Return to checkout
                  </button>
                  <button onClick={() => router.navigate({ to: "/" })} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition hover:bg-muted">
                    <ArrowLeft size={16} /> Back to Kivora
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-border bg-muted/40 px-5 py-4 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck size={14} className="text-success" /> Secure checkout · Your payment is verified before order confirmation
          </div>
        </section>
        <p className="mt-5 text-center text-[11px] text-muted-foreground">Need help? Contact Kivora support and share your order reference.</p>
      </div>
    </main>
  );
}
