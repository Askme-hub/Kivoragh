import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Gift } from "lucide-react";

const KEY = "kivora_promo_popup_seen";

/** Once-a-day promo pop-up for shoppers on the home page. */
export function PromoPopup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < 86_400_000) return;
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const close = () => { localStorage.setItem(KEY, String(Date.now())); setOpen(false); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4" onClick={close}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 rounded-full bg-background/80 p-1.5"><X className="h-4 w-4" /></button>
        <div className="bg-gradient-to-br from-primary to-primary/70 px-6 py-8 text-center text-primary-foreground">
          <Gift className="mx-auto h-10 w-10" />
          <p className="mt-3 text-2xl font-extrabold">10% OFF your order</p>
          <p className="mt-1 text-sm opacity-90">Pay on Delivery · Delivery across Ghana</p>
        </div>
        <div className="space-y-3 p-5 text-center">
          <p className="text-sm text-muted-foreground">Use this code at checkout</p>
          <p className="rounded-xl border-2 border-dashed border-primary py-2 text-xl font-bold tracking-widest text-primary">KIVORA10</p>
          <Link to="/" onClick={close} className="block w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Start shopping</Link>
        </div>
      </div>
    </div>
  );
}
