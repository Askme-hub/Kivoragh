import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useShop } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { GiftEnvelope, envelopeCtaClass } from "@/components/GiftEnvelope";
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
  const { user, loading } = useAuth();
  const [welcome, setWelcome] = useState(false);

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

  // Signed-out visitors: invite them to register once per visit.
  useEffect(() => {
    if (loading || user || blocked || sessionStorage.getItem(SESSION_KEY)) return;
    const t = setTimeout(() => { setWelcome(true); sessionStorage.setItem(SESSION_KEY, "1"); }, 3000);
    return () => clearTimeout(t);
  }, [loading, user, blocked]);
  useEffect(() => { if (user) setWelcome(false); }, [user]);

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

  if (welcome && !blocked) {
    return (
      <GiftEnvelope
        eyebrow="Free surprises for new shoppers"
        title="Register to unlock surprises & perks"
        perks={[{ tag: "GH₵0 risk", text: "Pay on Delivery at your doorstep" }, { tag: "Surprise", text: "Member perks & fast order tracking" }]}
        onClose={() => setWelcome(false)}
        cta={<Link to="/login" onClick={() => setWelcome(false)} className={envelopeCtaClass}>Register to unlock</Link>}
      />
    );
  }
  if (!open) return null;
  const close = () => setOpen(null);
  const link = open.link_url || "/";
  const external = /^https?:/.test(link);
  const label = open.cta_label || "Shop now";
  return (
    <GiftEnvelope
      eyebrow="A gift from Kivora"
      title={open.title}
      perks={[{ tag: "Kivora", text: open.subtitle || "Shop safely across Ghana" }, ...(open.code ? [{ tag: open.code, text: "Use this code at checkout" }] : [])]}
      onClose={close}
      cta={external
        ? <a href={link} onClick={close} className={envelopeCtaClass}>{label}</a>
        : <Link to={link} onClick={close} className={envelopeCtaClass}>{label}</Link>}
    />
  );
}
