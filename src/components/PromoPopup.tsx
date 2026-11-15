import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, Gift, Copy } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/lib/store";
import { getPopupCampaigns } from "@/lib/popup-campaigns.functions";
import { pickCampaign, readViews, type PopupCampaign } from "@/lib/popup-campaigns";

const SEEN_KEY = "kv_popup_seen";
const SESSION_KEY = "kv_popup_shown_session";
const BLOCKED = ["/checkout", "/admin", "/seller", "/login", "/forgot-password", "/orders"];

/** Targeted pop-ups: cart nudges on exit intent, browsing interest, and category deals. */
export function PromoPopup() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cartCount = useShop((s) => s.cart.length);
  const { data: campaigns = [] } = useQuery({ queryKey: ["popup-campaigns"], queryFn: () => getPopupCampaigns(), staleTime: 300_000 });
  const [open, setOpen] = useState<PopupCampaign | null>(null);
  const exitRef = useRef(false);
  const [tick, setTick] = useState(0);

  const blocked = BLOCKED.some((b) => path.startsWith(b));

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onLeave = (e: MouseEvent) => { if (e.clientY <= 0) { exitRef.current = true; bump(); } };
    let idle = setTimeout(() => { exitRef.current = true; bump(); }, 25_000);
    const reset = () => { clearTimeout(idle); idle = setTimeout(() => { exitRef.current = true; bump(); }, 25_000); };
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("kv:view", bump);
    window.addEventListener("touchstart", reset, { passive: true });
    window.addEventListener("scroll", reset, { passive: true });
    return () => {
      clearTimeout(idle);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("kv:view", bump);
      window.removeEventListener("touchstart", reset);
      window.removeEventListener("scroll", reset);
    };
  }, []);

  useEffect(() => {
    if (open || blocked || !campaigns.length || sessionStorage.getItem(SESSION_KEY)) return;
    let seen: Record<string, number> = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { /* ignore */ }
    const c = pickCampaign(campaigns, { views: readViews(), cartCount, exitIntent: exitRef.current, seen, now: Date.now() });
    if (!c) return;
    const t = setTimeout(() => {
      setOpen(c);
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen, [c.id]: Date.now() }));
    }, c.trigger === "cart_nudge" ? 0 : 2500);
    return () => clearTimeout(t);
  }, [tick, campaigns, cartCount, blocked, open, path]);

  if (!open) return null;
  const close = () => setOpen(null);
  const link = open.link_url || "/";
  const external = /^https?:/.test(link);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4" onClick={close}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5"><X className="h-4 w-4" /></button>
        {open.image_url ? (
          <img src={open.image_url} alt="" className="h-44 w-full object-cover" />
        ) : (
          <div className="bg-gradient-to-br from-primary to-primary/70 px-6 pt-8 pb-2 text-center text-primary-foreground"><Gift className="mx-auto h-10 w-10" /></div>
        )}
        <div className={open.image_url ? "px-6 pt-5 text-center" : "bg-gradient-to-br from-primary to-primary/70 px-6 pb-7 pt-2 text-center text-primary-foreground"}>
          <p className="text-2xl font-extrabold">{open.title}</p>
          {open.subtitle && <p className="mt-1 text-sm opacity-90">{open.subtitle}</p>}
        </div>
        <div className="space-y-3 p-5 text-center">
          {open.code && (
            <>
              <p className="text-sm text-muted-foreground">Use this code at checkout</p>
              <button onClick={() => { navigator.clipboard?.writeText(open.code!); toast.success("Code copied"); }} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary py-2 text-xl font-bold tracking-widest text-primary">
                {open.code} <Copy className="h-4 w-4" />
              </button>
            </>
          )}
          {external ? (
            <a href={link} onClick={close} className="block w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">{open.cta_label || "Shop now"}</a>
          ) : (
            <Link to={link} onClick={close} className="block w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">{open.cta_label || "Shop now"}</Link>
          )}
        </div>
      </div>
    </div>
  );
}
