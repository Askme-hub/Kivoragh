import { useState, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Truck, Wallet, PackageSearch, ShoppingBag, MessageCircle, X, ChevronRight } from "lucide-react";

// Kivora customer care WhatsApp number (international format, digits only).
export const SUPPORT_WHATSAPP = "233257573471";

const HIDDEN = ["/cart", "/checkout", "/messages", "/login", "/payment"];

function WaIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.004 3C9.38 3 4 8.38 4 15.004c0 2.12.555 4.19 1.61 6.01L4 29l8.17-1.57A11.95 11.95 0 0 0 16.004 27C22.62 27 28 21.62 28 15.004 28 8.38 22.62 3 16.004 3Zm0 21.8c-1.85 0-3.66-.5-5.24-1.44l-.37-.22-4.85.93.96-4.73-.24-.38a9.78 9.78 0 0 1-1.5-5.26c0-5.42 4.41-9.83 9.84-9.83 5.42 0 9.83 4.41 9.83 9.83 0 5.42-4.41 9.84-9.83 9.84Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.06 4.47.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

export function WhatsAppSupport() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  if (HIDDEN.some((p) => path.startsWith(p))) return null;
  const onProduct = path.startsWith("/products/");
  const page = `https://kivoragh.shop${path}`;
  const topics = [
    ...(onProduct ? [{ icon: ShoppingBag, title: "This product", sub: "Ask about size, stock or quality", msg: `Hi Kivora, I have a question about this product: ${page}` }] : []),
    { icon: Truck, title: "Delivery", sub: "Fees, timing & Pay on Delivery areas", msg: "Hi Kivora Care, I have a question about delivery to my area.\nMy region/town: " },
    { icon: Wallet, title: "Payment", sub: "Pay on Delivery & Mobile Money", msg: "Hi Kivora Care, I need help with payment for my order." },
    { icon: PackageSearch, title: "Track my order", sub: "Dispatch status & delivery update", msg: "Hi Kivora Care, I want to track my order.\nOrder number: " },
    { icon: MessageCircle, title: "Something else", sub: "Chat with customer care", msg: `Hi Kivora, I need some help.${onProduct ? "" : `\n(Page: ${page})`}` },
  ];
  const pos = onProduct
    ? "bottom-[calc(160px+env(safe-area-inset-bottom))] lg:bottom-6"
    : "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6";
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-foreground/30 md:bg-transparent print:hidden" onClick={() => setOpen(false)} />}
      <div className={`fixed right-3 md:right-6 ${pos} z-50 flex flex-col items-end gap-3 print:hidden`}>
        {open && (
          <div role="dialog" aria-label="Quick help" className="w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-elevated animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-3 bg-success p-4 text-success-foreground">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-foreground/15"><WaIcon className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold leading-tight">Kivora Support</p>
                <p className="text-xs opacity-90">● Usually replies in minutes</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-success-foreground/15"><X size={18} /></button>
            </div>
            <p className="px-4 pt-3 text-sm font-semibold">What do you need help with?</p>
            <ul className="p-2">
              {topics.map((t) => (
                <li key={t.title}>
                  <a href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(t.msg)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted active:bg-muted">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><t.icon size={20} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{t.title}</span><span className="block truncate text-xs text-muted-foreground">{t.sub}</span></span>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">Opens WhatsApp · 025 757 3471</p>
          </div>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Get help from Kivora support" className="group">
          <span className="relative flex items-center gap-3 rounded-full bg-success text-success-foreground shadow-elevated ring-4 ring-success/20 transition-transform active:scale-95 md:hover:-translate-y-0.5 h-14 w-14 justify-center md:h-auto md:w-auto md:justify-start md:py-2 md:pl-2 md:pr-5">
            {!open && <span className="absolute inset-0 rounded-full bg-success/40 animate-ping [animation-duration:2.5s] md:hidden" />}
            <span className="relative grid h-14 w-14 place-items-center md:h-11 md:w-11 md:rounded-full md:bg-success-foreground/15">
              {open ? <X className="h-7 w-7 md:h-6 md:w-6" /> : <WaIcon className="h-8 w-8 md:h-6 md:w-6" />}
              {!open && <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-success bg-success-foreground md:right-0 md:top-0" />}
            </span>
            <span className="relative hidden flex-col text-left leading-tight md:flex">
              <span className="text-sm font-extrabold">Need help?</span>
              <span className="text-[11px] font-medium opacity-90">Chat with us · 025 757 3471</span>
            </span>
          </span>
        </button>
      </div>
    </>
  );
}
