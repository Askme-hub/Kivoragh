export type PopupTrigger = "browsing" | "category" | "cart_nudge";

export type PopupCampaign = {
  id: string;
  title: string;
  subtitle?: string;
  code?: string;
  cta_label?: string;
  link_url?: string;
  image_url?: string;
  trigger: PopupTrigger;
  category?: string;
  min_views?: number;
  active: boolean;
  ends_at?: string | null;
};

export const POPUP_SETTINGS_KEY = "popup_campaigns";

export const DEFAULT_CAMPAIGNS: PopupCampaign[] = [
  { id: "default-cart", title: "Pay only when it arrives", subtitle: "Pay on Delivery in all 16 regions · Your money is held safely for 48 hours", cta_label: "Finish my order", link_url: "/cart", trigger: "cart_nudge", active: true },
  { id: "default-browse", title: "Get deals on WhatsApp", subtitle: "Chat with Kivora on 025 757 3471 for new arrivals, help and order updates", cta_label: "Chat on WhatsApp", link_url: "https://wa.me/233257573471?text=Hi%20Kivora%2C%20add%20me%20to%20your%20deals%20list", trigger: "browsing", min_views: 2, active: true },
  { id: "default-install", title: "Add Kivora to your phone", subtitle: "Tap your browser menu, then \"Add to Home screen\" to shop faster and track orders", cta_label: "Got it", link_url: "/", trigger: "browsing", min_views: 4, active: true },
  { id: "default-sell", title: "Sell on Kivora for free", subtitle: "Open your shop in minutes and reach buyers across Ghana", cta_label: "Open my shop", link_url: "/seller", trigger: "browsing", min_views: 6, active: true },
];

const VIEWS_KEY = "kv_popup_views";
export type ViewLog = { total: number; cats: Record<string, number>; lastCat?: string };

export function readViews(): ViewLog {
  try { return JSON.parse(sessionStorage.getItem(VIEWS_KEY) || "") as ViewLog; } catch { return { total: 0, cats: {} }; }
}

/** Record that the shopper looked at a product (optionally in a category). */
export function trackProductView(category?: string | null) {
  if (typeof window === "undefined") return;
  const v = readViews();
  v.total += 1;
  if (category) { const k = category.toLowerCase(); v.cats[k] = (v.cats[k] ?? 0) + 1; v.lastCat = k; }
  sessionStorage.setItem(VIEWS_KEY, JSON.stringify(v));
  window.dispatchEvent(new Event("kv:view"));
}

/** Pick which campaign (if any) should show right now. Pure for testing. */
export function pickCampaign(
  list: PopupCampaign[],
  ctx: { views: ViewLog; cartCount: number; exitIntent: boolean; seen: Record<string, number>; now: number },
): PopupCampaign | null {
  const live = list.filter((c) => c.active && (!c.ends_at || new Date(c.ends_at).getTime() > ctx.now) && ctx.now - (ctx.seen[c.id] ?? 0) > 86_400_000);
  const cart = live.find((c) => c.trigger === "cart_nudge" && ctx.cartCount > 0 && ctx.exitIntent);
  if (cart) return cart;
  const cat = live.find((c) => c.trigger === "category" && c.category && ctx.views.lastCat === c.category.toLowerCase() && (ctx.views.cats[c.category.toLowerCase()] ?? 0) >= (c.min_views ?? 1));
  if (cat) return cat;
  return live.find((c) => c.trigger === "browsing" && ctx.views.total >= (c.min_views ?? 2)) ?? null;
}
